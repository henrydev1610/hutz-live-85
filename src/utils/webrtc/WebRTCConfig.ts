// Mantém ICE dinâmico aqui em memória (setado quando o backend envia via socket)
let dynamicIceServers: RTCIceServer[] | null = null;
let relayOnly = false;

// FASE 4: Configuração robusta com STUN + TURN obrigatório da Metered
const FALLBACK_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers para descoberta de IP público
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    
    // TURN servers da Metered - incluindo TURNS:443 para redes corporativas
    { 
      urls: [
        'turn:global.relay.metered.ca:80',
        'turn:global.relay.metered.ca:80?transport=tcp',
        'turn:global.relay.metered.ca:443',
        'turns:global.relay.metered.ca:443?transport=tcp'
      ],
      username: 'efbe93b26df40b1695c64eb3',
      credential: 'xTYCNBdjZqQDcjDz'
    }
  ],
  iceCandidatePoolSize: 10 // Aumentado para melhor conectividade
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
export function getWebRTCConfig(): RTCConfiguration {
  const iceServers = dynamicIceServers?.length ? dynamicIceServers : FALLBACK_CONFIG.iceServers;
  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: 5, // Otimizado para melhor performance
    bundlePolicy: 'max-bundle', // Agrupa todos os media streams
  };
  
  // CORREÇÃO: Aplicar relay apenas uma vez
  if (relayOnly) {
    cfg.iceTransportPolicy = 'relay';
  }
  
  console.log('🔧 [WRTC-CONFIG] Configuração aplicada:', {
    serversCount: iceServers.length,
    isRelay: relayOnly,
    policy: cfg.iceTransportPolicy,
    source: dynamicIceServers?.length ? 'dynamic' : 'fallback'
  });
  
  return cfg;
}

// Alias para compatibilidade
export function getActiveWebRTCConfig(): RTCConfiguration {
  return getWebRTCConfig();
}

// Caso queira forçar relay em algum cenário específico (ex.: ambiente Lovable)
export function useRelayOnly(enable = true) {
  relayOnly = enable;
}

// Para fluxos que exigem obrigatoriamente TURN (NAT extremo)
export function getTurnOnlyConfig(): RTCConfiguration {
  return {
    iceServers: dynamicIceServers ?? FALLBACK_CONFIG.iceServers,
    iceTransportPolicy: 'relay',
    iceCandidatePoolSize: 5,
  };
}

// Mantém os constraints no mesmo arquivo (sem alterações)
export const MEDIA_CONSTRAINTS = {
  video: { facingMode: 'user' },
  audio: true
};

// (Opcional) helper de debug no console
if (typeof window !== 'undefined') {
  (window as any).__webrtcCfg = () => getWebRTCConfig();
}