
import { detectMobileAggressively, getCameraPreference, validateMobileCameraCapabilities } from './deviceDetection';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  
  console.log(`🎬 MEDIA FALLBACK: Starting ${isMobile ? 'MOBILE FORCED' : 'DESKTOP'} capture with MOBILE-FIRST prioritization`);
  
  // FASE 3: If forced mobile, validate camera capabilities first
  if (isMobile) {
    console.log('📱 MOBILE FORCED: Validating camera capabilities before stream acquisition');
    const hasValidCamera = await validateMobileCameraCapabilities();
    
    if (hasValidCamera) {
      console.log('✅ MOBILE FORCED: Camera capabilities validated - proceeding with mobile stream');
    } else {
      console.log('⚠️ MOBILE FORCED: Camera validation inconclusive - proceeding anyway');
    }
    
    return await getMobileStreamWithForceValidation();
  }
  
  // Desktop logic with mobile fallback
  return await getDesktopStreamWithMobileFallback();
};

const getMobileStreamWithForceValidation = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE CAPTURE: FORCED mobile camera acquisition with validation');
  
  // FASE 1: URL Parameter Detection for Camera Override
  const urlParams = new URLSearchParams(window.location.search);
  const forcedCamera = urlParams.get('camera');
  const preferredFacing = forcedCamera === 'environment' ? 'environment' : 
                         forcedCamera === 'user' ? 'user' : 'environment'; // Default to rear for mobile
  
  console.log(`📱 MOBILE CAPTURE: Using camera preference: ${preferredFacing} (from URL: ${forcedCamera || 'auto'})`);
  
  // FASE 4: Robust fallback with facingMode prioritization
  const mobileConstraints: MediaStreamConstraints[] = [
    // Priority 1: EXACT preferred camera with audio
    {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    },
    // Priority 2: IDEAL preferred camera with audio
    {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    },
    // Priority 3: EXACT opposite camera with audio
    {
      video: {
        facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    },
    // Priority 4: IDEAL opposite camera with audio
    {
      video: {
        facingMode: { ideal: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 }
      },
      audio: true
    },
    // Priority 5: ANY video with audio (no facingMode)
    {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    },
    // Priority 6: Simple video with audio
    {
      video: true,
      audio: true
    },
    // Priority 7: Video only with facingMode
    {
      video: {
        facingMode: { ideal: preferredFacing }
      },
      audio: false
    },
    // Priority 8: Video only (basic)
    {
      video: true,
      audio: false
    }
  ];
  
  for (let i = 0; i < mobileConstraints.length; i++) {
    try {
      console.log(`📱 MOBILE CAPTURE: Attempt ${i + 1}/${mobileConstraints.length} with constraints:`, mobileConstraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints[i]);
      
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        
        console.log('✅ MOBILE CAPTURE: Stream acquired successfully:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          cameraSettings: settings
        });
        
        // FASE 3: Validate we got a mobile camera
        if (settings?.facingMode) {
          console.log(`🎉 MOBILE CAPTURE: CONFIRMED mobile camera with facingMode: ${settings.facingMode}`);
          
          // Mark as mobile validated retroactively
          sessionStorage.setItem('mobileValidated', 'true');
          sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
          
          return stream;
        } else {
          console.warn('⚠️ MOBILE CAPTURE: Got camera but no facingMode - might be desktop camera accessed via mobile browser');
          
          // Still return the stream but note it might not be true mobile
          if (i >= 4) { // If we're in the basic constraints, accept it
            console.log('📱 MOBILE CAPTURE: Accepting non-facingMode camera as mobile fallback');
            return stream;
          }
          
          // Clean up and try next constraint if still in facingMode attempts
          console.log('📱 MOBILE CAPTURE: Trying next constraint for better mobile detection');
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } catch (error) {
      console.error(`❌ MOBILE CAPTURE: Attempt ${i + 1} failed:`, error);
      
      // If it's a permission error, stop trying
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ MOBILE CAPTURE: Permission denied - cannot continue');
        break;
      }
    }
  }
  
  console.error('❌ MOBILE CAPTURE: All mobile attempts failed');
  return null;
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
      video: true,
      audio: false
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

// Enhanced camera info for debugging
export const getCameraInfo = async (): Promise<void> => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('📹 CAMERA INFO: Available cameras with mobile detection:', videoDevices.map(device => ({
      deviceId: device.deviceId?.substring(0, 20),
      label: device.label || 'Unknown Camera',
      groupId: device.groupId?.substring(0, 20),
      isMobileCapable: device.label.toLowerCase().includes('back') || 
                      device.label.toLowerCase().includes('rear') || 
                      device.label.toLowerCase().includes('environment') ||
                      device.label.toLowerCase().includes('front') ||
                      device.label.toLowerCase().includes('user')
    })));
    
    // Test mobile capabilities if requested
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') || urlParams.has('forceMobile')) {
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
