// Stream validation and verification
export const validateStream = (stream: MediaStream | null): MediaStream => {
  if (!stream) {
    throw new Error('Stream é null/undefined');
  }
  
  if (!stream.getTracks || typeof stream.getTracks !== 'function') {
    throw new Error('Stream não possui método getTracks');
  }
  
  const tracks = stream.getTracks();
  if (tracks.length === 0) {
    throw new Error('Stream sem tracks');
  }
  
  return stream;
};

export const logStreamDetails = (stream: MediaStream, attempt: number, deviceType: string): void => {
  const tracks = stream.getTracks();
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  const activeTracks = tracks.filter(t => t.readyState === 'live');
  
  console.log(`✅ STREAM: SUCCESS! Stream obtained:`, {
    streamId: stream.id,
    active: stream.active,
    totalTracks: tracks.length,
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    activeTracks: activeTracks.length,
    attempt,
    deviceType: deviceType.toUpperCase()
  });
};

export const verifyCameraType = (stream: MediaStream, isMobile: boolean): { isValid: boolean; shouldRetry: boolean } => {
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) return { isValid: true, shouldRetry: false };
  
  const videoTrack = videoTracks[0];
  const settings = videoTrack.getSettings();
  
  if (isMobile) {
    console.log(`📱 MOBILE CAMERA VERIFICATION:`, {
      facingMode: settings.facingMode,
      deviceId: settings.deviceId,
      label: videoTrack.label,
      isExpectedMobile: !!settings.facingMode,
      width: settings.width,
      height: settings.height
    });
    
    if (!settings.facingMode) {
      console.error(`❌ MOBILE CRITICAL: No facingMode detected! Desktop camera on mobile device!`);
      console.error(`❌ MOBILE CRITICAL: Expected mobile camera with facingMode, but got settings:`, settings);
      
      // Show visual alert to user
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mobileDesktopCameraDetected', {
          detail: { settings, deviceId: settings.deviceId }
        }));
      }
      
      return { isValid: false, shouldRetry: true };
    } else {
      console.log(`✅ MOBILE SUCCESS: Got mobile camera with facingMode: ${settings.facingMode}`);
      return { isValid: true, shouldRetry: false };
    }
  } else {
    console.log(`🖥️ DESKTOP CAMERA VERIFICATION:`, {
      facingMode: settings.facingMode,
      deviceId: settings.deviceId,
      label: videoTrack.label,
      isExpectedDesktop: !settings.facingMode,
      width: settings.width,
      height: settings.height
    });
    
    if (settings.facingMode) {
      console.warn(`⚠️ DESKTOP WARNING: Unexpected facingMode detected! This might be mobile camera logic being used.`);
    } else {
      console.log(`✅ DESKTOP SUCCESS: Got desktop webcam without facingMode`);
    }
    return { isValid: true, shouldRetry: false };
  }
};

export const rejectNonMobileStream = async (stream: MediaStream, isMobile: boolean): Promise<MediaStream | null> => {
  if (!isMobile) return stream;
  
  const verification = verifyCameraType(stream, isMobile);
  
  if (!verification.isValid && verification.shouldRetry) {
    console.error(`🚫 REJECTING: Desktop camera detected on mobile device, stopping stream`);
    
    // Dispatch event for UI alert
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mobileDesktopCameraDetected', {
        detail: { 
          reason: 'Desktop camera on mobile device',
          shouldRetry: true,
          timestamp: Date.now()
        }
      }));
    }
    
    stream.getTracks().forEach(track => track.stop());
    return null;
  }
  
  return stream;
};

export const setupStreamMonitoring = (stream: MediaStream): void => {
  const tracks = stream.getTracks();
  
  tracks.forEach(track => {
    track.addEventListener('ended', () => {
      console.warn(`⚠️ STREAM: Track ${track.kind} ended unexpectedly`);
    });
    track.addEventListener('mute', () => {
      console.warn(`🔇 STREAM: Track ${track.kind} muted`);
    });
    track.addEventListener('unmute', () => {
      console.log(`🔊 STREAM: Track ${track.kind} unmuted`);
    });
  });
};

export const stabilizeStream = async (stream: MediaStream, isMobile: boolean): Promise<void> => {
  if (isMobile) {
    console.log(`📱 STREAM: Waiting for stream stabilization...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (!stream.active) {
      console.warn('⚠️ STREAM: Stream became inactive, but continuing...');
    }
  }
};