import { twilioWebRTCService } from '../../services/TwilioWebRTCService';
import { getBackendBaseURL } from '@/utils/connectionUtils';

// MIGRAÇÃO 100% TWILIO - Configuração principal com TURN hardcoded
let dynamicIceServers: RTCIceServer[] | null = null;
let relayOnly = false;
let forceTwilioOnly = true; // 🎯 MIGRAÇÃO: Forçar APENAS Twilio

// 🎯 FASE 2: Credenciais TURN hardcoded PRINCIPAIS (não fallback)
const HARDCODED_TURN_SERVERS: RTCIceServer[] = [
  // Twilio STUN
  {
    urls: 'stun:global.stun.twilio.com:3478'
  },
  // Twilio TURN UDP 
  {
    credential: 'wZcIQonQHjmSdjbXOYD5s7NN+ELMKW61UVyZQigiem4=',
    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
    username: '07ca22aa27ab7cd941eff000d059e2c5c2a386a82c64f428817817044f515d80'
  },
  // Twilio TURN TCP porta 3478
  {
    credential: 'wZcIQonQHjmSdjbXOYD5s7NN+ELMKW61UVyZQigiem4=',
    urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
    username: '07ca22aa27ab7cd941eff000d059e2c5c2a386a82c64f428817817044f515d80'
  },
  // Twilio TURN TCP porta 443 (para redes restritivas)
  {
    credential: 'wZcIQonQHjmSdjbXOYD5s7NN+ELMKW61UVyZQigiem4=',
    urls: 'turn:global.turn.twilio.com:443?transport=tcp',
    username: '07ca22aa27ab7cd941eff000d059e2c5c2a386a82c64f428817817044f515d80'
  }
];

// Configuração STUN-only para emergência absoluta
const STUN_ONLY_FALLBACK: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free) - apenas para emergência
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Cloudflare STUN (backup)  
    { urls: 'stun:stun.cloudflare.com:3478' }
    
    // 🚫 REMOVIDO: Metered.ca TURN servers (migração 100% Twilio)
  ],
  iceCandidatePoolSize: 10
};

// 🎯 FASE 2: Função para obter TURN servers hardcoded (para TurnConnectivityService)
export function getHardcodedTurnServers(): RTCIceServer[] {
  console.log('🧊 [HARDCODED] Returning hardcoded TURN servers:', HARDCODED_TURN_SERVERS.length);
  return [...HARDCODED_TURN_SERVERS]; // Clone para evitar mutação
}

// Chame isso ao receber `ice-servers` do backend
export function setDynamicIceServers(servers: RTCIceServer[], opts?: { relayOnly?: boolean }) {
  if (Array.isArray(servers) && servers.length) {
    dynamicIceServers = servers;
    console.log('🧊 [WRTC] ICE servers dinâmicos aplicados:',
      servers.map(s => ({ urls: s.urls, username: (s as any).username, hasCredential: !!(s as any).credential }))
    );
  } else {
    console.warn('🧊 [WRTC] ICE servers inválidos recebidos; mantendo fallback');
    dynamicIceServers = null;
  }
  if (typeof opts?.relayOnly === 'boolean') relayOnly = !!opts.relayOnly;
}

// 🎯 FASE 2: MIGRAÇÃO 100% TWILIO - Configuração com TURN hardcoded
export async function getWebRTCConfig(): Promise<RTCConfiguration> {
  console.log('🌐 TWILIO-HYBRID: Starting WebRTC config with TURN fallback...');
  
  let iceServers: RTCIceServer[] = [];
  let usingTwilio = false;

  // 🎯 FASE 1: TENTAR TWILIO PRIMEIRO
  if (forceTwilioOnly) {
    try {
      console.log('🌐 TWILIO: Fetching ICE servers (hybrid mode with TURN fallback)...');
      
      // Verificar se Twilio está inicializado
      if (!twilioWebRTCService.isTwilioEnabled()) {
        console.warn('⚠️ TWILIO: Service not initialized, enabling Twilio...');
        twilioWebRTCService.enableTwilio(true);
      }
      
      iceServers = await twilioWebRTCService.getIceServers();
      
      if (iceServers && iceServers.length > 0) {
        // Filtrar para verificar se tem TURN servers
        const turnServers = iceServers.filter(server => 
          Array.isArray(server.urls) 
            ? server.urls.some(url => url.startsWith('turn:'))
            : typeof server.urls === 'string' && server.urls.startsWith('turn:')
        );
        
        if (turnServers.length > 0) {
          console.log('✅ TWILIO: Successfully retrieved ICE servers with TURN:', turnServers.length);
          usingTwilio = true;
        } else {
          console.warn('⚠️ TWILIO: No TURN servers found in response, using hardcoded fallback');
        }
      }
    } catch (error) {
      console.error('🚨 TWILIO: Failed to get ICE servers:', error);
    }
  }

  // 🎯 FASE 2: Se Twilio falhar OU não tiver TURN, usar TURN hardcoded
  if (!usingTwilio) {
    console.log('🧊 HARDCODED: Using hardcoded TURN servers as primary fallback');
    iceServers = HARDCODED_TURN_SERVERS;
  }

  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: usingTwilio ? 15 : 10, // Pool otimizado para TURN
  };
  
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  
  console.log(`🎯 WEBRTC CONFIG: ${usingTwilio ? 'Twilio' : 'Hardcoded-TURN'} | Servers: ${iceServers.length}`);
  
  // Debug: Mostrar tipos de servidores
  const stunCount = iceServers.filter(s => 
    Array.isArray(s.urls) ? s.urls.some(url => url.startsWith('stun:')) : s.urls.startsWith('stun:')
  ).length;
  const turnCount = iceServers.filter(s => 
    Array.isArray(s.urls) ? s.urls.some(url => url.startsWith('turn:')) : s.urls.startsWith('turn:')
  ).length;
  
  console.log(`🎯 WEBRTC DEBUG: STUN: ${stunCount}, TURN: ${turnCount}`);
  
  return cfg;
}

// Alias para compatibilidade (agora async)
export async function getActiveWebRTCConfig(): Promise<RTCConfiguration> {
  return await getWebRTCConfig();
}

// Controles de feature flag
export function setTwilioPreference(enabled: boolean) {
  forceTwilioOnly = enabled;
  twilioWebRTCService.enableTwilio(enabled);
  console.log(`🎛️ Twilio preference: ${enabled ? 'ON' : 'OFF'}`);
}

export function getTwilioPreference(): boolean {
  return forceTwilioOnly && twilioWebRTCService.isTwilioEnabled();
}

// Caso queira forçar relay em algum cenário específico (ex.: ambiente Lovable)
export function useRelayOnly(enable = true) {
  relayOnly = enable;
}

// 🎯 FASE 2: Para fluxos que exigem obrigatoriamente TURN (NAT extremo) 
export async function getTurnOnlyConfig(): Promise<RTCConfiguration> {
  console.log('🎯 TURN-ONLY: Using hardcoded TURN for relay-only configuration...');
  
  // Tentar buscar do Twilio primeiro
  try {
    const twilioServers = await twilioWebRTCService.getIceServers();
    if (twilioServers && twilioServers.length > 0) {
      // Filtrar apenas TURN servers
      const turnOnly = twilioServers.filter(server => 
        Array.isArray(server.urls) 
          ? server.urls.some(url => url.startsWith('turn:'))
          : typeof server.urls === 'string' && server.urls.startsWith('turn:')
      );
      
      if (turnOnly.length > 0) {
        console.log('✅ TURN-ONLY: Using Twilio TURN servers:', turnOnly.length);
        return {
          iceServers: turnOnly,
          iceTransportPolicy: 'relay',
          iceCandidatePoolSize: 10,
        };
      }
    }
  } catch (error) {
    console.warn('⚠️ TWILIO TURN failed, using hardcoded TURN:', error);
  }

  // Fallback: usar TURN hardcoded (sem STUN)
  const turnOnlyHardcoded = HARDCODED_TURN_SERVERS.filter(server => 
    Array.isArray(server.urls) 
      ? server.urls.some(url => url.startsWith('turn:'))
      : typeof server.urls === 'string' && server.urls.startsWith('turn:')
  );
  
  console.log('🧊 TURN-ONLY: Using hardcoded TURN servers:', turnOnlyHardcoded.length);
  
  return {
    iceServers: turnOnlyHardcoded,
    iceTransportPolicy: 'relay',
    iceCandidatePoolSize: 10,
  };
}

// Mantém os constraints no mesmo arquivo (sem alterações)
export const MEDIA_CONSTRAINTS = {
  video: { facingMode: 'user' },
  audio: true
};

  // Debug commands para migração 100% Twilio
  if (typeof window !== 'undefined') {
    (window as any).__webrtcCfg = async () => await getWebRTCConfig();
    (window as any).__twilioToggle = (enabled: boolean) => setTwilioPreference(enabled);
    (window as any).__twilioStatus = () => twilioWebRTCService.getServiceStats();
    
    // TURN Connectivity Debug Commands
    (window as any).__turnTest = async () => {
      console.log('🧊 TESTING TURN connectivity...');
      const { turnConnectivityService } = await import('@/services/TurnConnectivityService');
      return await turnConnectivityService.forceRefresh();
    };
    (window as any).__turnStatus = async () => {
      const { turnConnectivityService } = await import('@/services/TurnConnectivityService');
      return turnConnectivityService.getLastDiagnostic();
    };
    (window as any).__turnHealth = async () => {
      const { turnConnectivityService } = await import('@/services/TurnConnectivityService');
      return {
        isHealthy: turnConnectivityService.isHealthy(),
        workingServers: turnConnectivityService.getWorkingServerCount(),
        lastDiagnostic: turnConnectivityService.getLastDiagnostic()
      };
    };
    (window as any).__twilioTest = async () => {
      console.log('🧪 TESTING Twilio migration...');
      const config = await getWebRTCConfig();
      const stats = twilioWebRTCService.getServiceStats();
      const diagnostic = await twilioWebRTCService.runConnectivityDiagnostic();
      
      return {
        webrtcConfig: config,
        twilioStats: stats,
        connectivityDiagnostic: diagnostic,
        migrationMode: forceTwilioOnly
      };
    };
    (window as any).__forceTwilioRefresh = async () => {
      console.log('🔄 Forcing Twilio cache refresh...');
      await twilioWebRTCService.refreshCache();
      return await twilioWebRTCService.getServiceStats();
    };
    (window as any).__twilioCredentialTest = async () => {
      console.log('🧪 TESTING Twilio credentials via backend...');
      try {
        const response = await fetch(`${getBackendBaseURL()}/api/twilio-test/credentials`);
        const data = await response.json();
        
        console.log('📋 CREDENTIAL TEST REPORT:', data.report);
        return data.report;
      } catch (error) {
        console.error('❌ Credential test failed:', error);
        return { error: error.message };
      }
    };
    (window as any).__twilioReset = async () => {
      console.log('🔄 Resetting Twilio service...');
      try {
        const response = await fetch(`${getBackendBaseURL()}/api/twilio-test/reset`, { method: 'POST' });
        const data = await response.json();
        
        console.log('🔄 Reset result:', data);
        
        // Também resetar o frontend
        await twilioWebRTCService.refreshCache();
        
        return data;
      } catch (error) {
        console.error('❌ Reset failed:', error);
        return { error: error.message };
      }
    };
  }