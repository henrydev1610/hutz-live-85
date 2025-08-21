const express = require('express');
const twilioTokenService = require('../services/twilioTokenService');

const router = express.Router();

// GET /api/twilio-test/credentials - Testar credenciais da Twilio
router.get('/credentials', async (req, res) => {
  try {
    console.log('🧪 TWILIO TEST: Starting credential validation...');
    
    // Verificar variáveis de ambiente
    const credentials = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_API_KEY: process.env.TWILIO_API_KEY,
      TWILIO_API_SECRET: process.env.TWILIO_API_SECRET
    };

    const report = {
      environment: {
        TWILIO_ACCOUNT_SID: credentials.TWILIO_ACCOUNT_SID ? `✅ Present (${credentials.TWILIO_ACCOUNT_SID.substring(0, 10)}...)` : '❌ Missing',
        TWILIO_AUTH_TOKEN: credentials.TWILIO_AUTH_TOKEN ? `✅ Present (${credentials.TWILIO_AUTH_TOKEN.length} chars)` : '❌ Missing',
        TWILIO_API_KEY: credentials.TWILIO_API_KEY ? `✅ Present (${credentials.TWILIO_API_KEY.substring(0, 10)}...)` : '❌ Missing',
        TWILIO_API_SECRET: credentials.TWILIO_API_SECRET ? `✅ Present (${credentials.TWILIO_API_SECRET.length} chars)` : '❌ Missing'
      },
      service: {
        initialized: twilioTokenService.initialized,
        client: !!twilioTokenService.client
      },
      tests: {}
    };

    // Teste 1: Inicialização do serviço
    if (!twilioTokenService.initialized) {
      console.log('🔧 TWILIO TEST: Attempting to initialize service...');
      const initResult = twilioTokenService.initialize();
      report.tests.initialization = initResult ? '✅ Success' : '❌ Failed';
    } else {
      report.tests.initialization = '✅ Already initialized';
    }

    // Teste 2: Gerar token de teste
    if (twilioTokenService.initialized) {
      try {
        console.log('🎫 TWILIO TEST: Generating test token...');
        const tokenData = await twilioTokenService.generateToken('test_user_' + Date.now());
        report.tests.tokenGeneration = tokenData ? '✅ Success' : '❌ Failed';
        if (tokenData) {
          report.tests.tokenDetails = {
            identity: tokenData.identity,
            expiresAt: new Date(tokenData.expiresAt).toISOString(),
            tokenLength: tokenData.token ? tokenData.token.length : 0
          };
        }
      } catch (error) {
        report.tests.tokenGeneration = `❌ Error: ${error.message}`;
      }

      // Teste 3: Obter ICE servers
      try {
        console.log('🧊 TWILIO TEST: Fetching ICE servers...');
        const iceServers = await twilioTokenService.getIceServers();
        report.tests.iceServers = iceServers ? '✅ Success' : '❌ Failed';
        if (iceServers) {
          report.tests.iceServerDetails = {
            count: iceServers.iceServers ? iceServers.iceServers.length : 0,
            source: iceServers.source || 'unknown',
            servers: iceServers.iceServers ? iceServers.iceServers.map(s => ({
              urls: s.urls,
              hasCredential: !!(s.credential),
              username: s.username || 'none'
            })) : []
          };
        }
      } catch (error) {
        report.tests.iceServers = `❌ Error: ${error.message}`;
      }
    } else {
      report.tests.tokenGeneration = '⏭️ Skipped (service not initialized)';
      report.tests.iceServers = '⏭️ Skipped (service not initialized)';
    }

    console.log('🧪 TWILIO TEST: Test completed');
    console.log('📋 TWILIO TEST: Report:', JSON.stringify(report, null, 2));

    res.json({
      success: true,
      timestamp: Date.now(),
      report
    });

  } catch (error) {
    console.error('❌ TWILIO TEST: Failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

// POST /api/twilio-test/reset - Resetar e reinicializar serviço
router.post('/reset', (req, res) => {
  try {
    console.log('🔄 TWILIO TEST: Resetting service...');
    
    // Limpar cache
    twilioTokenService.invalidateCache();
    
    // Reinicializar
    const initResult = twilioTokenService.initialize();
    
    res.json({
      success: true,
      initialized: initResult,
      message: initResult ? 'Service reset and initialized successfully' : 'Service reset but initialization failed',
      timestamp: Date.now()
    });
    
    console.log(`🔄 TWILIO TEST: Reset completed - ${initResult ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    console.error('❌ TWILIO TEST: Reset failed:', error);
    res.status(500).json({
      success: false,
      error: 'Reset failed',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

module.exports = router;