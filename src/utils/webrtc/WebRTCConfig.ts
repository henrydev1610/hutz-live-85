import { twilioWebRTCService } from '../../services/TwilioWebRTCService';

// Mantém ICE dinâmico aqui em memória (setado quando o backend envia via socket)
let dynamicIceServers: RTCIceServer[] | null = null;
let relayOnly = false;
let preferTwilio = true; // Feature flag para migração gradual

// Configuração de fallback robusta com STUN/TURN
const FALLBACK_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Cloudflare STUN (backup)
    { urls: 'stun:stun.cloudflare.com:3478' },

    // Metered TURN servers (atualizados)
  { urls: 'turn:a.relay.metered.ca:80', username: '76db9f87433b9f3e608e6e95', credential: 'vFE0f16Bv6vF7aEF' },
  { urls: 'turn:a.relay.metered.ca:443', username: '76db9f87433b9f3e608e6e95', credential: 'vFE0f16Bv6vF7aEF' },
  { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: '76db9f87433b9f3e608e6e95', credential: 'vFE0f16Bv6vF7aEF' },
  { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: '76db9f87433b9f3e608e6e95', credential: 'vFE0f16Bv6vF7aEF' }

  ],
  iceCandidatePoolSize: 10
};

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

// Use SEMPRE este getter na hora de criar o RTCPeerConnection
export async function getWebRTCConfig(): Promise<RTCConfiguration> {
  let iceServers: RTCIceServer[] = [];

  // Tentar buscar ICE servers do Twilio primeiro (se habilitado)
  if (preferTwilio && twilioWebRTCService.isTwilioEnabled()) {
    try {
      console.log('🎭 Attempting to use Twilio ICE servers...');
      iceServers = await twilioWebRTCService.getIceServers();
      console.log('✅ Using Twilio ICE servers');
    } catch (error) {
      console.warn('⚠️ Twilio ICE servers failed, falling back to dynamic/static:', error);
    }
  }

  // Fallback para ICE servers dinâmicos ou estáticos
  if (!iceServers.length) {
    iceServers = dynamicIceServers?.length ? dynamicIceServers : FALLBACK_CONFIG.iceServers;
    console.log('🔄 Using fallback ICE servers');
  }

  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: 10,
  };
  
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  
  return cfg;
}

// Alias para compatibilidade (agora async)
export async function getActiveWebRTCConfig(): Promise<RTCConfiguration> {
  return await getWebRTCConfig();
}

// Controles de feature flag
export function setTwilioPreference(enabled: boolean) {
  preferTwilio = enabled;
  twilioWebRTCService.enableTwilio(enabled);
  console.log(`🎛️ Twilio preference: ${enabled ? 'ON' : 'OFF'}`);
}

export function getTwilioPreference(): boolean {
  return preferTwilio && twilioWebRTCService.isTwilioEnabled();
}

// Caso queira forçar relay em algum cenário específico (ex.: ambiente Lovable)
export function useRelayOnly(enable = true) {
  relayOnly = enable;
}

// Para fluxos que exigem obrigatoriamente TURN (NAT extremo)
export async function getTurnOnlyConfig(): Promise<RTCConfiguration> {
  let iceServers: RTCIceServer[] = [];

  // Tentar Twilio primeiro para TURN-only
  if (preferTwilio && twilioWebRTCService.isTwilioEnabled()) {
    try {
      iceServers = await twilioWebRTCService.getIceServers();
      console.log('✅ Using Twilio TURN servers for relay-only config');
    } catch (error) {
      console.warn('⚠️ Twilio TURN failed, using fallback for relay-only:', error);
    }
  }

  if (!iceServers.length) {
    iceServers = dynamicIceServers ?? FALLBACK_CONFIG.iceServers;
  }

  return {
    iceServers,
    iceTransportPolicy: 'relay',
    iceCandidatePoolSize: 5,
  };
}

// Mantém os constraints no mesmo arquivo (sem alterações)
export const MEDIA_CONSTRAINTS = {
  video: { facingMode: 'user' },
  audio: true
};

// Helper de debug no console (agora async)
if (typeof window !== 'undefined') {
  (window as any).__webrtcCfg = async () => await getWebRTCConfig();
  (window as any).__twilioToggle = (enabled: boolean) => setTwilioPreference(enabled);
  (window as any).__twilioStatus = () => twilioWebRTCService.getServiceStats();
}