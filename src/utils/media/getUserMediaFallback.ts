// SIMPLIFIED getUserMedia with separate mobile/desktop logic
import { detectMobileAggressively, checkMediaDevicesSupport } from './deviceDetection';
import { MOBILE_MEDIA_CONSTRAINTS, MEDIA_CONSTRAINTS } from '@/utils/webrtc/WebRTCConfig';
import { ensurePermissionsBeforeStream } from './streamAcquisition';
import { enumerateMediaDevices, findBackCamera } from './deviceEnumeration';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'MOBILE' : 'DESKTOP';
  
  console.log(`🎬 CAMERA: Starting ${deviceType} camera acquisition`);
  console.log(`📱 Device Info: ${navigator.userAgent}`);
  console.log(`📱 URL: ${window.location.href}`);
  console.log(`🔒 HTTPS: ${window.location.protocol === 'https:'}`);

  // 🔒 CRITICAL: Check HTTPS for mobile
  if (isMobile && window.location.protocol !== 'https:') {
    console.error('❌ HTTPS: Mobile camera requires HTTPS!');
    throw new Error('Camera access requires HTTPS on mobile devices');
  }

  // Check basic support
  if (!checkMediaDevicesSupport()) {
    console.error('❌ CAMERA: getUserMedia not supported');
    throw new Error('getUserMedia not supported');
  }

  // CRÍTICO: Verificar e solicitar permissões antes de tentar aquisição
  console.log('🔐 CAMERA: Ensuring permissions before acquisition...');
  const permissionsOk = await ensurePermissionsBeforeStream(isMobile);
  
  if (!permissionsOk) {
    console.error('❌ CAMERA: Permissions not granted - will likely get "NOT FOUND"');
    // Continue mesmo assim para tentar, pois alguns browsers são inconsistentes
  }

  try {
    let stream: MediaStream | null = null;
    
    if (isMobile) {
      console.log('📱 CAMERA: Using MOBILE camera logic with BACK camera priority');
      stream = await getMobileStreamWithBackCamera();
    } else {
      console.log('🖥️ CAMERA: Using DESKTOP camera logic');
      stream = await getDesktopStream();
    }
    
    if (stream && validateStream(stream)) {
      console.log(`✅ CAMERA: ${deviceType} camera acquired successfully`);
      return stream;
    } else {
      console.error(`❌ CAMERA: ${deviceType} camera acquisition failed`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ CAMERA: ${deviceType} error:`, error);
    return null;
  }
};

const getMobileStreamWithBackCamera = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE: Starting mobile camera acquisition with BACK camera priority');
  
  // 🎯 STEP 1: Try to enumerate devices first to find specific back camera
  let backCamera: MediaDeviceInfo | undefined;
  
  try {
    const deviceInfo = await enumerateMediaDevices();
    backCamera = deviceInfo.backCamera;
    
    if (backCamera) {
      console.log('🎯 MOBILE: Found back camera device:', backCamera.label);
    } else {
      console.log('🎯 MOBILE: No specific back camera found, using facingMode fallback');
    }
  } catch (error) {
    console.warn('⚠️ MOBILE: Device enumeration failed, using facingMode only:', error);
  }
  
  // 🎯 STEP 2: Build constraints with BACK CAMERA PRIORITY
  const constraints: MediaStreamConstraints[] = [];
  
  // 🥇 PRIORITY 1: Use specific back camera deviceId if found with optimized settings
  if (backCamera && backCamera.deviceId) {
    constraints.push({
      video: { 
        deviceId: { exact: backCamera.deviceId },
        ...MOBILE_MEDIA_CONSTRAINTS.video
      },
      audio: false // Start without audio for higher success rate
    });
  }
  
  // 🥈 PRIORITY 2: EXACT environment facingMode with optimized settings
  constraints.push({
    video: { 
      facingMode: { exact: 'environment' },
      ...MOBILE_MEDIA_CONSTRAINTS.video
    },
    audio: false
  });
  
  // 🥉 PRIORITY 3: IDEAL environment facingMode with optimized settings
  constraints.push({
    video: { 
      facingMode: { ideal: 'environment' },
      ...MOBILE_MEDIA_CONSTRAINTS.video
    },
    audio: false
  });
  
  // 🏅 PRIORITY 4: Basic video with mobile constraints
  constraints.push({
    video: MOBILE_MEDIA_CONSTRAINTS.video,
    audio: false
  });
  
  // 💔 PRIORITY 5: Front camera fallback with mobile constraints
  constraints.push({
    video: { 
      facingMode: { ideal: 'user' },
      ...MOBILE_MEDIA_CONSTRAINTS.video
    },
    audio: false
  });

  // 🎯 STEP 3: Try each constraint with timeout
  for (let i = 0; i < constraints.length; i++) {
    try {
      console.log(`📱 MOBILE ATTEMPT ${i + 1}/${constraints.length}:`, constraints[i]);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );
      
      const streamPromise = navigator.mediaDevices.getUserMedia(constraints[i]);
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      
      if (stream && stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        console.log('✅ MOBILE: Successfully acquired camera:', {
          label: videoTrack.label,
          facingMode: settings.facingMode || 'unknown',
          deviceId: settings.deviceId || 'unknown'
        });
        
        // 🎯 Check if this is actually the back camera
        if (settings.facingMode === 'environment' || 
            (backCamera && settings.deviceId === backCamera.deviceId)) {
          console.log('🎯 SUCCESS: Back camera confirmed!');
        } else {
          console.log('📱 INFO: Using available camera (may not be back camera)');
        }
        
        return stream;
      }
    } catch (error) {
      console.warn(`❌ MOBILE ATTEMPT ${i + 1} failed:`, error);
      // Wait 1 second between attempts to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('❌ MOBILE: All attempts failed - no camera available');
  return null;
};

const getDesktopStream = async (): Promise<MediaStream | null> => {
  console.log('🖥️ DESKTOP: Starting desktop camera acquisition');
  
  const constraints: MediaStreamConstraints[] = [
    // Desktop - optimized constraints
    {
      video: MEDIA_CONSTRAINTS.video,
      audio: MEDIA_CONSTRAINTS.audio
    },
    // Basic desktop constraints
    {
      video: true,
      audio: true
    },
    // Video only fallback
    {
      video: true,
      audio: false
    }
  ];

  for (let i = 0; i < constraints.length; i++) {
    try {
      console.log(`🖥️ DESKTOP ATTEMPT ${i + 1}/${constraints.length}:`, constraints[i]);
      const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
      
      if (stream && stream.getVideoTracks().length > 0) {
        console.log('✅ DESKTOP: Successfully acquired desktop camera');
        return stream;
      }
    } catch (error) {
      console.warn(`❌ DESKTOP ATTEMPT ${i + 1} failed:`, error);
    }
  }
  
  console.error('❌ DESKTOP: All attempts failed');
  return null;
};

const validateStream = (stream: MediaStream | null): boolean => {
  if (!stream) {
    console.error('❌ VALIDATION: No stream provided');
    return false;
  }
  
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  if (videoTracks.length === 0) {
    console.error('❌ VALIDATION: No video tracks found');
    return false;
  }
  
  console.log('✅ VALIDATION: Stream is valid', {
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length,
    videoEnabled: videoTracks[0]?.enabled,
    audioEnabled: audioTracks[0]?.enabled
  });
  
  return true;
};