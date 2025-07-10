// Device Detection Debugger - for troubleshooting camera issues

export const logDeviceInfo = () => {
  console.group('📱🖥️ DEVICE INFO DEBUG');
  
  console.log('🌐 Navigator Info:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    cookieEnabled: navigator.cookieEnabled
  });
  
  console.log('📺 Screen Info:', {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    availWidth: window.screen?.availWidth,
    availHeight: window.screen?.availHeight,
    pixelDepth: window.screen?.pixelDepth,
    colorDepth: window.screen?.colorDepth
  });
  
  console.log('🪟 Window Info:', {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio
  });
  
  console.log('👆 Touch Info:', {
    ontouchstart: 'ontouchstart' in window,
    maxTouchPoints: navigator.maxTouchPoints,
    msMaxTouchPoints: (navigator as any).msMaxTouchPoints
  });
  
  console.log('🔄 Orientation Info:', {
    orientation: 'orientation' in window ? window.orientation : 'Not available',
    screenOrientation: screen.orientation?.type || 'Not available'
  });
  
  console.log('🎥 Media Devices Support:', {
    mediaDevices: !!navigator.mediaDevices,
    getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
    webkitGetUserMedia: !!(navigator as any).webkitGetUserMedia,
    mozGetUserMedia: !!(navigator as any).mozGetUserMedia
  });
  
  console.groupEnd();
};

export const logMediaConstraintsAttempt = (constraints: MediaStreamConstraints, attemptNumber: number, deviceType: string) => {
  console.group(`🎬 CONSTRAINTS ATTEMPT #${attemptNumber} (${deviceType.toUpperCase()})`);
  
  console.log('📝 Full Constraints:', JSON.stringify(constraints, null, 2));
  
  if (constraints.video && typeof constraints.video === 'object') {
    const video = constraints.video as MediaTrackConstraints;
    console.log('📹 Video Settings:', {
      facingMode: video.facingMode,
      width: video.width,
      height: video.height,
      frameRate: video.frameRate
    });
  }
  
  if (constraints.audio && typeof constraints.audio === 'object') {
    const audio = constraints.audio as MediaTrackConstraints;
    console.log('🎙️ Audio Settings:', {
      echoCancellation: audio.echoCancellation,
      noiseSuppression: audio.noiseSuppression,
      autoGainControl: audio.autoGainControl
    });
  }
  
  console.groupEnd();
};

export const logStreamSuccess = (stream: MediaStream, deviceType: string) => {
  console.group(`✅ STREAM SUCCESS (${deviceType.toUpperCase()})`);
  
  console.log('🎉 Stream Created:', {
    id: stream.id,
    active: stream.active,
    totalTracks: stream.getTracks().length
  });
  
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  videoTracks.forEach((track, index) => {
    const settings = track.getSettings();
    console.log(`📹 Video Track ${index + 1}:`, {
      label: track.label,
      kind: track.kind,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        facingMode: settings.facingMode,
        deviceId: settings.deviceId
      }
    });
  });
  
  audioTracks.forEach((track, index) => {
    const settings = track.getSettings();
    console.log(`🎙️ Audio Track ${index + 1}:`, {
      label: track.label,
      kind: track.kind,
      enabled: track.enabled,
      readyState: track.readyState,
      settings: {
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        deviceId: settings.deviceId
      }
    });
  });
  
  console.groupEnd();
};

export const logStreamError = (error: Error, attemptNumber: number, deviceType: string) => {
  console.group(`❌ STREAM ERROR Attempt #${attemptNumber} (${deviceType.toUpperCase()})`);
  
  console.error('Error Details:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  
  // Common error explanations
  if (error.name === 'NotFoundError') {
    console.warn('💡 NotFoundError: Requested camera/microphone not found or not available');
  } else if (error.name === 'NotAllowedError') {
    console.warn('💡 NotAllowedError: User denied permission or secure context required');
  } else if (error.name === 'OverconstrainedError') {
    console.warn('💡 OverconstrainedError: Constraints cannot be satisfied by available devices');
  } else if (error.name === 'NotReadableError') {
    console.warn('💡 NotReadableError: Device in use by another application or hardware issue');
  }
  
  console.groupEnd();
};

// Make available globally for debugging
(window as any).logDeviceInfo = logDeviceInfo;