
/**
 * FASE 2: Enhanced mobile device detection with ABSOLUTE PARTICIPANT ROUTE PRIORITY
 */

// Cache busting for device detection
const DEVICE_DETECTION_VERSION = Date.now().toString();

export const clearDeviceCache = (): void => {
  console.log('🧹 DEVICE DETECTION: Clearing device cache');
  localStorage.removeItem('deviceDetectionCache');
  localStorage.removeItem('forceDeviceType');
  sessionStorage.removeItem('accessedViaQR');
};

export const detectMobileAggressively = (): boolean => {
  // FASE 2: PARTICIPANT ROUTE ABSOLUTE PRIORITY (HIGHEST PRIORITY)
  const isParticipantRoute = window.location.pathname.includes('/participant/');
  if (isParticipantRoute) {
    console.log('🚀 FASE 2: PARTICIPANT ROUTE DETECTED - ABSOLUTE MOBILE OVERRIDE');
    sessionStorage.setItem('accessedViaQR', 'true');
    sessionStorage.setItem('forcedMobile', 'true');
    sessionStorage.setItem('participantRoute', 'true');
    cacheDeviceDetection(true);
    return true;
  }

  // FASE 1: FORCE OVERRIDE - Check URL parameters (SECOND PRIORITY)
  const urlParams = new URLSearchParams(window.location.search);
  const forceMobile = urlParams.get('forceMobile') === 'true' || urlParams.get('mobile') === 'true';
  const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
  const hasCameraParam = urlParams.get('camera') === 'environment';
  
  // FORCE MOBILE if any mobile indicator is present
  if (forceMobile || hasQRParam || hasCameraParam) {
    console.log('🚀 FASE 2: FORCE MOBILE PARAMS DETECTED - MOBILE OVERRIDE ACTIVATED');
    console.log('🚀 Override reasons:', {
      forceMobile,
      hasQRParam,
      hasCameraParam,
      url: window.location.href
    });
    
    sessionStorage.setItem('accessedViaQR', 'true');
    sessionStorage.setItem('forcedMobile', 'true');
    cacheDeviceDetection(true);
    return true;
  }

  // Check cache first
  const cachedData = localStorage.getItem('deviceDetectionCache');
  if (cachedData) {
    try {
      const { isMobile, version, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > 5000;
      
      if (!isExpired && version === DEVICE_DETECTION_VERSION) {
        console.log(`📱 DEVICE DETECTION: Using cached result: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
        return isMobile;
      }
    } catch (error) {
      console.warn('⚠️ DEVICE DETECTION: Invalid cache, clearing');
      localStorage.removeItem('deviceDetectionCache');
    }
  }

  console.log('🔍 DEVICE DETECTION: Performing ENHANCED fresh detection');
  
  // Enhanced User Agent Check with mobile-specific patterns
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'iphone', 'ipad', 'ipod', 'mobile', 'mobi', 
    'blackberry', 'opera mini', 'windows phone', 'samsung',
    'webos', 'symbian', 'series60', 'series40', 'palm',
    'avantgo', 'blazer', 'elaine', 'hiptop', 'plucker',
    'xiino', 'fennec', 'maemo', 'iris', 'kindle', 'silk'
  ];
  const mobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // Enhanced Touch Detection
  const hasTouchScreen = 'ontouchstart' in window && 
                        navigator.maxTouchPoints > 0 &&
                        window.TouchEvent !== undefined;
  
  // Screen Size Detection (more aggressive for mobile)
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const isSmallScreen = Math.min(screenWidth, screenHeight) <= 768 ||
                       Math.min(viewportWidth, viewportHeight) <= 768;
  
  // Mobile API Detection
  const hasOrientationAPI = 'orientation' in window;
  const hasDeviceMotion = 'DeviceMotionEvent' in window;
  const hasDeviceOrientation = 'DeviceOrientationEvent' in window;
  
  // Network Type (mobile-specific)
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const hasCellularConnection = connection && (
    connection.effectiveType === '2g' || 
    connection.effectiveType === '3g' || 
    connection.effectiveType === '4g' ||
    connection.type === 'cellular'
  );
  
  // FASE 2: Enhanced scoring system with PARTICIPANT ROUTE ABSOLUTE PRIORITY
  let mobileScore = 0;
  
  if (mobileUA) mobileScore += 2;
  if (hasTouchScreen) mobileScore += 2;
  if (isSmallScreen) mobileScore += 1;
  if (hasOrientationAPI) mobileScore += 1;
  if (hasDeviceMotion) mobileScore += 1;
  if (hasDeviceOrientation) mobileScore += 1;
  if (hasCellularConnection) mobileScore += 2;
  
  // REDUCED threshold: 2+ points = mobile (was 4)
  const isMobile = mobileScore >= 2;
  
  // FORCE OVERRIDE for debugging
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : isMobile;
  
  console.log('📱 FASE 2: Enhanced Mobile Detection (PARTICIPANT ROUTE PRIORITY):', {
    userAgent: navigator.userAgent.substring(0, 100),
    mobileUA,
    hasTouchScreen,
    touchPoints: navigator.maxTouchPoints,
    isSmallScreen,
    screenSize: `${screenWidth}x${screenHeight}`,
    viewportSize: `${viewportWidth}x${viewportHeight}`,
    hasOrientationAPI,
    hasDeviceMotion,
    hasDeviceOrientation,
    hasCellularConnection,
    connectionType: connection?.effectiveType,
    mobileScore,
    threshold: 2,
    detectedMobile: isMobile,
    forceDevice,
    FINAL_RESULT: finalResult ? 'MOBILE' : 'DESKTOP'
  });
  
  cacheDeviceDetection(finalResult);
  return finalResult;
};

const cacheDeviceDetection = (isMobile: boolean): void => {
  try {
    const cacheData = {
      isMobile,
      version: DEVICE_DETECTION_VERSION,
      timestamp: Date.now()
    };
    localStorage.setItem('deviceDetectionCache', JSON.stringify(cacheData));
    console.log(`💾 DEVICE DETECTION: Cached result: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
  } catch (error) {
    console.warn('⚠️ DEVICE DETECTION: Failed to cache result:', error);
  }
};

// FASE 3: Mobile camera validation function
export const validateMobileCameraCapabilities = async (): Promise<boolean> => {
  console.log('🧪 FASE 3: VALIDATING mobile camera capabilities...');
  
  try {
    const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
    console.log('📱 CAMERA VALIDATION: Supported constraints:', {
      facingMode: supportedConstraints.facingMode,
      width: supportedConstraints.width,
      height: supportedConstraints.height
    });
    
    // If facingMode is supported, likely mobile
    if (supportedConstraints.facingMode) {
      console.log('✅ CAMERA VALIDATION: facingMode supported - MOBILE CONFIRMED');
      
      // Test environment camera
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        
        const settings = testStream.getVideoTracks()[0]?.getSettings();
        console.log('📱 CAMERA VALIDATION: Environment camera test:', settings);
        
        // Clean up test stream
        testStream.getTracks().forEach(track => track.stop());
        
        if (settings?.facingMode) {
          console.log('✅ CAMERA VALIDATION: Mobile camera CONFIRMED via facingMode test');
          sessionStorage.setItem('mobileValidated', 'true');
          return true;
        }
      } catch (error) {
        console.log('⚠️ CAMERA VALIDATION: Environment camera test failed, trying user camera');
        
        // Try user camera as fallback
        try {
          const userStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'user' } }
          });
          
          const userSettings = userStream.getVideoTracks()[0]?.getSettings();
          userStream.getTracks().forEach(track => track.stop());
          
          if (userSettings?.facingMode) {
            console.log('✅ CAMERA VALIDATION: Mobile confirmed via user camera');
            sessionStorage.setItem('mobileValidated', 'true');
            return true;
          }
        } catch (userError) {
          console.log('❌ CAMERA VALIDATION: Both camera tests failed');
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ CAMERA VALIDATION: Failed to validate mobile capabilities:', error);
    return false;
  }
};

// Backward compatibility
export const detectMobile = detectMobileAggressively;

export const checkMediaDevicesSupport = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

export const getCameraPreference = (): 'user' | 'environment' => {
  // FASE 1: Check URL parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const cameraParam = urlParams.get('camera');
  if (cameraParam === 'environment' || cameraParam === 'user') {
    console.log(`📱 CAMERA PREFERENCE: Using URL parameter: ${cameraParam}`);
    return cameraParam as 'user' | 'environment';
  }
  
  // For mobile or forced mobile, default to 'environment' (rear camera)
  const isMobile = detectMobileAggressively();
  const saved = localStorage.getItem('cameraPreference');
  
  if (saved) {
    return saved as 'user' | 'environment';
  }
  
  // Default preference based on device type
  return isMobile ? 'environment' : 'user';
};

export const setCameraPreference = (preference: 'user' | 'environment'): void => {
  localStorage.setItem('cameraPreference', preference);
  console.log(`📱 CAMERA PREFERENCE: Set to ${preference}`);
};

// Enhanced validation for participant page access
export const validateParticipantAccess = (): { isValid: boolean; reason: string } => {
  const isMobile = detectMobileAggressively();
  const hasQRAccess = sessionStorage.getItem('accessedViaQR') === 'true';
  const hasForcedMobile = sessionStorage.getItem('forcedMobile') === 'true';
  const isParticipantRoute = window.location.pathname.includes('/participant/');
  
  // FASE 2: PARTICIPANT ROUTE should ALWAYS be mobile
  if (isParticipantRoute) {
    console.log('✅ FASE 2: PARTICIPANT ROUTE - ALWAYS VALID (absolute mobile priority)');
    return {
      isValid: true,
      reason: 'Participant route detected - absolute mobile priority'
    };
  }
  
  if (!isMobile && !hasQRAccess && !hasForcedMobile) {
    return {
      isValid: false,
      reason: 'No mobile access detected and no force override'
    };
  }
  
  return {
    isValid: true,
    reason: 'Valid mobile access detected or forced'
  };
};

// Force device type for debugging (call from browser console)
export const forceDeviceType = (type: 'mobile' | 'desktop' | 'auto'): void => {
  if (type === 'auto') {
    localStorage.removeItem('forceDeviceType');
    clearDeviceCache();
  } else {
    localStorage.setItem('forceDeviceType', type);
    clearDeviceCache();
  }
  console.log(`🔧 Device type forced to: ${type}`);
  console.log('🔄 Cache cleared. Detection will refresh on next check.');
};

// Make available globally for debugging
(window as any).forceDeviceType = forceDeviceType;
(window as any).clearDeviceCache = clearDeviceCache;
(window as any).validateParticipantAccess = validateParticipantAccess;
(window as any).validateMobileCameraCapabilities = validateMobileCameraCapabilities;
