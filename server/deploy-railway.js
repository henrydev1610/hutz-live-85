
/**
 * Script de deployment para Railway.app
 * Configura variáveis de ambiente e valida deployment
 */

const fs = require('fs');
const path = require('path');

// Configurações do Railway
const RAILWAY_CONFIG = {
  serviceName: 'momento-live-backend',
  region: 'us-west1', // ou us-east1
  environment: 'production',
  healthCheck: {
    path: '/health',
    timeout: 300,
    interval: 30
  },
  scaling: {
    min: 1,
    max: 3,
    cpuThreshold: 80,
    memoryThreshold: 80
  }
};

// Função para validar variáveis de ambiente
function validateEnvironment() {
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'FRONTEND_URL',
    'APP_DOMAIN'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
}

// Função para configurar CORS dinâmico
function configureCORS() {
  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.APP_DOMAIN;
  
  const corsOrigins = [
    frontendUrl,
    backendUrl,
    'https://hutz-live-85.onrender.com', // Fallback durante migração
    'http://localhost:5173', // Desenvolvimento
    'http://localhost:3000'
  ].filter(Boolean);
  
  console.log('🔧 CORS Origins configured:', corsOrigins);
  return corsOrigins;
}

// Função para preparar health check
function setupHealthCheck() {
  const healthCheckCode = `
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'momento-live-backend',
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: {
      websocket: io?.engine?.clientsCount || 0,
      rooms: Object.keys(rooms || {}).length || 0,
      participants: connections?.size || 0
    },
    railway: {
      serviceId: process.env.RAILWAY_SERVICE_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
      staticUrl: process.env.RAILWAY_STATIC_URL
    }
  };
  
  res.json(healthStatus);
});
`;
  
  console.log('🏥 Health check endpoint configured');
  return healthCheckCode;
}

// Função principal de deployment
async function deployToRailway() {
  console.log('🚀 Starting Railway deployment configuration...');
  
  try {
    // Validar ambiente
    validateEnvironment();
    
    // Configurar CORS
    const corsOrigins = configureCORS();
    
    // Configurar health check
    const healthCheck = setupHealthCheck();
    
    // Gerar arquivo de configuração final
    const deployConfig = {
      ...RAILWAY_CONFIG,
      cors: corsOrigins,
      timestamp: new Date().toISOString(),
      version: require('./package.json').version
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'railway-deploy-config.json'),
      JSON.stringify(deployConfig, null, 2)
    );
    
    console.log('✅ Railway deployment configuration completed');
    console.log('📋 Next steps:');
    console.log('1. railway login');
    console.log('2. railway link');
    console.log('3. railway up');
    console.log('4. railway domain');
    console.log('5. Update frontend URLs');
    
  } catch (error) {
    console.error('❌ Railway deployment configuration failed:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  deployToRailway();
}

module.exports = {
  deployToRailway,
  validateEnvironment,
  configureCORS,
  setupHealthCheck,
  RAILWAY_CONFIG
};
