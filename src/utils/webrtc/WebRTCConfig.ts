


// Mantemos ICE dinâmico aqui em memória (setado quando o backend envia via socket)
let dynamicIceServers: RTCIceServer[] | null = null;
let relayOnly = false;

// STUN de fallback para quando ainda não recebemos nada do backend
const DEFAULT_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Chame isso ao receber `ice-servers` do backend
export function setDynamicIceServers(servers: RTCIceServer[], opts?: { relayOnly?: boolean }) {
  if (Array.isArray(servers) && servers.length) {
    dynamicIceServers = servers;
    console.log('🧊 WEBRTC CONFIG: ICE servers (dynamic) set:',
      servers.map(s => ({ urls: s.urls, username: (s as any).username, hasCredential: !!(s as any).credential }))
    );
  } else {
    console.warn('🧊 WEBRTC CONFIG: received empty/invalid ICE servers; keeping defaults');
  }
  if (typeof opts?.relayOnly === 'boolean') relayOnly = !!opts.relayOnly;
}

// Use SEMPRE este getter na hora de criar o RTCPeerConnection
export function getWebRTCConfig(): RTCConfiguration {
  const iceServers = dynamicIceServers?.length ? dynamicIceServers : DEFAULT_STUN;
  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: 10,
  };
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  return cfg;
}

// Caso queira forçar relay em algum cenário específico (ex.: ambiente Lovable)
export function useRelayOnly(enable = true) {
  relayOnly = enable;
}

// Para fluxos que exigem obrigatoriamente TURN (NAT extremo)
export function getTurnOnlyConfig(): RTCConfiguration {
  return {
    iceServers: dynamicIceServers ?? [],
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



















/* 
// FASE 1: Configuração robusta de STUN/TURN servers
export const WEBRTC_CONFIG = (typeof window !== 'undefined' && (window.location.hostname.includes('lovable') || !!document.querySelector('script[src*="gptengineer"]')))
  ? {
      // Forçar TURN em ambientes Lovable/sandbox para aumentar taxa de sucesso
      iceServers: [
        { urls: 'turn:a.relay.metered.ca:80', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:443', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' }
      ],
      iceTransportPolicy: 'relay' as RTCIceTransportPolicy,
      iceCandidatePoolSize: 5
    }
  : {
      iceServers: [
        // Google STUN servers (free)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // Cloudflare STUN (backup)
        { urls: 'stun:stun.cloudflare.com:3478' },
        
        // Metered TURN servers (fallback)
        { urls: 'turn:a.relay.metered.ca:80', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:443', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' },
        { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'e8347d251935bbaf5a4bacf6', credential: 'ccp2JzxHYZOMd/X7' }
      ],
      iceCandidatePoolSize: 10
    };

// FASE 1: Configuração restritiva para NAT extremo (TURN obrigatório)
export const TURN_ONLY_CONFIG = {
  iceServers: [
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8347d251935bbaf5a4bacf6',
      credential: 'ccp2JzxHYZOMd/X7'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8347d251935bbaf5a4bacf6',
      credential: 'ccp2JzxHYZOMd/X7'
    }
  ],
  iceTransportPolicy: 'relay' as RTCIceTransportPolicy,
  iceCandidatePoolSize: 5
};

export const MEDIA_CONSTRAINTS = {
  video: { facingMode: 'user' },
  audio: true
};
 */