
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { AccessToken } = require('livekit-server-sdk');
const roomsRouter = require('./routes/rooms');
const { initializeSocketHandlers } = require('./signaling/socket');

// Carregar variáveis de ambiente
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// FASE 1: Sanitiza ALLOWED_ORIGINS do env (separado por vírgulas, sem colchetes/aspas)
const raw = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = raw.split(',').map(s => s.trim()).filter(Boolean);

// ALERTA CRÍTICO: Se não há origens permitidas, ninguém pode conectar
if (allowedOrigins.length === 0) {
  console.error('🚨 CRITICAL: ALLOWED_ORIGINS is empty! All WebSocket connections will be blocked!');
  console.error('🔧 Add ALLOWED_ORIGINS to environment variables with comma-separated URLs');
  console.error('💡 Example: ALLOWED_ORIGINS=https://domain1.com,https://domain2.com');
} else {
  console.log('✅ Allowed origins (sanitized):', allowedOrigins);
}

// Validar variáveis de ambiente do LiveKit
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.warn('⚠️ WARNING: LiveKit credentials not configured');
  console.warn('🔧 Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in .env');
} else {
  console.log('✅ LiveKit credentials loaded:', LIVEKIT_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (aplicações mobile, Postman, etc.)
    if (!origin) return callback(null, true);

    console.log(`🔍 CORS CHECK: Testing origin: ${origin}`);
    console.log(`📋 CORS CHECK: Allowed origins: ${JSON.stringify(allowedOrigins)}`);

    // Verificar se o origin está na lista permitida (com suporte a wildcards)
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        // Suporte a wildcard com regex
        if (allowedOrigin.startsWith('*.')) {
          const domain = allowedOrigin.substring(2);
          const regex = new RegExp(`^https?://[^.]+\\.${domain.replace(/\./g, '\\.')}$`);
          const matches = regex.test(origin);
          console.log(`🌐 WILDCARD CHECK: ${allowedOrigin} vs ${origin} = ${matches}`);
          return matches;
        }
        // Verificação exata
        const exactMatch = origin === allowedOrigin;
        console.log(`✅ EXACT CHECK: ${allowedOrigin} vs ${origin} = ${exactMatch}`);
        return exactMatch;
      } else if (allowedOrigin instanceof RegExp) {
        const regexMatch = allowedOrigin.test(origin);
        console.log(`🔧 REGEX CHECK: ${allowedOrigin} vs ${origin} = ${regexMatch}`);
        return regexMatch;
      }
      return false;
    });

    if (isAllowed) {
      console.log(`✅ CORS ALLOWED: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS BLOCKED: ${origin}`);
      console.log(`📝 CORS HELP: Add "${origin}" to ALLOWED_ORIGINS in server/.env`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 //para rodar em browsers antigos 
};

// Middlewares de segurança
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

// Aplicar CORS
app.use(cors(corsOptions));

// Middleware para tratar requisições OPTIONS explicitamente
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar Socket.IO com os mesmos origins (processando wildcards)
const processedOrigins = allowedOrigins.map(origin => {
  if (typeof origin === 'string' && origin.startsWith('*.')) {
    const domain = origin.substring(2);
    return new RegExp(`^https?://[^.]+\\.${domain.replace(/\./g, '\\.')}$`);
  }
  return origin;
});

const io = new Server(server, {
  cors: {
    origin: processedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Configurar Redis adapter se REDIS_URL estiver definida
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Redis adapter configured successfully');
    }).catch(err => {
      console.error('❌ Redis adapter configuration failed:', err);
    });
  } catch (error) {
    console.warn('⚠️ Redis dependencies not found, running without Redis adapter');
  }
}

// Inicializar handlers do Socket.IO
initializeSocketHandlers(io);

// Middleware de log para debug
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'no-origin'}`);
  next();
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    name: 'Hutz Live Server',
    status: 'running',
    timestamp: Date.now(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      rooms: '/api/rooms',
      status: '/status',
      livekit: '/get-token'
    }
  });
});

// Rotas da API
app.use('/api/rooms', roomsRouter);

// Rota LiveKit - Gerar token JWT para acesso à sala
app.get('/get-token', (req, res) => {
  try {
    const { room, user } = req.query;

    // Validar parâmetros obrigatórios
    if (!room || !user) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "room" and "user" query parameters are required',
        example: '/get-token?room=live-session-123&user=participant-456'
      });
    }

    // Validar credenciais LiveKit
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        error: 'LiveKit not configured',
        message: 'Server is missing LiveKit credentials'
      });
    }

    console.log(`🎫 Generating LiveKit token for user="${user}" in room="${room}"`);

    // Criar token de acesso com permissões completas
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user,
      ttl: '24h' // Token válido por 24 horas
    });

    // Conceder permissões para a sala
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    // Gerar token JWT
    const token = at.toJwt();

    console.log(`✅ Token generated successfully for user="${user}"`);

    // Retornar token e metadados
    res.json({
      token: token,   // agora garante que é string
      url: LIVEKIT_URL,
      room,
      user,
      ttl: 86400
    });
  } catch (error) {
    console.error('❌ Error generating LiveKit token:', error);
    res.status(500).json({
      error: 'Token generation failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// TEST ENDPOINT - Remover em produção
app.get('/test-livekit', async (req, res) => {
  try {
    const testRoom = 'test-room';
    const testUser = 'test-user';

    console.log('🧪 Testing LiveKit token generation...');

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: testUser,
      ttl: '1h'
    });

    at.addGrant({
      roomJoin: true,
      room: testRoom,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = at.toJwt();

    res.json({
      success: true,
      token: token.substring(0, 50) + '...',
      url: LIVEKIT_URL,
      message: 'Token gerado com sucesso! Use /get-token para produção.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Status endpoint com configurações
app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    config: {
      port: PORT,
      frontendUrl: process.env.FRONTEND_URL,
      allowedOrigins: allowedOrigins.filter(origin => typeof origin === 'string'),
      corsEnabled: true,
      redisEnabled: !!process.env.REDIS_URL
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Health check endpoint (alias)
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Test API endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API está funcionando!',
    timestamp: Date.now(),
    origin: req.get('Origin') || 'no-origin',
    userAgent: req.get('User-Agent') || 'no-user-agent'
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Configurar porta
const PORT = process.env.PORT || 3001;

// Iniciar servidor - configurar para aceitar conexões de qualquer IP
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
  console.log(`🌐 Accessible at:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  console.log(`   - Network: http://192.168.18.17:${PORT}`);
  console.log(`📡 Socket.IO server ready`);
  console.log(`🌐 Allowed origins: ${JSON.stringify(allowedOrigins)}`);
  console.log(`💾 Redis: ${process.env.REDIS_URL ? 'Enabled' : 'Disabled'}`);
  console.log(`🎬 LiveKit Token Server: ${LIVEKIT_URL ? '✅ Ready at /get-token' : '⚠️ Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
