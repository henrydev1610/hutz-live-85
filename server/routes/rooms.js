
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
    
    console.log(`✅ Room created: ${roomId}`);
    
    // Retornar dados da sala
    res.status(201).json({
      roomId,
      joinURL,
      qrDataUrl
    });
    
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      error: 'Failed to create room',
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
    console.error('Error getting room:', error);
    res.status(500).json({
      error: 'Failed to get room',
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
    
    console.log(`🔒 Room closed: ${roomId}`);
    
    res.json({
      message: 'Room closed successfully',
      roomId
    });
    
  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({
      error: 'Failed to close room',
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

module.exports = router;
