
import { detectMobileAggressively, getCameraPreference, validateMobileCameraCapabilities } from './deviceDetection';

// FASE 3: Check if we're on participant route
const isParticipantRoute = (): boolean => {
  return window.location.pathname.includes('/participant/');
};

// FASE 4: Log permission type being requested
const logPermissionRequest = (constraints: MediaStreamConstraints, attempt: number): void => {
  const videoConstraints = constraints.video;
  let permissionType = 'UNKNOWN';
  
  if (typeof videoConstraints === 'object' && videoConstraints !== null) {
    if ('facingMode' in videoConstraints) {
      const facingMode = videoConstraints.facingMode;
      if (typeof facingMode === 'object' && facingMode !== null) {
        if ('exact' in facingMode) {
          permissionType = `MOBILE (exact: ${facingMode.exact})`;
        } else if ('ideal' in facingMode) {
          permissionType = `MOBILE (ideal: ${facingMode.ideal})`;
        }
      } else if (typeof facingMode === 'string') {
        permissionType = `MOBILE (${facingMode})`;
      }
    } else {
      permissionType = 'DESKTOP (no facingMode)';
    }
  } else if (videoConstraints === true) {
    permissionType = 'BASIC (could be desktop or mobile)';
  }
  
  console.log(`🔐 FASE 4: PERMISSION REQUEST ${attempt} - Type: ${permissionType}`, constraints);
  
  // FASE 4: Alert if desktop permission is being requested on participant route
  if (isParticipantRoute() && permissionType.includes('DESKTOP')) {
    console.error('❌ FASE 4: CRITICAL - Desktop permission requested on participant route!');
    console.error('❌ FASE 4: This will show desktop webcam dialog instead of mobile camera!');
  }
};

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const isParticipant = isParticipantRoute();
  
  console.log(`🎬 FASE 3: MEDIA FALLBACK Starting - Mobile: ${isMobile}, Participant: ${isParticipant}`);
  
  // FASE 3: If participant route, ALWAYS force mobile behavior
  if (isParticipant) {
    console.log('📱 FASE 3: PARTICIPANT ROUTE - FORCING MOBILE CAMERA ACQUISITION');
    return await getMobileStreamWithForceValidation(true);
  }
  
  // FASE 3: If forced mobile, validate camera capabilities first
  if (isMobile) {
    console.log('📱 FASE 3: MOBILE FORCED - Validating camera capabilities before stream acquisition');
    const hasValidCamera = await validateMobileCameraCapabilities();
    
    if (hasValidCamera) {
      console.log('✅ FASE 3: MOBILE FORCED - Camera capabilities validated - proceeding with mobile stream');
    } else {
      console.log('⚠️ FASE 3: MOBILE FORCED - Camera validation inconclusive - proceeding anyway');
    }
    
    return await getMobileStreamWithForceValidation(false);
  }
  
  // Desktop logic with mobile fallback
  return await getDesktopStreamWithMobileFallback();
};

const getMobileStreamWithForceValidation = async (isParticipantRoute: boolean): Promise<MediaStream | null> => {
  console.log(`📱 FASE 3: MOBILE CAPTURE - ${isParticipantRoute ? 'PARTICIPANT ROUTE' : 'FORCED'} mobile camera acquisition`);
  
  // FASE 1: URL Parameter Detection for Camera Override
  const urlParams = new URLSearchParams(window.location.search);
  const forcedCamera = urlParams.get('camera');
  const preferredFacing = forcedCamera === 'environment' ? 'environment' : 
                         forcedCamera === 'user' ? 'user' : 'environment'; // Default to rear for mobile
  
  console.log(`📱 FASE 3: Using camera preference: ${preferredFacing} (from URL: ${forcedCamera || 'auto'})`);
  
  // FASE 3: ENHANCED mobile constraints with PARTICIPANT ROUTE priority
  const mobileConstraints: MediaStreamConstraints[] = [
    // Priority 1: EXACT preferred camera with audio (MOBILE SPECIFIC)
    {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: true
    },
    // Priority 2: IDEAL preferred camera with audio (MOBILE SPECIFIC)
    {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    },
    // Priority 3: EXACT opposite camera with audio (MOBILE SPECIFIC)
    {
      video: {
        facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { ideal: 720, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    },
    // Priority 4: IDEAL opposite camera with audio (MOBILE SPECIFIC)
    {
      video: {
        facingMode: { ideal: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 }
      },
      audio: true
    },
    // Priority 5: ANY video with audio BUT NO FACINGMODE (RISKY - could be desktop)
    ...(isParticipantRoute ? [] : [{
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      },
      audio: true
    }]),
    // Priority 6: Simple video with audio (RISKY - could be desktop)
    ...(isParticipantRoute ? [] : [{
      video: true,
      audio: true
    }]),
    // Priority 7: Video only with facingMode (MOBILE SPECIFIC)
    {
      video: {
        facingMode: { ideal: preferredFacing }
      },
      audio: false
    },
    // Priority 8: Video only basic (LAST RESORT)
    ...(isParticipantRoute ? [] : [{
      video: true,
      audio: false
    }])
  ];
  
  for (let i = 0; i < mobileConstraints.length; i++) {
    try {
      // FASE 4: Log permission request details
      logPermissionRequest(mobileConstraints[i], i + 1);
      
      console.log(`📱 FASE 3: Mobile attempt ${i + 1}/${mobileConstraints.length} with constraints:`, mobileConstraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints[i]);
      
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        
        console.log('✅ FASE 3: Mobile stream acquired successfully:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          cameraSettings: settings
        });
        
        // FASE 4: Validate we got a mobile camera
        if (settings?.facingMode) {
          console.log(`🎉 FASE 3: CONFIRMED mobile camera with facingMode: ${settings.facingMode}`);
          
          // Mark as mobile validated retroactively
          sessionStorage.setItem('mobileValidated', 'true');
          sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
          
          return stream;
        } else {
          console.warn('⚠️ FASE 3: Got camera but no facingMode - might be desktop camera accessed via mobile browser');
          
          // FASE 3: If participant route, be strict about mobile cameras
          if (isParticipantRoute && i < 4) {
            console.log('📱 FASE 3: PARTICIPANT ROUTE - Rejecting non-facingMode camera, trying next constraint');
            stream.getTracks().forEach(track => track.stop());
            continue;
          }
          
          // For non-participant or last attempts, accept it
          if (i >= 4 || !isParticipantRoute) {
            console.log('📱 FASE 3: Accepting camera as mobile fallback');
            return stream;
          }
          
          // Clean up and try next constraint
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } catch (error) {
      console.error(`❌ FASE 3: Mobile attempt ${i + 1} failed:`, error);
      
      // If it's a permission error, stop trying
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ FASE 3: Permission denied - cannot continue');
        
        // FASE 4: Log permission denial details
        if (isParticipantRoute) {
          console.error('❌ FASE 4: CRITICAL - Mobile camera permission denied on participant route!');
        }
        
        break;
      }
    }
  }
  
  console.error('❌ FASE 3: All mobile attempts failed');
  return null;
};

const getDesktopStreamWithMobileFallback = async (): Promise<MediaStream | null> => {
  console.log('🖥️ FASE 3: DESKTOP CAPTURE with mobile fallback capability');
  
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
      // FASE 4: Log permission request for desktop
      logPermissionRequest(desktopConstraints[i], i + 1);
      
      console.log(`🖥️ FASE 3: Desktop constraint set ${i + 1}`);
      const stream = await navigator.mediaDevices.getUserMedia(desktopConstraints[i]);
      console.log(`✅ FASE 3: Desktop success with constraint set ${i + 1}`);
      return stream;
    } catch (error) {
      console.log(`⚠️ FASE 3: Desktop constraint set ${i + 1} failed:`, error);
    }
  }
  
  console.error('❌ FASE 3: All desktop constraint sets failed');
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
  console.log('🧪 FASE 4: TESTING mobile camera capabilities...');
  
  const facingModes = ['environment', 'user'];
  for (const facingMode of facingModes) {
    try {
      // FASE 4: Log test permission request
      const testConstraints = { video: { facingMode: { ideal: facingMode } } };
      logPermissionRequest(testConstraints, 0);
      
      const testStream = await navigator.mediaDevices.getUserMedia(testConstraints);
      
      const settings = testStream.getVideoTracks()[0]?.getSettings();
      console.log(`✅ FASE 4: ${facingMode} camera available:`, settings);
      
      // Clean up test stream
      testStream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.log(`❌ FASE 4: ${facingMode} camera not available:`, error.name);
    }
  }
};
