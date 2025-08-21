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

// GET /api/twilio/test - Endpoint de teste para validar credenciais Twilio
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 TWILIO TEST: Starting credential validation...');
    
    const testResults = {
      credentials: {
        accountSid: !!process.env.TWILIO_ACCOUNT_SID,
        authToken: !!process.env.TWILIO_AUTH_TOKEN,
        apiKey: !!process.env.TWILIO_API_KEY,
        apiSecret: !!process.env.TWILIO_API_SECRET
      },
      service: {
        initialized: twilioTokenService.initialized
      },
      tests: {}
    };

    // Teste 1: Inicialização
    if (!twilioTokenService.initialized) {
      const initResult = twilioTokenService.initialize();
      testResults.tests.initialization = initResult;
    } else {
      testResults.tests.initialization = true;
    }

    // Teste 2: Geração de token
    try {
      const tokenResult = await twilioTokenService.generateToken('test-user', 'test-room');
      testResults.tests.tokenGeneration = {
        success: true,
        hasToken: !!tokenResult.token,
        identity: tokenResult.identity,
        roomName: tokenResult.roomName
      };
    } catch (tokenError) {
      testResults.tests.tokenGeneration = {
        success: false,
        error: tokenError.message
      };
    }

    // Teste 3: ICE servers
    try {
      const iceResult = await twilioTokenService.getIceServers();
      testResults.tests.iceServers = {
        success: true,
        serverCount: iceResult.iceServers ? iceResult.iceServers.length : 0,
        source: iceResult.source || 'twilio',
        hasTurnServers: iceResult.iceServers ? 
          iceResult.iceServers.some(s => s.urls.includes('turn:')) : false,
        servers: iceResult.iceServers ? iceResult.iceServers.map(s => ({
          urls: s.urls,
          hasCredential: !!s.credential,
          username: s.username || 'N/A'
        })) : []
      };
    } catch (iceError) {
      testResults.tests.iceServers = {
        success: false,
        error: iceError.message
      };
    }

    console.log('✅ TWILIO TEST: Test completed', testResults);

    res.json({
      success: true,
      message: 'Twilio integration test completed',
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ TWILIO TEST ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;