// Ultra-specific mobile camera detection and enforcement
import { detectMobileAggressively } from './deviceDetection';

export const isTrueMobileDevice = async (): Promise<boolean> => {
  const basicMobile = detectMobileAggressively();
  
  if (!basicMobile) {
    console.log('📱 MOBILE DETECTOR: Not detected as mobile by basic detection');
    return false;
  }
  
  // Advanced mobile verification through media devices
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    console.log('📱 MOBILE DETECTOR: Available video devices:', videoDevices.map(d => ({
      deviceId: d.deviceId,
      label: d.label || 'unknown',
      kind: d.kind
    })));
    
    // Test for mobile camera capabilities
    for (const device of videoDevices) {
      try {
        // Try to get a stream with mobile-specific constraints
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: device.deviceId },
            facingMode: { ideal: 'user' }
          }
        });
        
        const videoTrack = testStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        console.log('📱 MOBILE DETECTOR: Device test result:', {
          deviceId: device.deviceId,
          label: device.label,
          settings: {
            facingMode: settings.facingMode,
            width: settings.width,
            height: settings.height
          }
        });
        
        // Clean up test stream
        testStream.getTracks().forEach(track => track.stop());
        
        // If we found a camera with facingMode, it's likely mobile
        if (settings.facingMode) {
          console.log('✅ MOBILE DETECTOR: Confirmed mobile device with facingMode camera');
          return true;
        }
      } catch (testError) {
        console.log('📱 MOBILE DETECTOR: Device test failed:', testError);
        // Continue testing other devices
      }
    }
    
    console.log('⚠️ MOBILE DETECTOR: No mobile cameras found, might be desktop accessed via mobile browser');
    return false;
    
  } catch (error) {
    console.error('❌ MOBILE DETECTOR: Failed to verify mobile device:', error);
    return basicMobile; // Fallback to basic detection
  }
};

export const forceMobileCamera = async (preferredFacing: 'user' | 'environment' = 'user'): Promise<MediaStream | null> => {
  console.log('🎯 FORCE MOBILE CAMERA: Starting AGGRESSIVE mobile-specific camera acquisition');
  
  // Check for QR access first
  const isQRAccess = document.referrer.includes('qr') || 
    window.location.search.includes('qr') || 
    window.location.search.includes('mobile') ||
    sessionStorage.getItem('accessedViaQR') === 'true';
    
  if (isQRAccess) {
    console.log('🎯 FORCE MOBILE CAMERA: QR ACCESS DETECTED - BYPASSING DEVICE VERIFICATION');
    sessionStorage.setItem('accessedViaQR', 'true');
  } else {
    const isActuallyMobile = await isTrueMobileDevice();
    
    if (!isActuallyMobile) {
      console.warn('⚠️ FORCE MOBILE CAMERA: Device verification failed, not a true mobile device');
      return null;
    }
  }
  
  const mobileConstraints: MediaStreamConstraints[] = [
    // Ultra-specific mobile camera targeting
    {
      video: {
        facingMode: { exact: preferredFacing },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 960 }
      },
      audio: true
    },
    {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 480, max: 800 },
        height: { ideal: 360, max: 600 }
      },
      audio: true
    },
    {
      video: {
        facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { ideal: 480 },
        height: { ideal: 360 }
      },
      audio: false
    },
    {
      video: {
        facingMode: { ideal: preferredFacing }
      },
      audio: false
    }
  ];
  
  for (let i = 0; i < mobileConstraints.length; i++) {
    try {
      console.log(`🎯 FORCE MOBILE CAMERA: Attempt ${i + 1} with constraints:`, mobileConstraints[i]);
      
      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints[i]);
      
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        
        console.log('✅ FORCE MOBILE CAMERA: Success! Mobile camera acquired:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          cameraSettings: settings
        });
        
        // Verify we got a mobile camera
        if (settings?.facingMode) {
          console.log(`🎉 FORCE MOBILE CAMERA: CONFIRMED mobile camera with facingMode: ${settings.facingMode}`);
          return stream;
        } else {
          console.warn('⚠️ FORCE MOBILE CAMERA: Got camera but no facingMode - might be desktop camera');
          // Keep this stream but continue looking for better one
          if (i === mobileConstraints.length - 1) {
            console.log('📱 FORCE MOBILE CAMERA: Using best available camera');
            return stream;
          }
          // Clean up and try next constraint
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } catch (error) {
      console.error(`❌ FORCE MOBILE CAMERA: Attempt ${i + 1} failed:`, error);
    }
  }
  
  console.error('❌ FORCE MOBILE CAMERA: All attempts failed');
  return null;
};
