
import { detectMobileAggressively, getCameraPreference, validateMobileCameraCapabilities } from './deviceDetection';
import { streamLogger } from '../debug/StreamLogger';

// FASE 3: Check if we're on participant route
const isParticipantRoute = (): boolean => {
  return window.location.pathname.includes('/participant/');
};

// FASE 4: Log permission type being requested
const logPermissionRequest = (constraints: MediaStreamConstraints, attempt: number, participantId: string = 'unknown'): void => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
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
  
  // Log via StreamLogger
  streamLogger.logPermission(participantId, isMobile, deviceType, `request_${attempt}_${permissionType}`);
  streamLogger.logConstraints(participantId, isMobile, deviceType, constraints, attempt);
  
  // FASE 4: Alert if desktop permission is being requested on participant route
  if (isParticipantRoute() && permissionType.includes('DESKTOP')) {
    console.error('❌ FASE 4: CRITICAL - Desktop permission requested on participant route!');
    console.error('❌ FASE 4: This will show desktop webcam dialog instead of mobile camera!');
    
    streamLogger.log(
      'STREAM_ERROR' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0, errorType: 'CRITICAL_DESKTOP_ON_PARTICIPANT' },
      undefined,
      'PERMISSION_ERROR',
      'Desktop permission requested on participant route'
    );
  }
};

export const getUserMediaWithFallback = async (participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const isParticipant = isParticipantRoute();
  
  console.log(`🎬 FASE 1: DIAGNÓSTICO CRÍTICO - Starting media capture process`);
  console.log(`📱 FASE 1: Mobile: ${isMobile}, Participant: ${isParticipant}`);
  console.log(`🔐 FASE 1: Permission API available: ${!!navigator?.permissions}`);
  console.log(`📹 FASE 1: getUserMedia available: ${!!navigator?.mediaDevices?.getUserMedia}`);
  
  // FASE 1: DIAGNÓSTICO CRÍTICO DE PERMISSÕES
  try {
    if (navigator.permissions) {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      
      console.log(`🔐 FASE 1: PERMISSÕES ATUAIS - Camera: ${cameraPermission.state}, Micro: ${micPermission.state}`);
      
      if (cameraPermission.state === 'denied') {
        console.error(`❌ FASE 1: CRÍTICO - Câmera NEGADA pelo usuário`);
        streamLogger.log('STREAM_ERROR' as any, participantId, isMobile, deviceType, 
          { timestamp: Date.now(), duration: 0, errorType: 'CAMERA_PERMISSION_DENIED' },
          undefined, 'PERMISSION_CRITICAL', 'Camera permission denied by user');
        return null;
      }
      
      if (cameraPermission.state === 'prompt') {
        console.log(`🔐 FASE 1: Câmera requer permissão - dialog será exibido`);
      }
    }
  } catch (permError) {
    console.warn(`⚠️ FASE 1: Não foi possível verificar permissões:`, permError);
  }
  
  // FASE 1: TIMEOUT PARA DETECÇÃO DE PERMISSION DIALOG
  const mediaPromise = (isParticipant || isMobile) ? 
    getMobileStreamWithForceValidation(isParticipant, participantId) :
    getDesktopStreamWithMobileFallback(participantId);
    
  const timeoutPromise = new Promise<MediaStream | null>((_, reject) => {
    setTimeout(() => {
      reject(new Error('TIMEOUT: Permission dialog ignored or taking too long (10s)'));
    }, 10000);
  });
  
  try {
    const result = await Promise.race([mediaPromise, timeoutPromise]);
    
    if (result) {
      console.log(`✅ FASE 1: SUCESSO - Stream capturado:`, {
        streamId: result.id,
        active: result.active,
        tracks: result.getTracks().length
      });
      
      streamLogger.log('STREAM_SUCCESS' as any, participantId, isMobile, deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined, 'MEDIA_CAPTURE', 'Stream captured successfully');
    }
    
    return result;
  } catch (error) {
    console.error(`❌ FASE 1: FALHA NA CAPTURA:`, error);
    
    if (error instanceof Error && error.message.includes('TIMEOUT')) {
      console.error(`⏰ FASE 1: TIMEOUT - Permission dialog pode ter sido ignorado`);
      streamLogger.log('STREAM_ERROR' as any, participantId, isMobile, deviceType,
        { timestamp: Date.now(), duration: 0, errorType: 'PERMISSION_TIMEOUT' },
        undefined, 'PERMISSION_CRITICAL', 'Permission dialog timeout');
    }
    
    return null;
  }
  
  // FASE 3: If participant route, ALWAYS force mobile behavior
  if (isParticipant) {
    console.log('📱 FASE 3: PARTICIPANT ROUTE - FORCING MOBILE CAMERA ACQUISITION');
    streamLogger.log(
      'STREAM_START' as any,
      participantId,
      true, // Force mobile
      'mobile',
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'PARTICIPANT_ROUTE',
      'Forcing mobile camera acquisition on participant route'
    );
    return await getMobileStreamWithForceValidation(true, participantId);
  }
  
  // FASE 3: If forced mobile, validate camera capabilities first
  if (isMobile) {
    console.log('📱 FASE 3: MOBILE FORCED - Validating camera capabilities before stream acquisition');
    
    streamLogger.log(
      'VALIDATION' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'CAPABILITY_CHECK',
      'Validating mobile camera capabilities'
    );
    
    const hasValidCamera = await validateMobileCameraCapabilities();
    
    if (hasValidCamera) {
      console.log('✅ FASE 3: MOBILE FORCED - Camera capabilities validated - proceeding with mobile stream');
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: 'camera_capabilities_validated'
      });
    } else {
      console.log('⚠️ FASE 3: MOBILE FORCED - Camera validation inconclusive - proceeding anyway');
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: 'camera_validation_inconclusive',
        action: 'proceeding_anyway'
      });
    }
    
    return await getMobileStreamWithForceValidation(false, participantId);
  }
  
  // Desktop logic with mobile fallback
  return await getDesktopStreamWithMobileFallback(participantId);
};

const getMobileStreamWithForceValidation = async (isParticipantRoute: boolean, participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const deviceType = 'mobile';
  const isMobile = true;
  
  console.log(`📱 FASE 3: MOBILE CAPTURE - ${isParticipantRoute ? 'PARTICIPANT ROUTE' : 'FORCED'} mobile camera acquisition`);
  
  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'MOBILE_CAPTURE',
    `Mobile capture ${isParticipantRoute ? 'PARTICIPANT ROUTE' : 'FORCED'}`,
    { isParticipantRoute }
  );
  
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
    const startTime = Date.now();
    
    try {
      // FASE 4: Log permission request details
      logPermissionRequest(mobileConstraints[i], i + 1, participantId);
      
      console.log(`📱 FASE 3: Mobile attempt ${i + 1}/${mobileConstraints.length} with constraints:`, mobileConstraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints[i]);
      
      if (stream) {
        const duration = Date.now() - startTime;
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        
        console.log('✅ FASE 3: Mobile stream acquired successfully:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          cameraSettings: settings
        });
        
        // Log sucesso via StreamLogger
        streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);
        
        // FASE 4: Validate we got a mobile camera
        if (settings?.facingMode) {
          console.log(`🎉 FASE 3: CONFIRMED mobile camera with facingMode: ${settings.facingMode}`);
          
          streamLogger.logValidation(participantId, isMobile, deviceType, true, {
            reason: 'mobile_camera_confirmed',
            facingMode: settings.facingMode,
            attempt: i + 1
          });
          
          // Mark as mobile validated retroactively
          sessionStorage.setItem('mobileValidated', 'true');
          sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
          
          return stream;
        } else {
          console.warn('⚠️ FASE 3: Got camera but no facingMode - might be desktop camera accessed via mobile browser');
          
          streamLogger.logValidation(participantId, isMobile, deviceType, false, {
            reason: 'no_facing_mode_detected',
            attempt: i + 1,
            settings
          });
          
          // FASE 3: If participant route, be strict about mobile cameras
          if (isParticipantRoute && i < 4) {
            console.log('📱 FASE 3: PARTICIPANT ROUTE - Rejecting non-facingMode camera, trying next constraint');
            stream.getTracks().forEach(track => {
              streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_rejected', track);
              track.stop();
            });
            continue;
          }
          
          // For non-participant or last attempts, accept it
          if (i >= 4 || !isParticipantRoute) {
            console.log('📱 FASE 3: Accepting camera as mobile fallback');
            streamLogger.logValidation(participantId, isMobile, deviceType, true, {
              reason: 'mobile_fallback_accepted',
              attempt: i + 1
            });
            return stream;
          }
          
          // Clean up and try next constraint
          stream.getTracks().forEach(track => {
            streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped', track);
            track.stop();
          });
        }
      }
    } catch (error) {
      console.error(`❌ FASE 3: Mobile attempt ${i + 1} failed:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);
      
      // If it's a permission error, stop trying
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ FASE 3: Permission denied - cannot continue');
        
        streamLogger.logPermission(participantId, isMobile, deviceType, 'permission_denied');
        
        // FASE 4: Log permission denial details
        if (isParticipantRoute) {
          console.error('❌ FASE 4: CRITICAL - Mobile camera permission denied on participant route!');
          streamLogger.log(
            'STREAM_ERROR' as any,
            participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: 0, errorType: 'PERMISSION_DENIED_PARTICIPANT' },
            undefined,
            'PERMISSION_CRITICAL',
            'Mobile camera permission denied on participant route'
          );
        }
        
        break;
      }
    }
  }
  
  console.error('❌ FASE 3: All mobile attempts failed');
  streamLogger.log(
    'STREAM_ERROR' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0, errorType: 'ALL_MOBILE_ATTEMPTS_FAILED' },
    undefined,
    'MOBILE_CAPTURE',
    'All mobile capture attempts failed'
  );
  
  return null;
};

const getDesktopStreamWithMobileFallback = async (participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const deviceType = 'desktop';
  const isMobile = false;
  
  console.log('🖥️ FASE 3: DESKTOP CAPTURE with mobile fallback capability');
  
  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'DESKTOP_CAPTURE',
    'Desktop capture with mobile fallback'
  );
  
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
    const startTime = Date.now();
    
    try {
      // FASE 4: Log permission request for desktop
      logPermissionRequest(desktopConstraints[i], i + 1, participantId);
      
      console.log(`🖥️ FASE 3: Desktop constraint set ${i + 1}`);
      const stream = await navigator.mediaDevices.getUserMedia(desktopConstraints[i]);
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ FASE 3: Desktop success with constraint set ${i + 1}`);
      
      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);
      
      return stream;
    } catch (error) {
      console.log(`⚠️ FASE 3: Desktop constraint set ${i + 1} failed:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);
    }
  }
  
  console.error('❌ FASE 3: All desktop constraint sets failed');
  streamLogger.log(
    'STREAM_ERROR' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0, errorType: 'ALL_DESKTOP_ATTEMPTS_FAILED' },
    undefined,
    'DESKTOP_CAPTURE',
    'All desktop capture attempts failed'
  );
  
  return null;
};

// Enhanced camera info for debugging
export const getCameraInfo = async (participantId: string = 'unknown'): Promise<void> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
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
    
    // Log dispositivos via StreamLogger
    streamLogger.logDeviceEnumeration(participantId, isMobile, deviceType, videoDevices);
    
    // Test mobile capabilities if requested
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') || urlParams.has('forceMobile')) {
      await testMobileCameraCapabilities(participantId);
    }
  } catch (error) {
    console.error('❌ CAMERA INFO: Failed to enumerate devices:', error);
    streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
  }
};

const testMobileCameraCapabilities = async (participantId: string = 'unknown') => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  console.log('🧪 FASE 4: TESTING mobile camera capabilities...');
  
  streamLogger.log(
    'VALIDATION' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'CAPABILITY_TEST',
    'Testing mobile camera capabilities'
  );
  
  const facingModes = ['environment', 'user'];
  for (const facingMode of facingModes) {
    try {
      // FASE 4: Log test permission request
      const testConstraints = { video: { facingMode: { ideal: facingMode } } };
      logPermissionRequest(testConstraints, 0, participantId);
      
      const testStream = await navigator.mediaDevices.getUserMedia(testConstraints);
      
      const settings = testStream.getVideoTracks()[0]?.getSettings();
      console.log(`✅ FASE 4: ${facingMode} camera available:`, settings);
      
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: `${facingMode}_camera_available`,
        settings
      });
      
      // Clean up test stream
      testStream.getTracks().forEach(track => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'test_track_stopped', track);
        track.stop();
      });
    } catch (error) {
      console.log(`❌ FASE 4: ${facingMode} camera not available:`, error.name);
      
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: `${facingMode}_camera_not_available`,
        error: error.name
      });
    }
  }
};
