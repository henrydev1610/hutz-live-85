
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const roomsRouter = require('./routes/rooms');
const { initializeSocketHandlers } = require('./signaling/socket');

// Carregar variáveis de ambiente
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configurar CORS com múltiplos origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:8080", // Lovable preview
  "https://id-preview--f728da22-f48a-45b2-91e9-28492d654d7f.lovable.app", // Lovable staging
  /^https:\/\/.*\.lovableproject\.com$/, // Qualquer subdomínio lovableproject.com
  /^https:\/\/.*\.lovable\.app$/, // Qualquer subdomínio lovable.app
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/ // UUIDs do Lovable
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (aplicações mobile, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Verificar se o origin está na lista permitida
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // Para suportar browsers legados
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

// Configurar Socket.IO com os mesmos origins
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

// Rotas da API
app.use('/api/rooms', roomsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0'
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

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready`);
  console.log(`🌐 Allowed origins: ${JSON.stringify(allowedOrigins)}`);
  console.log(`💾 Redis: ${process.env.REDIS_URL ? 'Enabled' : 'Disabled'}`);
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
