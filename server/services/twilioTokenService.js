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
    console.log('🚀 TWILIO: Starting Twilio Token Service initialization...');
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    console.log('🔍 TWILIO CREDENTIALS CHECK:');
    console.log(`   Account SID: ${accountSid ? '✅ Found' : '❌ Missing'}`);
    console.log(`   Auth Token: ${authToken ? '✅ Found' : '❌ Missing'}`);
    console.log(`   API Key: ${apiKey ? '✅ Found' : '❌ Missing'}`);
    console.log(`   API Secret: ${apiSecret ? '✅ Found' : '❌ Missing'}`);

    if (!accountSid || !authToken) {
      console.error('❌ TWILIO: Missing basic credentials (Account SID or Auth Token)');
      console.error('🔧 TWILIO: Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to server/.env');
      return false;
    }

    if (!apiKey || !apiSecret) {
      console.error('❌ TWILIO: Missing API credentials (API Key or API Secret)');
      console.error('🔧 TWILIO: Add TWILIO_API_KEY and TWILIO_API_SECRET to server/.env');
      return false;
    }

    try {
      console.log('🔧 TWILIO: Creating Twilio client...');
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log('✅ TWILIO: Token Service initialized successfully');
      console.log('🎯 TWILIO: Ready to generate tokens and ICE servers');
      return true;
    } catch (error) {
      console.error('❌ TWILIO: Failed to initialize client:', error.message);
      console.error('🔧 TWILIO: Check if credentials are valid');
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
    console.log('🌐 TWILIO: Starting ICE server retrieval...');
    
    if (!this.initialized) {
      console.warn('⚠️ TWILIO: Service not initialized, returning fallback ICE servers');
      console.warn('🔧 TWILIO: Check credentials and initialization logs above');
      return this.getFallbackIceServers();
    }

    const cacheKey = 'ice_servers';
    const cachedServers = tokenCache.get(cacheKey);
    
    if (cachedServers) {
      console.log('🔄 TWILIO: Returning cached ICE servers');
      return cachedServers;
    }

    try {
      console.log('🌐 TWILIO: Generating fresh ICE servers via Network Traversal Service...');
      console.log('🔑 TWILIO: Using credentials:', {
        accountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...',
        authToken: process.env.TWILIO_AUTH_TOKEN ? 'Present' : 'Missing'
      });
      
      // Fazer requisição direta para o Network Traversal Service
      const https = require('https');
      const querystring = require('querystring');
      
      const postData = querystring.stringify({
        ttl: 86400 // 24 horas em segundos
      });
      
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const options = {
        hostname: 'stun.twilio.com',
        port: 443,
        path: '/v1/Tokens',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Basic ${auth}`
        }
      };

      console.log('📡 TWILIO: Making request to Network Traversal Service...');
      console.log('🔗 TWILIO: URL: https://stun.twilio.com/v1/Tokens');
      
      const iceServerResponse = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          
          console.log('📊 TWILIO: Response status:', res.statusCode);
          console.log('📊 TWILIO: Response headers:', res.headers);
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed);
              } catch (parseError) {
                console.error('❌ TWILIO: Failed to parse response:', parseError);
                reject(parseError);
              }
            } else {
              console.error('❌ TWILIO: HTTP error:', res.statusCode, data);
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });
        
        req.on('error', (error) => {
          console.error('❌ TWILIO: Request error:', error);
          reject(error);
        });
        
        req.write(postData);
        req.end();
      });
      
      console.log('🔍 TWILIO: ICE server response received:', {
        hasIceServers: !!(iceServerResponse.ice_servers),
        serverCount: iceServerResponse.ice_servers ? iceServerResponse.ice_servers.length : 0,
        dateCreated: iceServerResponse.date_created,
        ttl: iceServerResponse.ttl,
        username: iceServerResponse.username,
        password: iceServerResponse.password ? 'Present' : 'Missing'
      });

      // Transformar resposta para formato padrão WebRTC
      const iceServers = iceServerResponse.ice_servers || [];
      
      console.log('🔍 TWILIO: Raw ICE servers:', iceServers);

      const servers = {
        iceServers: iceServers,
        generatedAt: Date.now(),
        expiresAt: Date.now() + (23 * 60 * 60 * 1000), // 23 horas
        source: 'twilio'
      };

      // Cache por 23 horas
      tokenCache.set(cacheKey, servers, 23 * 60 * 60);
      
      console.log('✅ TWILIO: Generated fresh ICE servers successfully', {
        count: servers.iceServers.length,
        types: servers.iceServers.map(server => ({ 
          urls: Array.isArray(server.urls) ? server.urls : [server.urls], 
          hasCredential: !!(server.credential),
          username: server.username || 'N/A'
        }))
      });

      return servers;

    } catch (error) {
      console.error('❌ TWILIO: Failed to get ICE servers:', error.message);
      console.error('🔧 TWILIO: Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n')[0]
      });
      console.log('🔄 TWILIO: Falling back to default ICE servers');
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