// Main getUserMedia fallback orchestrator
import { detectMobile, checkMediaDevicesSupport, getCameraPreference } from './deviceDetection';
import { getDeviceSpecificConstraints } from './mediaConstraints';
import { logDeviceInfo } from './deviceDebugger';
import { checkMediaPermissions, waitForMobilePermissions } from './permissions';
import { enumerateMediaDevices } from './deviceEnumeration';
import { attemptStreamAcquisition, processStreamError, emergencyFallback } from './streamAcquisition';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
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

  // CRITICAL: Mobile-specific camera targeting
  if (isMobile) {
    console.log('📱 MEDIA FALLBACK: MOBILE DEVICE - Using specialized mobile camera acquisition');
    
    try {
      const { forceMobileCamera } = await import('./mobileMediaDetector');
      const preferredFacing = getCameraPreference();
      console.log(`📱 MEDIA FALLBACK: Attempting to force mobile camera: ${preferredFacing}`);
      
      const mobileStream = await forceMobileCamera(preferredFacing);
      
      if (mobileStream) {
        console.log('🎉 MEDIA FALLBACK: MOBILE CAMERA SUCCESSFULLY ACQUIRED!');
        return mobileStream;
      } else {
        console.warn('⚠️ MEDIA FALLBACK: Mobile camera acquisition failed, falling back to generic constraints');
      }
    } catch (mobileError) {
      console.error('❌ MEDIA FALLBACK: Mobile camera detector failed:', mobileError);
    }
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
      
      return stream;
      
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