/**
 * Mobile-optimized WebRTC configuration
 */

export const MOBILE_ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (mais confiáveis para mobile)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // Cloudflare STUN (backup)
  { urls: 'stun:stun.cloudflare.com:3478' },
  
  // OpenRelay TURN servers (fallback para NAT restritivo)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

export const MOBILE_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: MOBILE_ICE_SERVERS,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10 // Mais candidatos para mobile
};

export const MOBILE_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 30 }, // Frame rate menor para mobile
    facingMode: { ideal: 'user' }
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
    channelCount: 1 // Mono para economizar bandwidth
  }
};

export const DESKTOP_RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 5
};

export const getOptimizedRTCConfig = (isMobile: boolean): RTCConfiguration => {
  const config = isMobile ? MOBILE_RTC_CONFIGURATION : DESKTOP_RTC_CONFIGURATION;
  console.log(`🔧 WebRTC CONFIG: Using ${isMobile ? 'MOBILE' : 'DESKTOP'} configuration:`, config);
  return config;
};

export const getOptimizedMediaConstraints = (isMobile: boolean): MediaStreamConstraints => {
  if (!isMobile) {
    return {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }
  
  console.log(`📱 MEDIA CONSTRAINTS: Using mobile-optimized constraints:`, MOBILE_CONSTRAINTS);
  return MOBILE_CONSTRAINTS;
};