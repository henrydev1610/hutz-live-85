
/**
 * Script de validação para deployment Railway
 * Testa todos os aspectos críticos do sistema
 */

const fetch = require('node-fetch');
const WebSocket = require('ws');

const VALIDATION_CONFIG = {
  backendUrl: process.env.APP_DOMAIN || 'https://your-backend.railway.app',
  frontendUrl: process.env.FRONTEND_URL || 'https://your-frontend.railway.app',
  timeout: 30000,
  retries: 3
};

class RailwayValidator {
  constructor() {
    this.results = {
      healthCheck: false,
      websocket: false,
      cors: false,
      environment: false,
      performance: false,
      overall: false
    };
  }

  async validateHealthCheck() {
    console.log('🏥 Testing health check endpoint...');
    
    try {
      const response = await fetch(`${VALIDATION_CONFIG.backendUrl}/health`, {
        timeout: VALIDATION_CONFIG.timeout
      });
      
      if (response.ok) {
        const health = await response.json();
        console.log('✅ Health check passed:', health);
        
        // Validar estrutura da resposta
        const hasRequiredFields = health.status && health.timestamp && health.service;
        if (hasRequiredFields) {
          this.results.healthCheck = true;
          return true;
        }
      }
      
      console.error('❌ Health check failed: Invalid response');
      return false;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  }

  async validateWebSocket() {
    console.log('🔗 Testing WebSocket connection...');
    
    return new Promise((resolve) => {
      const wsUrl = VALIDATION_CONFIG.backendUrl.replace('https://', 'wss://');
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.error('❌ WebSocket connection timeout');
        resolve(false);
      }, VALIDATION_CONFIG.timeout);
      
      ws.on('open', () => {
        console.log('✅ WebSocket connection established');
        clearTimeout(timeout);
        
        // Testar ping/pong
        ws.ping();
        
        ws.on('pong', () => {
          console.log('✅ WebSocket ping/pong working');
          this.results.websocket = true;
          ws.close();
          resolve(true);
        });
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        clearTimeout(timeout);
        resolve(false);
      });
      
      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
      });
    });
  }

  async validateCORS() {
    console.log('🌐 Testing CORS configuration...');
    
    try {
      const response = await fetch(`${VALIDATION_CONFIG.backendUrl}/health`, {
        method: 'GET',
        headers: {
          'Origin': VALIDATION_CONFIG.frontendUrl,
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      
      if (corsHeader && (corsHeader === '*' || corsHeader === VALIDATION_CONFIG.frontendUrl)) {
        console.log('✅ CORS configuration valid');
        this.results.cors = true;
        return true;
      }
      
      console.error('❌ CORS configuration invalid:', corsHeader);
      return false;
    } catch (error) {
      console.error('❌ CORS validation failed:', error.message);
      return false;
    }
  }

  async validateEnvironment() {
    console.log('🌍 Testing environment configuration...');
    
    try {
      const response = await fetch(`${VALIDATION_CONFIG.backendUrl}/health`);
      const health = await response.json();
      
      const hasRailwayConfig = health.railway && health.railway.serviceId;
      const hasProductionEnv = health.environment === 'production';
      const hasValidPort = health.port && health.port !== '3001';
      
      if (hasRailwayConfig && hasProductionEnv && hasValidPort) {
        console.log('✅ Environment configuration valid');
        this.results.environment = true;
        return true;
      }
      
      console.error('❌ Environment configuration invalid');
      return false;
    } catch (error) {
      console.error('❌ Environment validation failed:', error.message);
      return false;
    }
  }

  async validatePerformance() {
    console.log('⚡ Testing performance metrics...');
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${VALIDATION_CONFIG.backendUrl}/health`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      const isHealthy = response.ok;
      const isFast = responseTime < 2000; // < 2s
      
      console.log(`📊 Response time: ${responseTime}ms`);
      
      if (isHealthy && isFast) {
        console.log('✅ Performance metrics acceptable');
        this.results.performance = true;
        return true;
      }
      
      console.error('❌ Performance metrics poor');
      return false;
    } catch (error) {
      console.error('❌ Performance validation failed:', error.message);
      return false;
    }
  }

  async runAllValidations() {
    console.log('🚀 Starting Railway deployment validation...');
    console.log('📋 Configuration:', VALIDATION_CONFIG);
    
    const validations = [
      { name: 'Health Check', fn: () => this.validateHealthCheck() },
      { name: 'WebSocket', fn: () => this.validateWebSocket() },
      { name: 'CORS', fn: () => this.validateCORS() },
      { name: 'Environment', fn: () => this.validateEnvironment() },
      { name: 'Performance', fn: () => this.validatePerformance() }
    ];
    
    for (const validation of validations) {
      console.log(`\n🔄 Running ${validation.name} validation...`);
      
      let success = false;
      for (let attempt = 1; attempt <= VALIDATION_CONFIG.retries; attempt++) {
        try {
          success = await validation.fn();
          if (success) break;
          
          if (attempt < VALIDATION_CONFIG.retries) {
            console.log(`⏳ Retrying ${validation.name} (attempt ${attempt + 1}/${VALIDATION_CONFIG.retries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`❌ ${validation.name} validation error:`, error.message);
        }
      }
      
      if (!success) {
        console.error(`❌ ${validation.name} validation failed after ${VALIDATION_CONFIG.retries} attempts`);
      }
    }
    
    // Calcular resultado geral
    const passed = Object.values(this.results).filter(Boolean).length;
    const total = Object.keys(this.results).length;
    this.results.overall = passed === total;
    
    console.log('\n📊 Validation Results:');
    console.log('========================');
    
    Object.entries(this.results).forEach(([test, result]) => {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`${test.padEnd(15)}: ${status}`);
    });
    
    console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
    
    if (this.results.overall) {
      console.log('🎉 Railway deployment validation successful!');
      console.log('✅ System is ready for production use');
    } else {
      console.log('⚠️  Railway deployment validation failed');
      console.log('❌ System needs attention before production use');
    }
    
    return this.results;
  }
}

// Executar validação se chamado diretamente
if (require.main === module) {
  const validator = new RailwayValidator();
  validator.runAllValidations()
    .then(results => {
      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation crashed:', error);
      process.exit(1);
    });
}

module.exports = RailwayValidator;
