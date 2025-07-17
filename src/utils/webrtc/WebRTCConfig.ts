
// FASE 4: Enhanced network configuration with TURN servers and mobile optimization

// Detect if running on mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Production TURN servers for NAT traversal
const PRODUCTION_ICE_SERVERS = [
  // Multiple STUN servers for redundancy
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Cloudflare STUN servers
  { urls: 'stun:stun.cloudflare.com:3478' },
  
  // Mozilla STUN servers
  { urls: 'stun:stun.services.mozilla.com' },
  
  // TURN servers for production (configure with your credentials)
  // These are placeholders - replace with your actual TURN server credentials
  {
    urls: 'turn:turn.example.com:3478',
    username: 'turnuser',
    credential: 'turnpass'
  },
  {
    urls: 'turns:turn.example.com:5349',
    username: 'turnuser', 
    credential: 'turnpass'
  }
];

// Optimized timeouts for mobile vs desktop
const TIMEOUT_CONFIG = {
  desktop: {
    connection: 10000,     // 10s for desktop
    ice: 8000,            // 8s for ICE gathering
    heartbeat: 30000,     // 30s heartbeat
    retry: 2000           // 2s retry delay
  },
  mobile: {
    connection: 15000,     // 15s for mobile (slower networks)
    ice: 12000,           // 12s for ICE gathering
    heartbeat: 45000,     // 45s heartbeat (mobile can go background)
    retry: 3000           // 3s retry delay
  }
};

export const WEBRTC_CONFIG = {
  iceServers: PRODUCTION_ICE_SERVERS,
  iceCandidatePoolSize: 10,           // Pre-gather ICE candidates
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
  iceTransportPolicy: 'all' as RTCIceTransportPolicy
};

// Get optimized timeouts based on device type
export const getTimeoutConfig = () => {
  return isMobile() ? TIMEOUT_CONFIG.mobile : TIMEOUT_CONFIG.desktop;
};

// Get device-optimized media constraints
export const MEDIA_CONSTRAINTS = {
  video: { 
    facingMode: 'environment',  // Use back camera for mobile participants
    width: { ideal: isMobile() ? 720 : 1280 },
    height: { ideal: isMobile() ? 480 : 720 },
    frameRate: { ideal: isMobile() ? 24 : 30 }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: isMobile() ? 44100 : 48000
  }
};
