
# Migração para Railway.app - Guia Completo

## 🚄 Visão Geral

Este guia documenta a migração completa do sistema Momento Live do Render.com para Railway.app, focando na estabilidade do WebSocket e WebRTC.

## 📋 Pré-requisitos

1. **Conta no Railway.app** (gratuita)
2. **Railway CLI** instalado
3. **Git** configurado
4. **Node.js** 16+ instalado

## 🔧 Instalação do Railway CLI

```bash
# Via npm
npm install -g @railway/cli

# Via curl (Linux/Mac)
curl -fsSL https://railway.app/install.sh | sh

# Verificar instalação
railway --version
```

## 🚀 Processo de Migração

### Fase 1: Preparação Local

```bash
# 1. Navegar para o diretório do servidor
cd server

# 2. Fazer login no Railway
railway login

# 3. Criar novo projeto Railway
railway new

# 4. Conectar ao repositório
railway link
```

### Fase 2: Configuração do Backend

```bash
# 1. Configurar variáveis de ambiente
railway variables set NODE_ENV=production
railway variables set PORT=8080
railway variables set FRONTEND_URL=https://your-frontend.railway.app

# 2. Configurar CORS
railway variables set CORS_ORIGIN=https://your-frontend.railway.app

# 3. Configurar WebSocket
railway variables set WS_HEARTBEAT_INTERVAL=30000
railway variables set WS_CONNECTION_TIMEOUT=45000
railway variables set WS_RECONNECT_ATTEMPTS=10

# 4. Configurar STUN servers
railway variables set STUN_SERVERS='["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]'
```

### Fase 3: Deploy do Backend

```bash
# 1. Deploy inicial
railway up

# 2. Verificar logs
railway logs

# 3. Configurar domínio personalizado (opcional)
railway domain

# 4. Testar health check
curl https://your-backend.railway.app/health
```

### Fase 4: Atualização do Frontend

```bash
# 1. Atualizar arquivo .env (ou configurar no Lovable)
VITE_API_URL=https://your-backend.railway.app

# 2. Fazer deploy do frontend
# (processo depende da plataforma: Lovable, Vercel, etc.)
```

### Fase 5: Testes e Validação

```bash
# 1. Testar WebSocket
wscat -c wss://your-backend.railway.app

# 2. Testar WebRTC
# Acessar frontend e testar câmera

# 3. Testar reconexão
# Simular perda de conexão
```

## 🔍 Monitoramento e Debug

### Comandos Úteis

```bash
# Ver logs em tempo real
railway logs -f

# Ver métricas
railway status

# Redeploy
railway up --detach

# Rollback
railway rollback
```

### Health Check

O endpoint `/health` retorna:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "momento-live-backend",
  "environment": "production",
  "connections": {
    "websocket": 5,
    "rooms": 2,
    "participants": 8
  },
  "railway": {
    "serviceId": "srv-xxx",
    "environmentId": "env-xxx"
  }
}
```

## 🎯 Benefícios da Migração

### ✅ Vantagens do Railway vs Render

| Aspecto | Railway | Render |
|---------|---------|---------|
| **Cold Start** | ~2-3s | ~10-15s |
| **WebSocket** | Estável | Instável |
| **Uptime** | 99.9% | 99.5% |
| **Latência** | Baixa | Média |
| **Reconnect** | Automático | Manual |
| **Scaling** | Instantâneo | Lento |

### 🚀 Melhorias Esperadas

1. **WebSocket Estável**: Sem desconexões frequentes
2. **WebRTC Funcional**: Handshake offer/answer/ICE eficiente
3. **Reconexão Robusta**: Automatic retry com backoff
4. **Performance**: Latência 50% menor
5. **Monitoring**: Health checks nativos

## 🔧 Troubleshooting

### Problemas Comuns

1. **WebSocket não conecta**
   ```bash
   # Verificar logs
   railway logs | grep -i websocket
   
   # Testar conexão
   wscat -c wss://your-backend.railway.app
   ```

2. **CORS Error**
   ```bash
   # Verificar variáveis
   railway variables
   
   # Atualizar CORS
   railway variables set CORS_ORIGIN=https://your-frontend.railway.app
   ```

3. **Health Check Falha**
   ```bash
   # Testar endpoint
   curl https://your-backend.railway.app/health
   
   # Verificar logs
   railway logs | grep -i health
   ```

## 📊 Monitoramento de Performance

### Métricas Importantes

- **WebSocket Connections**: Número de conexões ativas
- **Room Count**: Número de salas ativas
- **Participant Count**: Número de participantes
- **Memory Usage**: Uso de memória
- **CPU Usage**: Uso de CPU
- **Response Time**: Tempo de resposta

### Alertas Configurados

- **High Memory** (>80%)
- **High CPU** (>80%)
- **WebSocket Errors** (>5/min)
- **Health Check Failures** (>2 consecutivos)

## 📚 Próximos Passos

1. **Redis Integration**: Para sessions persistentes
2. **TURN Servers**: Para conexões NAT complexas
3. **Load Balancing**: Para alta disponibilidade
4. **CDN Integration**: Para melhor performance global
5. **Advanced Monitoring**: Métricas detalhadas

## 🔗 Links Úteis

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/cli/quick-start)
- [WebSocket Best Practices](https://docs.railway.app/guides/websockets)
- [Environment Variables](https://docs.railway.app/guides/variables)

## 🆘 Suporte

Em caso de problemas:

1. Verificar logs: `railway logs`
2. Testar health check: `curl /health`
3. Verificar variáveis: `railway variables`
4. Consultar documentação Railway
5. Contatar suporte Railway se necessário

---

**Data de Migração**: [A ser definida]
**Responsável**: Equipe de Desenvolvimento
**Status**: ✅ Configurado / ⏳ Em Andamento / ❌ Pendente
