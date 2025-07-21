import { detectMobileAggressively, getCameraPreference } from './deviceDetection';
import { getOptimalConstraints } from './mediaConstraints';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  
  console.log(`🎬 MEDIA FALLBACK: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} capture with prioritization`);
  
  // Mobile-specific logic with rear camera priority
  if (isMobile) {
    return await getMobileStreamWithRearCameraPriority();
  }
  
  // Desktop logic (unchanged)
  return await getDesktopStream();
};

const getMobileStreamWithRearCameraPriority = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE CAPTURE: Prioritizing rear camera (environment facing)');
  
  // Phase 1: Try exact rear camera first (highest priority)
  try {
    console.log('📱 MOBILE CAPTURE: Phase 1 - Trying exact rear camera');
    const constraints = {
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Exact rear camera obtained successfully');
    
    // Validate it's actually the rear camera
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('📱 MOBILE CAPTURE: Camera settings:', settings);
      
      if (settings.facingMode === 'environment') {
        console.log('✅ MOBILE CAPTURE: Confirmed rear camera active');
        return stream;
      }
    }
    
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 1 failed, trying ideal rear camera');
  }
  
  // Phase 2: Try ideal rear camera
  try {
    console.log('📱 MOBILE CAPTURE: Phase 2 - Trying ideal rear camera');
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Ideal rear camera obtained');
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 2 failed, trying any camera with audio');
  }
  
  // Phase 3: Try any camera with audio
  try {
    console.log('📱 MOBILE CAPTURE: Phase 3 - Trying any camera with audio');
    const constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Any camera with audio obtained');
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 3 failed, trying video only');
  }
  
  // Phase 4: Try video only (last resort)
  try {
    console.log('📱 MOBILE CAPTURE: Phase 4 - Trying video only (last resort)');
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Video-only stream obtained');
    return stream;
  } catch (error) {
    console.error('❌ MOBILE CAPTURE: All phases failed:', error);
    return null;
  }
};

const getDesktopStream = async (): Promise<MediaStream | null> => {
  console.log('🖥️ DESKTOP CAPTURE: Starting desktop capture sequence');
  
  const desktopConstraints = [
    // High quality desktop
    {
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: true
    },
    // Medium quality
    {
      video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 }
      },
      audio: true
    },
    // Basic quality
    {
      video: {
        width: { ideal: 640, max: 640 },
        height: { ideal: 480, max: 480 }
      },
      audio: true
    },
    // Video only fallback
    {
      video: true
    }
  ];
  
  for (let i = 0; i < desktopConstraints.length; i++) {
    try {
      console.log(`🖥️ DESKTOP CAPTURE: Trying constraint set ${i + 1}`);
      const stream = await navigator.mediaDevices.getUserMedia(desktopConstraints[i]);
      console.log(`✅ DESKTOP CAPTURE: Success with constraint set ${i + 1}`);
      return stream;
    } catch (error) {
      console.log(`⚠️ DESKTOP CAPTURE: Constraint set ${i + 1} failed:`, error);
    }
  }
  
  console.error('❌ DESKTOP CAPTURE: All constraint sets failed');
  return null;
};

// Helper function to get camera info for debugging
export const getCameraInfo = async (): Promise<void> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('📹 CAMERA INFO: Available cameras:', videoDevices.map(device => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId
    })));
  } catch (error) {
    console.error('❌ CAMERA INFO: Failed to enumerate devices:', error);
  }
};
