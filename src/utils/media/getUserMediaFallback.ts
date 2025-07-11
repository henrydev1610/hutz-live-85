// Main getUserMedia fallback orchestrator
import { detectMobileAggressively, checkMediaDevicesSupport, getCameraPreference } from './deviceDetection';
import { getDeviceSpecificConstraints } from './mediaConstraints';
import { logDeviceInfo } from './deviceDebugger';
import { checkMediaPermissions, waitForMobilePermissions } from './permissions';
import { enumerateMediaDevices } from './deviceEnumeration';
import { attemptStreamAcquisition, processStreamError, emergencyFallback } from './streamAcquisition';
import { rejectNonMobileStream } from './streamValidation';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  
  // Comprehensive logging
  logDeviceInfo();
  console.log(`🎬 MEDIA FALLBACK: Starting ULTRA ROBUST attempt for ${deviceType.toUpperCase()}`);
  console.log(`🎯 DEVICE DETECTION: ${deviceType} (isMobile: ${isMobile})`);
  console.log(`📱 CONTEXT: UA: ${navigator.userAgent}`);
  console.log(`📱 CONTEXT: Platform: ${navigator.platform}`);
  console.log(`📱 CONTEXT: URL: ${window.location.href}`);
  console.log(`📱 CONTEXT: Viewport: ${window.innerWidth}x${window.innerHeight}`);

  // Check basic support
  if (!checkMediaDevicesSupport()) {
    console.error('❌ MEDIA: getUserMedia não é suportado neste navegador');
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // CRITICAL: Mobile-specific camera targeting with retry logic
  if (isMobile) {
    console.log('📱 MEDIA FALLBACK: MOBILE DEVICE - Using ABSOLUTE mobile camera acquisition');
    
    for (let mobileAttempt = 0; mobileAttempt < 3; mobileAttempt++) {
      try {
        const { forceMobileCamera } = await import('./mobileMediaDetector');
        const preferredFacing = getCameraPreference();
        console.log(`📱 MEDIA FALLBACK: Mobile attempt ${mobileAttempt + 1}/3 - forcing camera: ${preferredFacing}`);
        
        const mobileStream = await forceMobileCamera(preferredFacing);
        
        if (mobileStream) {
          // RIGOROUS validation for mobile streams
          const { rejectNonMobileStream } = await import('./streamValidation');
          const validatedStream = await rejectNonMobileStream(mobileStream, true);
          
          if (validatedStream) {
            console.log('🎉 MEDIA FALLBACK: MOBILE CAMERA SUCCESSFULLY ACQUIRED AND VALIDATED!');
            return validatedStream;
          } else {
            console.error(`❌ MOBILE ATTEMPT ${mobileAttempt + 1}: Stream rejected - desktop camera detected`);
            // Continue retry loop
          }
        } else {
          console.warn(`⚠️ MOBILE ATTEMPT ${mobileAttempt + 1}: Mobile camera acquisition returned null`);
        }
      } catch (mobileError) {
        console.error(`❌ MOBILE ATTEMPT ${mobileAttempt + 1}: Mobile camera detector failed:`, mobileError);
      }
      
      // Wait before retry
      if (mobileAttempt < 2) {
        console.log(`⏳ MOBILE RETRY: Waiting 1s before attempt ${mobileAttempt + 2}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.error('❌ MEDIA FALLBACK: ALL MOBILE ATTEMPTS FAILED - falling back to generic constraints');
  }

  // Wait for mobile permissions
  await waitForMobilePermissions(isMobile);

  // Check permissions
  const permissions = await checkMediaPermissions();

  // Enumerate devices
  const deviceInfo = await enumerateMediaDevices();

  // Get constraints and start attempts
  const constraintsList = getDeviceSpecificConstraints();
  let lastError: any = null;
  
  console.log(`🎯 MEDIA: Starting ${constraintsList.length} constraint attempts for ${deviceType.toUpperCase()}`);

  for (let i = 0; i < constraintsList.length; i++) {
    try {
      const stream = await attemptStreamAcquisition(
        constraintsList[i],
        i + 1,
        constraintsList.length,
        isMobile,
        deviceType
      );
      
      // CRITICAL: Validate mobile stream has mobile camera
      const validatedStream = await rejectNonMobileStream(stream, isMobile);
      
      if (!validatedStream && isMobile) {
        console.error(`❌ MOBILE STREAM REJECTED: Desktop camera detected on mobile, retrying...`);
        throw new Error('Desktop camera detected on mobile device');
      }
      
      return validatedStream || stream;
      
    } catch (error) {
      lastError = error;
      const skipToIndex = processStreamError(error, i + 1, constraintsList, isMobile, deviceType);
      
      // Handle skip logic
      if (skipToIndex > i) {
        i = skipToIndex - 1; // -1 because loop will increment
      }
    }
  }

  // All attempts failed
  console.error(`❌ MEDIA: ALL ${constraintsList.length} ATTEMPTS FAILED`);
  console.error(`❌ MEDIA: Final error:`, {
    name: lastError?.name,
    message: lastError?.message,
    isMobile,
    deviceInfo,
    permissions
  });
  
  // Emergency fallback
  const emergencyStream = await emergencyFallback();
  if (emergencyStream) {
    return emergencyStream;
  }

  console.warn(`⚠️ MEDIA: Returning null - entering degraded mode`);
  return null;
};