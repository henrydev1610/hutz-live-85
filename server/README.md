
# Momento Live - Backend

Backend da aplicação "Momento Live" - Sistema de transmissão ao vivo com WebRTC e Socket.IO.

## 🚀 Funcionalidades

- **Geração de Salas**: Criação automática de roomId e QR codes
- **Sinalização WebRTC**: Comunicação P2P entre participantes
- **Socket.IO**: Real-time messaging e eventos
- **Health Check**: Endpoint para monitoramento
- **STUN/TURN**: Suporte completo a servidores ICE
- **Redis**: Escalabilidade horizontal (opcional)
- **Segurança**: CORS, Helmet e validação de dados

## 📋 Pré-requisitos

- Node.js >= 16.0.0
- npm >= 8.0.0
- Redis (opcional, para escalabilidade)

## 🛠️ Instalação

```bash
# Clonar o repositório
cd server

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Iniciar em desenvolvimento
npm run dev

# Iniciar em produção
npm start
```

## ⚙️ Variáveis de Ambiente

### Obrigatórias

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
APP_DOMAIN=https://your-app-domain.com
```

### Opcionais

```env
# Servidores STUN/TURN
STUN_SERVERS=["stun:stun.l.google.com:19302"]
TURN_SERVERS=[{"urls": "turn:server.com:3478", "username": "user", "credential": "pass"}]

# Redis para escalabilidade
REDIS_URL=redis://localhost:6379
```

## 🔧 Configuração STUN/TURN

### Opção 1: Usar servidores públicos (desenvolvimento)

```env
STUN_SERVERS=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
```

### Opção 2: Coturn (produção)

1. **Instalar coturn**:
```bash
# Ubuntu/Debian
sudo apt-get install coturn

# CentOS/RHEL
sudo yum install coturn
```

2. **Configurar coturn** (`/etc/turnserver.conf`):
```conf
listening-port=3478
tls-listening-port=5349
external-ip=YOUR_SERVER_IP
realm=your-domain.com
server-name=your-domain.com
fingerprint
lt-cred-mech
user=coturn_user:coturn_password
```

3. **Iniciar coturn**:
```bash
sudo systemctl start coturn
sudo systemctl enable coturn
```

4. **Configurar no .env**:
```env
TURN_SERVERS=[{"urls": "turn:your-server.com:3478", "username": "coturn_user", "credential": "coturn_password"}]
```

### Opção 3: LiveKit Cloud

1. **Criar conta**: [LiveKit Cloud](https://cloud.livekit.io)

2. **Obter credenciais** no dashboard

3. **Configurar no .env**:
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_SECRET_KEY=your-secret-key
```

## 📡 API Endpoints

### POST /api/rooms
Cria uma nova sala de transmissão.

**Response:**
```json
{
  "roomId": "uuid-v4",
  "joinURL": "https://app.com/participant/uuid-v4",
  "qrDataUrl": "data:image/png;base64,..."
}
```

### GET /api/rooms/:roomId
Obtém informações de uma sala.

**Response:**
```json
{
  "roomId": "uuid-v4",
  "joinURL": "https://app.com/participant/uuid-v4",
  "isActive": true,
  "participantCount": 3,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /health
Health check do servidor.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "uptime": 3600
}
```

## 🔌 Socket.IO Events

### Cliente → Servidor

- `join-room` - Entrar na sala
- `offer` - Enviar oferta WebRTC
- `answer` - Enviar resposta WebRTC
- `ice` - Enviar candidato ICE
- `heartbeat` - Keep-alive
- `leave-room` - Sair da sala

### Servidor → Cliente

- `user-connected` - Usuário conectado
- `user-disconnected` - Usuário desconectado
- `user-heartbeat` - Heartbeat de usuário
- `offer` - Receber oferta WebRTC
- `answer` - Receber resposta WebRTC
- `ice` - Receber candidato ICE
- `ice-servers` - Configuração STUN/TURN
- `room-participants` - Lista de participantes
- `error` - Erro

## 🏗️ Arquitetura

```
server/
├── index.js              # Servidor principal
├── routes/
│   └── rooms.js         # Rotas das salas
├── signaling/
│   └── socket.js        # Lógica Socket.IO
├── services/
│   └── qr.js           # Geração QR codes
├── package.json
├── .env.example
└── README.md
```

## 🚀 Deploy

### Heroku

```bash
# Fazer login no Heroku
heroku login

# Criar app
heroku create momento-live-backend

# Configurar variáveis
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://your-frontend.com
heroku config:set APP_DOMAIN=https://your-frontend.com

# Deploy
git push heroku main
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Railway/Render

1. Conectar repositório
2. Configurar variáveis de ambiente
3. Deploy automático

## 🔍 Monitoramento

### Logs
```bash
# Desenvolvimento
npm run dev

# Produção
pm2 start index.js --name "momento-live"
pm2 logs momento-live
```

### Métricas
- Conexões ativas: Log a cada minuto
- Salas ativas: Endpoint `/health`
- Uptime: Endpoint `/health`

## 🐛 Troubleshooting

### Problema: Participantes não conectam

1. **Verificar CORS**:
```env
FRONTEND_URL=https://correct-frontend-url.com
```

2. **Verificar STUN/TURN**:
```bash
# Testar conectividade STUN
npx stun-test stun.l.google.com:19302
```

3. **Verificar firewall**:
```bash
# Abrir portas necessárias
sudo ufw allow 3001/tcp
sudo ufw allow 3478/tcp  # TURN
```

### Problema: WebRTC não conecta

1. **Verificar servidores ICE**
2. **Testar TURN server**
3. **Verificar NAT/firewall**

### Problema: Múltiplas instâncias

1. **Configurar Redis**:
```env
REDIS_URL=redis://localhost:6379
```

2. **Instalar adapter**:
```bash
npm install @socket.io/redis-adapter redis
```

## 🤝 Contribuição

1. Fork o projeto
2. Criar branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit (`git commit -m 'Adicionar nova funcionalidade'`)
4. Push (`git push origin feature/nova-funcionalidade`)
5. Pull Request

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- **Issues**: [GitHub Issues](https://github.com/seu-repo/issues)
- **Documentação**: [Wiki](https://github.com/seu-repo/wiki)
- **Discord**: [Comunidade](https://discord.gg/seu-discord)
