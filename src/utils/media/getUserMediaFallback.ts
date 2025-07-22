import { detectMobileAggressively, getCameraPreference } from './deviceDetection';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  
  console.log(`🎬 MEDIA FALLBACK: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} capture with MOBILE-FIRST prioritization`);
  
  // FASE 3: MOBILE-FIRST LOGIC - Priorizar câmera móvel
  if (isMobile) {
    return await getMobileStreamWithEnhancedDetection();
  }
  
  // Desktop logic (unchanged but with mobile fallback)
  return await getDesktopStreamWithMobileFallback();
};

const getMobileStreamWithEnhancedDetection = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE CAPTURE: ENHANCED mobile camera acquisition with rear camera priority');
  
  // FASE 3: URL Parameter Detection for Camera Override
  const urlParams = new URLSearchParams(window.location.search);
  const forcedCamera = urlParams.get('camera'); // 'environment' or 'user'
  const preferredFacing = forcedCamera === 'environment' ? 'environment' : 'environment'; // Default to rear
  
  console.log(`📱 MOBILE CAPTURE: Camera preference from URL: ${forcedCamera || 'auto'}, using: ${preferredFacing}`);
  
  // Phase 1: Try EXACT rear camera first (HIGHEST PRIORITY for mobile)
  try {
    console.log('📱 MOBILE CAPTURE: Phase 1 - EXACT rear camera (environment)');
    const constraints = {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: EXACT rear camera obtained successfully');
    
    // FASE 5: Enhanced validation
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('📱 MOBILE CAPTURE: Camera settings verified:', {
        facingMode: settings.facingMode,
        width: settings.width,
        height: settings.height,
        deviceId: settings.deviceId?.substring(0, 20)
      });
      
      if (settings.facingMode === preferredFacing) {
        console.log('✅ MOBILE CAPTURE: CONFIRMED rear camera active');
        return stream;
      }
    }
    
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 1 failed, trying ideal rear camera');
  }
  
  // Phase 2: Try IDEAL rear camera
  try {
    console.log('📱 MOBILE CAPTURE: Phase 2 - IDEAL rear camera');
    const constraints = {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: IDEAL rear camera obtained');
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 2 failed, trying any camera with audio');
  }
  
  // Phase 3: Try ANY camera with audio (mobile fallback)
  try {
    console.log('📱 MOBILE CAPTURE: Phase 3 - ANY mobile camera with audio');
    const constraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: ANY camera with audio obtained');
    return stream;
  } catch (error) {
    console.log('⚠️ MOBILE CAPTURE: Phase 3 failed, trying video only');
  }
  
  // Phase 4: Try video only (last resort for mobile)
  try {
    console.log('📱 MOBILE CAPTURE: Phase 4 - Video only (mobile last resort)');
    const constraints = {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 480, max: 640 },
        height: { ideal: 360, max: 480 }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ MOBILE CAPTURE: Video-only mobile stream obtained');
    return stream;
  } catch (error) {
    console.error('❌ MOBILE CAPTURE: All mobile phases failed:', error);
    return null;
  }
};

const getDesktopStreamWithMobileFallback = async (): Promise<MediaStream | null> => {
  console.log('🖥️ DESKTOP CAPTURE: Starting with mobile fallback capability');
  
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
    // FASE 3: Mobile-like constraints for desktop fallback
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 }
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

// FASE 5: Enhanced camera info for debugging
export const getCameraInfo = async (): Promise<void> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('📹 CAMERA INFO: Available cameras with mobile detection:', videoDevices.map(device => ({
      deviceId: device.deviceId?.substring(0, 20),
      label: device.label || 'Unknown Camera',
      groupId: device.groupId?.substring(0, 20),
      isMobileCapable: device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear') || device.label.toLowerCase().includes('environment')
    })));
    
    // Test mobile capabilities
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug')) {
      await testMobileCameraCapabilities();
    }
  } catch (error) {
    console.error('❌ CAMERA INFO: Failed to enumerate devices:', error);
  }
};

const testMobileCameraCapabilities = async () => {
  console.log('🧪 TESTING: Mobile camera capabilities...');
  
  const facingModes = ['environment', 'user'];
  for (const facingMode of facingModes) {
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } }
      });
      
      const settings = testStream.getVideoTracks()[0]?.getSettings();
      console.log(`✅ CAMERA TEST: ${facingMode} camera available:`, settings);
      
      // Clean up test stream
      testStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.log(`❌ CAMERA TEST: ${facingMode} camera not available:`, error.name);
    }
  }
};
