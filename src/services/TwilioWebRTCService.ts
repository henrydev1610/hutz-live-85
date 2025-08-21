import { getBackendBaseURL } from '@/utils/connectionUtils';

// Interfaces para Twilio
interface TwilioTokenResponse {
  success: boolean;
  token: string;
  identity: string;
  roomName: string | null;
  expiresAt: number;
  generatedAt: number;
}

interface TwilioIceServersResponse {
  success: boolean;
  iceServers: RTCIceServer[];
  generatedAt: number;
  expiresAt?: number;
  source: 'twilio' | 'fallback';
  warning?: string;
}

interface TwilioServiceState {
  isEnabled: boolean;
  lastTokenFetch: number;
  lastIceServersFetch: number;
  cachedToken: TwilioTokenResponse | null;
  cachedIceServers: TwilioIceServersResponse | null;
  featureFlag: boolean;
}

class TwilioWebRTCService {
  private state: TwilioServiceState = {
    isEnabled: false,
    lastTokenFetch: 0,
    lastIceServersFetch: 0,
    cachedToken: null,
    cachedIceServers: null,
    featureFlag: true // Feature flag para alternar Twilio/Metered.ca
  };

  private readonly CACHE_DURATION = 23 * 60 * 60 * 1000; // 23 horas
  private readonly TOKEN_REFRESH_THRESHOLD = 60 * 60 * 1000; // 1 hora antes do vencimento

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    const maxRetries = 3;
    let attempt = 0;
    
    console.log('🚀 TWILIO: Starting frontend service initialization...');
    console.log(`🔗 TWILIO: Backend URL: ${getBackendBaseURL()}`);
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🌐 TWILIO: Initialization attempt ${attempt}/${maxRetries}...`);
        
        // FASE 2: Verificação mais robusta de credenciais Twilio
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
        try {
          // Teste de conectividade básica primeiro
          const healthCheck = await fetch(`${getBackendBaseURL()}/health`, { 
            method: 'GET',
            signal: controller.signal
          });
          if (!healthCheck.ok) {
            throw new Error(`Backend health check failed: ${healthCheck.status}`);
          }
          console.log('✅ TWILIO: Backend is accessible');
          
          // Verificar se credenciais Twilio estão configuradas
          const credentialCheck = await fetch(`${getBackendBaseURL()}/api/twilio-test/credentials`, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Origin': window.location.origin
            },
            signal: controller.signal
          });
          
          if (credentialCheck.ok) {
            const credData = await credentialCheck.json();
            console.log('🔑 TWILIO: Credential check result:', credData.report);
            
            if (!credData.report?.validCredentials) {
              console.warn('⚠️ TWILIO: Invalid credentials detected - service may be limited');
            }
          }
          
          // Verificar status do serviço
          const response = await fetch(`${getBackendBaseURL()}/api/twilio/stats`, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Origin': window.location.origin
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            this.state.isEnabled = data.service?.initialized || false;
            
            console.log(`✅ TWILIO: Service initialized - ${this.state.isEnabled ? 'ENABLED' : 'DISABLED'}`, {
              attempt: attempt,
              backendInitialized: data.service?.initialized,
              uptime: data.uptime,
              environment: data.environment,
              cache: data.cache
            });
            
            // FASE 2: Log detalhado sobre estado das credenciais
            if (!this.state.isEnabled) {
              console.warn('⚠️ TWILIO: Backend service not initialized');
              console.warn('🔧 TWILIO: Check server/.env for valid Twilio credentials:');
              console.warn('   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxx');
              console.warn('   TWILIO_AUTH_TOKEN=xxxxxxxxxx');
              console.warn('   TWILIO_API_KEY=SKxxxxxxxxxx');
              console.warn('   TWILIO_API_SECRET=xxxxxxxxxx');
              console.warn('📋 TWILIO: Check server console for credential validation errors');
            } else {
              console.log('🎯 TWILIO: Service ready for token generation and ICE servers');
              
              // FASE 2: Teste imediato de ICE servers para validação
              try {
                const testServers = await this.getIceServers();
                console.log(`✅ TWILIO: ICE servers test successful - ${testServers.length} servers available`);
              } catch (testError) {
                console.warn('⚠️ TWILIO: ICE servers test failed:', testError);
              }
            }
            
            return; // Sucesso!
          } else {
            const errorText = await response.text();
            throw new Error(`Backend stats failed: HTTP ${response.status} ${response.statusText} - ${errorText}`);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error(`🚨 TWILIO: Initialization attempt ${attempt} failed:`, error);
        
        if (error.name === 'AbortError') {
          console.error('⏰ TWILIO: Request timeout - backend may be down or slow');
        } else if (error.message.includes('Failed to fetch')) {
          console.error('🌐 TWILIO: Network error - check backend URL and CORS');
          console.error(`🔗 TWILIO: Backend URL: ${getBackendBaseURL()}`);
          console.error('🔧 TWILIO: Ensure server is running and accessible');
        } else if (error.message.includes('health check failed')) {
          console.error('🚨 TWILIO: Backend is not responding to health checks');
        } else if (error.message.includes('credentials')) {
          console.error('🔑 TWILIO: Credential validation failed - check server/.env');
        }
        
        if (attempt >= maxRetries) {
          console.error('❌ TWILIO: All initialization attempts failed - service disabled');
          console.error('🔧 TWILIO: Troubleshooting steps:');
          console.error('   1. Check if backend server is running on port 3001');
          console.error('   2. Verify backend URL in environment variables');
          console.error('   3. Check CORS configuration');
          console.error('   4. Verify ALL Twilio credentials in server/.env');
          console.error('   5. Check server logs for specific errors');
          this.state.isEnabled = false;
          return;
        }
        
        // Backoff exponencial
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`⏳ TWILIO: Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Feature flag control
  enableTwilio(enable: boolean = true) {
    this.state.featureFlag = enable;
    console.log(`🎛️ Twilio feature flag: ${enable ? 'ON' : 'OFF'}`);
  }

  isTwilioEnabled(): boolean {
    return this.state.isEnabled && this.state.featureFlag;
  }

  // Gerar token Twilio para identidade específica
  async generateToken(identity: string, roomName?: string): Promise<TwilioTokenResponse | null> {
    if (!this.isTwilioEnabled()) {
      console.log('🚫 Twilio disabled, skipping token generation');
      return null;
    }

    const cacheKey = `${identity}_${roomName || 'default'}`;
    
    // Verificar cache
    if (this.state.cachedToken && this.isCacheValid(this.state.lastTokenFetch)) {
      console.log('🔄 Using cached Twilio token');
      return this.state.cachedToken;
    }

    try {
      const response = await fetch(`${getBackendBaseURL()}/api/twilio/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity, roomName })
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const tokenData: TwilioTokenResponse = await response.json();
      
      // Cache do token
      this.state.cachedToken = tokenData;
      this.state.lastTokenFetch = Date.now();

      console.log(`✅ Twilio token generated for ${identity}`);
      return tokenData;

    } catch (error) {
      console.error('❌ Failed to generate Twilio token:', error);
      return null;
    }
  }

  // Obter ICE servers do Twilio - Versão aprimorada para migração 100%
  async getIceServers(): Promise<RTCIceServer[]> {
    console.log('🌐 TWILIO: Attempting to get ICE servers (migration mode)...');
    
    if (!this.isTwilioEnabled()) {
      console.warn('🚫 TWILIO: Service disabled, using STUN-only fallback');
      return this.getFallbackIceServers();
    }

    // Verificar cache
    if (this.state.cachedIceServers && this.isCacheValid(this.state.lastIceServersFetch)) {
      console.log('🔄 Using cached Twilio ICE servers');
      return this.state.cachedIceServers.iceServers;
    }

    try {
      console.log('🌐 TWILIO: Fetching fresh ICE servers from backend...');
      
      // Timeout mais robusto para a migração
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(`${getBackendBaseURL()}/api/twilio/ice-servers`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ICE servers request failed: HTTP ${response.status} ${response.statusText}`);
      }

      const data: TwilioIceServersResponse = await response.json();
      
      if (!data.success || !data.iceServers || !Array.isArray(data.iceServers) || data.iceServers.length === 0) {
        throw new Error(`Invalid Twilio ICE servers response: ${JSON.stringify(data)}`);
      }
      
      // Cache dos ICE servers
      this.state.cachedIceServers = data;
      this.state.lastIceServersFetch = Date.now();

      console.log(`✅ TWILIO: ICE servers retrieved successfully (${data.source})`, {
        count: data.iceServers.length,
        servers: data.iceServers.map(s => ({ 
          urls: s.urls, 
          hasCredential: !!(s as any).credential 
        }))
      });
      
      if (data.warning) {
        console.warn(`⚠️ TWILIO WARNING: ${data.warning}`);
      }

      return data.iceServers;

    } catch (error) {
      console.error('🚨 TWILIO: Failed to fetch ICE servers:', error);
      console.log('🚨 FALLBACK: Using STUN-only servers');
      return this.getFallbackIceServers();
    }
  }

  // ICE servers de fallback - STUN APENAS (Migração 100% Twilio)
  private getFallbackIceServers(): RTCIceServer[] {
    console.log('🚨 FALLBACK: Using STUN-only servers (Twilio migration mode)');
    return [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      
      // Cloudflare STUN
      { urls: 'stun:stun.cloudflare.com:3478' }
      
      // 🚫 REMOVIDO: Metered.ca TURN servers (migração 100% Twilio)
      // Apenas Twilio deve fornecer TURN servers
    ];
  }

  // Verificar se cache é válido
  private isCacheValid(lastFetch: number): boolean {
    return (Date.now() - lastFetch) < this.CACHE_DURATION;
  }

  // Verificar se token precisa ser renovado
  shouldRefreshToken(): boolean {
    if (!this.state.cachedToken) return true;
    
    const timeUntilExpiry = this.state.cachedToken.expiresAt - Date.now();
    return timeUntilExpiry < this.TOKEN_REFRESH_THRESHOLD;
  }

  // Forçar atualização do cache
  async refreshCache(identity?: string, roomName?: string) {
    console.log('🔄 Forcing cache refresh...');
    
    // Limpar cache
    this.state.cachedToken = null;
    this.state.cachedIceServers = null;
    this.state.lastTokenFetch = 0;
    this.state.lastIceServersFetch = 0;

    // Buscar novos dados
    const promises: Promise<any>[] = [this.getIceServers()];
    
    if (identity) {
      promises.push(this.generateToken(identity, roomName));
    }

    await Promise.allSettled(promises);
    console.log('✅ Cache refresh completed');
  }

  // Limpar cache específico (útil para desenvolvimento)
  async clearBackendCache(identity?: string, roomName?: string) {
    if (!this.isTwilioEnabled()) return;

    try {
      const params = new URLSearchParams();
      if (identity) params.set('identity', identity);
      if (roomName) params.set('roomName', roomName);

      await fetch(`${getBackendBaseURL()}/api/twilio/cache?${params}`, {
        method: 'DELETE'
      });
      
      console.log('🗑️ Backend cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear backend cache:', error);
    }
  }

  // Estatísticas do serviço
  getServiceStats() {
    return {
      enabled: this.state.isEnabled,
      featureFlag: this.state.featureFlag,
      tokenCached: !!this.state.cachedToken,
      iceServersCached: !!this.state.cachedIceServers,
      lastTokenFetch: this.state.lastTokenFetch,
      lastIceServersFetch: this.state.lastIceServersFetch,
      tokenValid: this.state.cachedToken ? !this.shouldRefreshToken() : false
    };
  }

  // Diagnóstico de conectividade (integração com TurnConnectivityService)
  async runConnectivityDiagnostic(): Promise<{ 
    twilio: boolean; 
    fallback: boolean; 
    preferredSource: 'twilio' | 'fallback' 
  }> {
    const results = {
      twilio: false,
      fallback: false,
      preferredSource: 'fallback' as 'twilio' | 'fallback'
    };

    try {
      // Testar ICE servers do Twilio
      if (this.isTwilioEnabled()) {
        const twilioServers = await this.getIceServers();
        results.twilio = twilioServers.length > 0;
      }

      // Testar fallback
      const fallbackServers = this.getFallbackIceServers();
      results.fallback = fallbackServers.length > 0;

      // Determinar fonte preferida
      if (results.twilio && this.isTwilioEnabled()) {
        results.preferredSource = 'twilio';
      } else {
        results.preferredSource = 'fallback';
      }

      console.log('🔍 Connectivity diagnostic:', results);
      return results;

    } catch (error) {
      console.error('❌ Connectivity diagnostic failed:', error);
      return results;
    }
  }
}

// Singleton instance
export const twilioWebRTCService = new TwilioWebRTCService();

// Expor para debugging global
if (typeof window !== 'undefined') {
  (window as any).__twilioService = twilioWebRTCService;
}