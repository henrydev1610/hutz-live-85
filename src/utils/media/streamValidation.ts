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

export const verifyCameraType = (stream: MediaStream, isMobile: boolean): void => {
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) return;
  
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
      console.warn(`⚠️ MOBILE WARNING: No facingMode detected! This might be desktop camera being used.`);
      console.warn(`⚠️ MOBILE WARNING: Expected mobile camera with facingMode, but got settings:`, settings);
    } else {
      console.log(`✅ MOBILE SUCCESS: Got mobile camera with facingMode: ${settings.facingMode}`);
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
  }
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