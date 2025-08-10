
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
