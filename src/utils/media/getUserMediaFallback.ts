// SIMPLIFIED getUserMedia with separate mobile/desktop logic
import { detectMobileAggressively, checkMediaDevicesSupport } from './deviceDetection';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'MOBILE' : 'DESKTOP';
  
  console.log(`🎬 CAMERA: Starting ${deviceType} camera acquisition`);
  console.log(`📱 Device Info: ${navigator.userAgent}`);
  console.log(`📱 URL: ${window.location.href}`);

  // Check basic support
  if (!checkMediaDevicesSupport()) {
    console.error('❌ CAMERA: getUserMedia not supported');
    throw new Error('getUserMedia not supported');
  }

  try {
    let stream: MediaStream | null = null;
    
    if (isMobile) {
      console.log('📱 CAMERA: Using MOBILE camera logic');
      stream = await getMobileStream();
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

const getMobileStream = async (): Promise<MediaStream | null> => {
  console.log('📱 MOBILE: Starting mobile camera acquisition');
  
  const constraints: MediaStreamConstraints[] = [
    // Try user camera first
    {
      video: { facingMode: 'user' },
      audio: true
    },
    // Try environment camera
    {
      video: { facingMode: 'environment' },
      audio: true
    },
    // Fallback without facingMode
    {
      video: true,
      audio: true
    },
    // Last resort - video only
    {
      video: true,
      audio: false
    }
  ];

  for (let i = 0; i < constraints.length; i++) {
    try {
      console.log(`📱 MOBILE ATTEMPT ${i + 1}/${constraints.length}:`, constraints[i]);
      const stream = await navigator.mediaDevices.getUserMedia(constraints[i]);
      
      if (stream && stream.getVideoTracks().length > 0) {
        console.log('✅ MOBILE: Successfully acquired mobile camera');
        return stream;
      }
    } catch (error) {
      console.warn(`❌ MOBILE ATTEMPT ${i + 1} failed:`, error);
    }
  }
  
  console.error('❌ MOBILE: All attempts failed');
  return null;
};

const getDesktopStream = async (): Promise<MediaStream | null> => {
  console.log('🖥️ DESKTOP: Starting desktop camera acquisition');
  
  const constraints: MediaStreamConstraints[] = [
    // Desktop - NO facingMode
    {
      video: { width: 1280, height: 720 },
      audio: true
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