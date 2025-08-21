const express = require('express');
const twilioTokenService = require('../services/twilioTokenService');

const router = express.Router();

// POST /api/twilio/token - Gerar token Twilio
router.post('/token', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Verificar rate limiting
    if (!twilioTokenService.checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many token requests. Try again later.',
        retryAfter: 60
      });
    }

    const { identity, roomName } = req.body;

    if (!identity || typeof identity !== 'string' || identity.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid identity',
        message: 'Identity is required and must be a non-empty string'
      });
    }

    // Sanitizar identity (apenas alfanuméricos, hífens e underscores)
    const sanitizedIdentity = identity.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 50);
    
    if (sanitizedIdentity.length === 0) {
      return res.status(400).json({
        error: 'Invalid identity format',
        message: 'Identity must contain alphanumeric characters, hyphens, or underscores'
      });
    }

    const tokenData = await twilioTokenService.generateToken(sanitizedIdentity, roomName);

    console.log(`🎫 Token generated for identity: ${sanitizedIdentity}${roomName ? `, room: ${roomName}` : ''}`);

    res.json({
      success: true,
      token: tokenData.token,
      identity: sanitizedIdentity,
      roomName: roomName || null,
      expiresAt: tokenData.expiresAt,
      generatedAt: tokenData.generatedAt
    });

  } catch (error) {
    console.error('❌ Token generation error:', error);
    
    res.status(500).json({
      error: 'Token generation failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/twilio/ice-servers - Obter ICE servers
router.get('/ice-servers', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    // Rate limiting mais permissivo para ICE servers
    if (!twilioTokenService.checkRateLimit(clientIp)) {
      console.log(`⚠️ Rate limit hit for ICE servers request from ${clientIp}`);
      // Para ICE servers, retornar fallback ao invés de erro
    }

    const iceServers = await twilioTokenService.getIceServers();

    res.json({
      success: true,
      iceServers: iceServers.iceServers,
      generatedAt: iceServers.generatedAt,
      expiresAt: iceServers.expiresAt,
      source: iceServers.source || 'twilio'
    });

  } catch (error) {
    console.error('❌ ICE servers error:', error);
    
    // Sempre retornar fallback em caso de erro
    const fallback = twilioTokenService.getFallbackIceServers();
    
    res.json({
      success: true,
      iceServers: fallback.iceServers,
      generatedAt: fallback.generatedAt,
      source: 'fallback',
      warning: 'Using fallback ICE servers due to service error'
    });
  }
});

// DELETE /api/twilio/cache - Limpar cache (útil para desenvolvimento)
router.delete('/cache', (req, res) => {
  try {
    const { identity, roomName } = req.query;
    
    twilioTokenService.invalidateCache(identity, roomName);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      clearedFor: identity ? `${identity}${roomName ? `/${roomName}` : ''}` : 'all'
    });

  } catch (error) {
    console.error('❌ Cache clear error:', error);
    res.status(500).json({
      error: 'Cache clear failed',
      message: error.message
    });
  }
});

// GET /api/twilio/stats - Estatísticas do serviço
router.get('/stats', (req, res) => {
  try {
    const stats = twilioTokenService.getCacheStats();
    
    res.json({
      success: true,
      cache: stats,
      service: {
        initialized: twilioTokenService.initialized,
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development'
      }
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      error: 'Stats retrieval failed',
      message: error.message
    });
  }
});

module.exports = router;