
// Standard STUN/TURN server configuration
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Uncomment and replace with your TURN server details when needed
    // { urls: 'turn:turn.example.com:3478', username: 'username', credential: 'password' }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all'
};

export function setupPeerConnection(config: RTCConfiguration = ICE_SERVERS): RTCPeerConnection {
  const pc = new RTCPeerConnection(config);
  
  pc.addEventListener('iceconnectionstatechange', () => {
    console.log('ICE connection state:', pc.iceConnectionState);
  });
  
  pc.addEventListener('connectionstatechange', () => {
    console.log('Connection state:', pc.connectionState);
  });
  
  pc.addEventListener('signalingstatechange', () => {
    console.log('Signaling state:', pc.signalingState);
  });
  
  return pc;
}

export function createSignalingChannel(channelId: string): BroadcastChannel {
  try {
    return new BroadcastChannel(`webrtc-signaling-${channelId}`);
  } catch (err) {
    console.error('Failed to create BroadcastChannel:', err);
    throw err;
  }
}

// Detect and report supported codecs
export async function detectSupportedCodecs(): Promise<{ video: string[], audio: string[] }> {
  const supportedVideoCodecs: string[] = [];
  const supportedAudioCodecs: string[] = [];
  
  try {
    // Check common video codecs
    const videoCodecs = ['video/H264', 'video/VP8', 'video/VP9', 'video/AV1'];
    for (const codec of videoCodecs) {
      try {
        // @ts-ignore - isTypeSupported exists but TypeScript may not recognize it
        if (MediaRecorder.isTypeSupported(codec)) {
          supportedVideoCodecs.push(codec);
        }
      } catch (e) {
        console.warn(`Error checking video codec ${codec}:`, e);
      }
    }
    
    // Check common audio codecs
    const audioCodecs = ['audio/opus', 'audio/PCMU', 'audio/PCMA'];
    for (const codec of audioCodecs) {
      try {
        // @ts-ignore - isTypeSupported exists but TypeScript may not recognize it
        if (MediaRecorder.isTypeSupported(codec)) {
          supportedAudioCodecs.push(codec);
        }
      } catch (e) {
        console.warn(`Error checking audio codec ${codec}:`, e);
      }
    }
    
    console.log('Supported video codecs:', supportedVideoCodecs);
    console.log('Supported audio codecs:', supportedAudioCodecs);
    
    return { video: supportedVideoCodecs, audio: supportedAudioCodecs };
  } catch (e) {
    console.warn('Error detecting supported codecs:', e);
    return { video: [], audio: [] };
  }
}

// Helper to modify SDP to prefer specific codecs
export function setPreferredCodecs(sdp: string, preferredVideoCodec = 'H264'): string {
  let modifiedSdp = sdp;
  
  // Modify the order of video codecs (put preferred codec first)
  modifiedSdp = modifiedSdp.replace(
    /m=video .*\r\n(a=rtpmap:.*\r\n)*/g,
    (match) => {
      const lines = match.split('\r\n');
      const mLine = lines[0];
      const rtpMaps = lines.filter(line => line.startsWith('a=rtpmap:'));
      const preferredMaps = rtpMaps.filter(line => line.includes(preferredVideoCodec));
      const otherMaps = rtpMaps.filter(line => !line.includes(preferredVideoCodec));
      
      return [mLine, ...preferredMaps, ...otherMaps].join('\r\n') + '\r\n';
    }
  );
  
  return modifiedSdp;
}

// Create an offer with preferred codecs
export async function createOfferWithPreferredCodecs(
  pc: RTCPeerConnection, 
  preferredVideoCodec = 'H264',
  options: RTCOfferOptions = {}
): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer(options);
  
  if (!offer.sdp) {
    return offer;
  }
  
  const modifiedSdp = setPreferredCodecs(offer.sdp, preferredVideoCodec);
  
  return {
    type: offer.type,
    sdp: modifiedSdp
  };
}

// Monitor WebRTC connection stats
export function monitorRTCStats(pc: RTCPeerConnection, interval = 10000): () => void {
  const statsInterval = setInterval(async () => {
    if (!pc || pc.connectionState === 'closed') {
      clearInterval(statsInterval);
      return;
    }
    
    try {
      const stats = await pc.getStats();
      let videoReceived = false;
      let audioReceived = false;
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          videoReceived = report.bytesReceived > 0;
          console.log('Video stats:', {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond
          });
        }
        
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          audioReceived = report.bytesReceived > 0;
          console.log('Audio stats:', {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost
          });
        }
        
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          console.log('Connection stats:', {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            availableIncomingBitrate: report.availableIncomingBitrate
          });
        }
      });
      
      if (!videoReceived) {
        console.warn('Not receiving video data');
      }
      
      if (!audioReceived) {
        console.warn('Not receiving audio data');
      }
    } catch (error) {
      console.error('Error monitoring WebRTC stats:', error);
    }
  }, interval);
  
  return () => {
    clearInterval(statsInterval);
  };
}

// Apply optimizations to video element to reduce latency
export function optimizeVideoElement(videoElement: HTMLVideoElement): void {
  try {
    videoElement.playsInline = true;
    
    // Use low latency mode if available
    if ('latencyHint' in (videoElement as any)) {
      // @ts-ignore - Feature not in all TypeScript defs
      videoElement.latencyHint = 'interactive';
    }
    
    // Disable features that might increase latency
    if ('disablePictureInPicture' in (videoElement as any)) {
      // @ts-ignore
      videoElement.disablePictureInPicture = true;
    }
    
    if ('disableRemotePlayback' in (videoElement as any)) {
      // @ts-ignore
      videoElement.disableRemotePlayback = true;
    }
  } catch (e) {
    console.warn('Error optimizing video element:', e);
  }
}

// WebRTC reconnection helper
export async function attemptICERestart(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit | null> {
  if (!pc) {
    return null;
  }
  
  try {
    if (pc.restartIce) {
      pc.restartIce();
    }
    
    const offer = await createOfferWithPreferredCodecs(pc, 'H264', { iceRestart: true });
    await pc.setLocalDescription(offer);
    return offer;
  } catch (error) {
    console.error('Error during ICE restart:', error);
    return null;
  }
}
