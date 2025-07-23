import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import roomsRouter from './routes/rooms.js';
import { initializeSocketHandlers } from './signaling/socket.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configurar CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:8080",
  "http://172.26.204.230:8080",
  "https://id-preview--f728da22-f48a-45b2-91e9-28492d654d7f.lovable.app",
  "https://server-hutz-live.onrender.com",
  "https://hutz-live-85.onrender.com",
  "https://server-hutz-live-production.up.railway.app",
  /^https:\/\/.*\.lovableproject\.com$/,
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/.*\.onrender\.com$/
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowedOrigin =>
      typeof allowedOrigin === 'string'
        ? origin === allowedOrigin
        : allowedOrigin.test(origin)
    );
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
  optionsSuccessStatus: 200
};

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO
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

// Redis adapter (opcional)
if (process.env.REDIS_URL) {
  try {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Redis adapter configured successfully');
  } catch (err) {
    console.warn('❌ Redis adapter configuration failed:', err);
  }
}

// Inicializar sinalização WebSocket
initializeSocketHandlers(io);

// Log de requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'no-origin'}`);
  next();
});

// Rotas
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
      status: '/status'
    }
  });
});

app.use('/api/rooms', roomsRouter);

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
      allowedOrigins: allowedOrigins.filter(o => typeof o === 'string'),
      corsEnabled: true,
      redisEnabled: !!process.env.REDIS_URL
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API está funcionando!',
    timestamp: Date.now(),
    origin: req.get('Origin') || 'no-origin',
    userAgent: req.get('User-Agent') || 'no-user-agent'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Porta e inicialização
const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
  console.log(`🌐 Accessible at: http://localhost:${PORT}`);
  console.log(`📡 Socket.IO server ready`);
  console.log(`🌐 Allowed origins: ${JSON.stringify(allowedOrigins)}`);
  console.log(`💾 Redis: ${process.env.REDIS_URL ? 'Enabled' : 'Disabled'}`);
});

// Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
