
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateQRCode } = require('../services/qr');

const router = express.Router();

// Armazenamento em memória das salas (em produção, usar Redis ou banco de dados)
const rooms = new Map();

// POST /api/rooms - Criar nova sala
router.post('/', async (req, res) => {
  try {
    // Gerar roomId único
    const roomId = uuidv4();
    
    // Montar joinURL com detecção automática do domínio
    const origin = process.env.FRONTEND_URL || 
                  req.headers.origin || 
                  req.headers.referer?.replace(/\/$/, '') || 
                  process.env.APP_DOMAIN || 
                  'https://hutz-live-85.onrender.com';
    
    const joinURL = `${origin}/participant/${roomId}`;
    console.log(`🔗 ROOM: Generated joinURL: ${joinURL} (from origin: ${origin})`);
    
    // Gerar QR Code como Data URL
    const qrDataUrl = await generateQRCode(joinURL);
    
    // Salvar informações da sala
    const roomData = {
      roomId,
      joinURL,
      qrDataUrl,
      createdAt: new Date().toISOString(),
      participants: [],
      isActive: true
    };
    
    rooms.set(roomId, roomData);
    
    console.log(`✅ Sala criada: ${roomId}`);
    
    // Retornar dados da sala
    res.status(201).json({
      roomId,
      joinURL,
      qrDataUrl
    });
    
  } catch (error) {
    console.error('Erro ao criar a sala:', error);
    res.status(500).json({
      error: 'Falha ao criar a sala ',
      message: error.message
    });
  }
});

// GET /api/rooms/:roomId - Obter informações da sala
router.get('/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!rooms.has(roomId)) {
      return res.status(404).json({
        error: 'Room not found'
      });
    }
    
    const roomData = rooms.get(roomId);
    
    // Retornar apenas informações públicas
    res.json({
      roomId: roomData.roomId,
      joinURL: roomData.joinURL,
      isActive: roomData.isActive,
      participantCount: roomData.participants.length,
      createdAt: roomData.createdAt
    });
    
  } catch (error) {
    console.error('Erro ao chamar a sala:', error);
    res.status(500).json({
      error: 'Failha ao obter informações da sala',
      message: error.message
    });
  }
});

// DELETE /api/rooms/:roomId - Fechar sala
router.delete('/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!rooms.has(roomId)) {
      return res.status(404).json({
        error: 'Room not found'
      });
    }
    
    // Marcar sala como inativa
    const roomData = rooms.get(roomId);
    roomData.isActive = false;
    rooms.set(roomId, roomData);
    
    console.log(`🔒 Sala feichada: ${roomId}`);
    
    res.json({
      message: 'Sala fechada com sucessso',
      roomId
    });
    
  } catch (error) {
    console.error('Erro ao fechar a sala:', error);
    res.status(500).json({
      error: 'Falha ao fechar a sala',
      message: error.message
    });
  }
});

// Função para limpar salas antigas (executar periodicamente)
const cleanupOldRooms = () => {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 horas
  
  for (const [roomId, roomData] of rooms.entries()) {
    const roomAge = now - new Date(roomData.createdAt);
    if (roomAge > maxAge) {
      rooms.delete(roomId);
      console.log(`🗑️ Cleaned up old room: ${roomId}`);
    }
  }
};

// Executar limpeza a cada hora
setInterval(cleanupOldRooms, 60 * 60 * 1000);

// Endpoint para gerar tokens da Metered Rooms
router.get('/room-token', async (req, res) => {
  try {
    const { roomName, role } = req.query;
    
    // Validação de parâmetros
    if (!roomName || !role) {
      return res.status(400).json({ 
        error: 'roomName and role are required' 
      });
    }

    if (!['host', 'participant'].includes(role)) {
      return res.status(400).json({ 
        error: 'role must be host or participant' 
      });
    }

    // Validação de origem/referrer para segurança
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    const isValidOrigin = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(pattern).test(origin || referer || '');
      }
      return origin === allowed || (referer && referer.startsWith(allowed));
    });

    if (!isValidOrigin) {
      console.log('Invalid origin:', origin, 'Referer:', referer);
      return res.status(403).json({ 
        error: 'Invalid origin' 
      });
    }

    // Configuração do token baseada no role
    const tokenConfig = {
      roomName,
      role,
      expiresIn: 300, // 5 minutos
      singleUse: true
    };

    if (role === 'participant') {
      tokenConfig.permissions = ['join', 'publish:video'];
    } else if (role === 'host') {
      tokenConfig.permissions = ['join', 'subscribe'];
    }

    // Chamada à API da Metered para gerar token real
    const meteredApiKey = process.env.METERED_API_KEY;
    if (!meteredApiKey) {
      console.error('METERED_API_KEY not configured');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    try {
      // Implementar chamada real à API da Metered
      const response = await fetch('https://turnlive.metered.live/api/v1/room/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${meteredApiKey}`
        },
        body: JSON.stringify({
          roomName,
          role,
          expirationTime: Math.floor(Date.now() / 1000) + tokenConfig.expiresIn
        })
      });

      if (!response.ok) {
        throw new Error(`Metered API error: ${response.statusText}`);
      }

      const { token } = await response.json();
      
      // Log de auditoria
      console.log(`Token gerado para ${role} na sala ${roomName}:`, {
        timestamp: new Date().toISOString(),
        origin,
        referer,
        tokenConfig
      });

      res.json({
        token,
        roomName,
        role,
        expiresIn: tokenConfig.expiresIn
      });

    } catch (apiError) {
      console.error('Erro na API Metered:', apiError);
      // Fallback para token simulado em caso de erro da API
      const fallbackToken = `metered_fallback_${role}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      res.json({
        token: fallbackToken,
        roomName,
        role,
        expiresIn: tokenConfig.expiresIn,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Erro ao gerar token da Metered:', error);
    res.status(500).json({ 
      error: 'Failed to generate room token' 
    });
  }
});

module.exports = router;
