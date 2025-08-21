const twilio = require('twilio');
const NodeCache = require('node-cache');

// Cache para tokens (TTL de 23 horas para forçar refresh antes do vencimento)
const tokenCache = new NodeCache({ stdTTL: 23 * 60 * 60 });

// Rate limiting simples por IP
const rateLimitCache = new NodeCache({ stdTTL: 60 }); // 1 minuto
const MAX_REQUESTS_PER_MINUTE = 10;

class TwilioTokenService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  // Inicializar cliente Twilio
  initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('⚠️ Twilio credentials not found. Token service will be disabled.');
      return false;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log('✅ Twilio Token Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Twilio client:', error);
      return false;
    }
  }

  // Verificar rate limiting
  checkRateLimit(clientIp) {
    const requests = rateLimitCache.get(clientIp) || 0;
    if (requests >= MAX_REQUESTS_PER_MINUTE) {
      return false;
    }
    rateLimitCache.set(clientIp, requests + 1);
    return true;
  }

  // Gerar token Twilio para WebRTC
  async generateToken(identity, roomName = null) {
    if (!this.initialized) {
      throw new Error('Twilio service not initialized');
    }

    const cacheKey = `token_${identity}_${roomName || 'default'}`;
    
    // Verificar cache primeiro
    const cachedToken = tokenCache.get(cacheKey);
    if (cachedToken) {
      console.log(`🔄 Returning cached Twilio token for ${identity}`);
      return cachedToken;
    }

    try {
      // Gerar token com TTL de 24 horas
      const token = new twilio.jwt.AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { ttl: 24 * 60 * 60 } // 24 horas
      );

      // Configurar identidade
      token.identity = identity;

      // Adicionar Video Grant se room for especificado
      if (roomName) {
        const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
          room: roomName
        });
        token.addGrant(videoGrant);
      }

      // Gerar token JWT
      const jwtToken = token.toJwt();

      // Cache do token
      const tokenData = {
        token: jwtToken,
        identity,
        roomName,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000),
        generatedAt: Date.now()
      };

      tokenCache.set(cacheKey, tokenData);
      console.log(`✅ Generated new Twilio token for ${identity}${roomName ? ` in room ${roomName}` : ''}`);

      return tokenData;

    } catch (error) {
      console.error('❌ Failed to generate Twilio token:', error);
      throw new Error('Token generation failed');
    }
  }

  // Obter configuração de ICE servers via Twilio Network Traversal Service
  async getIceServers() {
    if (!this.initialized) {
      console.warn('⚠️ Twilio not initialized, returning fallback ICE servers');
      return this.getFallbackIceServers();
    }

    const cacheKey = 'ice_servers';
    const cachedServers = tokenCache.get(cacheKey);
    
    if (cachedServers) {
      console.log('🔄 Returning cached ICE servers');
      return cachedServers;
    }

    try {
      // Gerar token para Network Traversal Service
      const token = new twilio.jwt.AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { ttl: 24 * 60 * 60 }
      );

      // Adicionar Video Grant para acessar ICE servers
      const videoGrant = new twilio.jwt.AccessToken.VideoGrant();
      token.addGrant(videoGrant);

      // Buscar ICE servers usando o SDK
      const iceServers = await this.client.tokens.create();

      const servers = {
        iceServers: iceServers.iceServers || this.getFallbackIceServers().iceServers,
        generatedAt: Date.now(),
        expiresAt: Date.now() + (23 * 60 * 60 * 1000) // 23 horas
      };

      // Cache por 23 horas
      tokenCache.set(cacheKey, servers, 23 * 60 * 60);
      console.log('✅ Generated fresh ICE servers from Twilio');

      return servers;

    } catch (error) {
      console.error('❌ Failed to get ICE servers from Twilio:', error);
      console.log('🔄 Falling back to default ICE servers');
      return this.getFallbackIceServers();
    }
  }

  // ICE servers de fallback
  getFallbackIceServers() {
    return {
      iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        
        // Cloudflare STUN
        { urls: 'stun:stun.cloudflare.com:3478' },
        
        // Manter Metered.ca como backup
        { 
          urls: 'turn:a.relay.metered.ca:80', 
          username: '76db9f87433b9f3e608e6e95', 
          credential: 'vFE0f16Bv6vF7aEF' 
        },
        { 
          urls: 'turn:a.relay.metered.ca:443', 
          username: '76db9f87433b9f3e608e6e95', 
          credential: 'vFE0f16Bv6vF7aEF' 
        }
      ],
      generatedAt: Date.now(),
      source: 'fallback'
    };
  }

  // Invalidar cache específico
  invalidateCache(identity = null, roomName = null) {
    if (identity) {
      const cacheKey = `token_${identity}_${roomName || 'default'}`;
      tokenCache.del(cacheKey);
    } else {
      tokenCache.flushAll();
    }
    console.log('🗑️ Token cache invalidated');
  }

  // Estatísticas do cache
  getCacheStats() {
    return {
      keys: tokenCache.keys().length,
      hits: tokenCache.getStats().hits,
      misses: tokenCache.getStats().misses,
      ksize: tokenCache.getStats().ksize,
      vsize: tokenCache.getStats().vsize
    };
  }
}

// Singleton instance
const twilioTokenService = new TwilioTokenService();

module.exports = twilioTokenService;