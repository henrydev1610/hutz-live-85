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
    try {
      // Verificar se Twilio está disponível no backend
      const response = await fetch(`${getBackendBaseURL()}/api/twilio/stats`);
      if (response.ok) {
        const data = await response.json();
        this.state.isEnabled = data.service?.initialized || false;
        console.log(`🎭 Twilio Service: ${this.state.isEnabled ? 'Enabled' : 'Disabled'}`);
      }
    } catch (error) {
      console.warn('⚠️ Twilio service initialization failed:', error);
      this.state.isEnabled = false;
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

  // Obter ICE servers do Twilio
  async getIceServers(): Promise<RTCIceServer[]> {
    if (!this.isTwilioEnabled()) {
      console.log('🚫 Twilio disabled, using fallback ICE servers');
      return this.getFallbackIceServers();
    }

    // Verificar cache
    if (this.state.cachedIceServers && this.isCacheValid(this.state.lastIceServersFetch)) {
      console.log('🔄 Using cached Twilio ICE servers');
      return this.state.cachedIceServers.iceServers;
    }

    try {
      const response = await fetch(`${getBackendBaseURL()}/api/twilio/ice-servers`);
      
      if (!response.ok) {
        throw new Error(`ICE servers request failed: ${response.status}`);
      }

      const data: TwilioIceServersResponse = await response.json();
      
      // Cache dos ICE servers
      this.state.cachedIceServers = data;
      this.state.lastIceServersFetch = Date.now();

      console.log(`✅ Twilio ICE servers fetched (${data.source})`);
      if (data.warning) {
        console.warn(`⚠️ ${data.warning}`);
      }

      return data.iceServers;

    } catch (error) {
      console.error('❌ Failed to fetch Twilio ICE servers:', error);
      console.log('🔄 Falling back to default ICE servers');
      return this.getFallbackIceServers();
    }
  }

  // ICE servers de fallback (Metered.ca + STUN)
  private getFallbackIceServers(): RTCIceServer[] {
    return [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      
      // Cloudflare STUN
      { urls: 'stun:stun.cloudflare.com:3478' },
      
      // Metered.ca TURN servers (backup)
      { 
        urls: 'turn:a.relay.metered.ca:80', 
        username: '76db9f87433b9f3e608e6e95', 
        credential: 'vFE0f16Bv6vF7aEF' 
      },
      { 
        urls: 'turn:a.relay.metered.ca:443', 
        username: '76db9f87433b9f3e608e6e95', 
        credential: 'vFE0f16Bv6vF7aEF' 
      },
      { 
        urls: 'turn:a.relay.metered.ca:80?transport=tcp', 
        username: '76db9f87433b9f3e608e6e95', 
        credential: 'vFE0f16Bv6vF7aEF' 
      },
      { 
        urls: 'turn:a.relay.metered.ca:443?transport=tcp', 
        username: '76db9f87433b9f3e608e6e95', 
        credential: 'vFE0f16Bv6vF7aEF' 
      }
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