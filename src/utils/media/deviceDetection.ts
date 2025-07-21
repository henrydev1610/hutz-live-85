
/**
 * Enhanced mobile device detection with QR code access priority
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
  // Check cache first
  const cachedData = localStorage.getItem('deviceDetectionCache');
  if (cachedData) {
    try {
      const { isMobile, version, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > 5000; // Shorter cache for participant page
      
      if (!isExpired && version === DEVICE_DETECTION_VERSION) {
        console.log(`📱 DEVICE DETECTION: Using cached result: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
        return isMobile;
      }
    } catch (error) {
      console.warn('⚠️ DEVICE DETECTION: Invalid cache, clearing');
      localStorage.removeItem('deviceDetectionCache');
    }
  }

  console.log('🔍 DEVICE DETECTION: Performing AGGRESSIVE fresh detection');
  
  // 1. QR CODE ACCESS - HIGHEST PRIORITY for mobile detection
  const urlParams = new URLSearchParams(window.location.search);
  const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true' || 
                     urlParams.has('mobile') || urlParams.get('mobile') === 'true';
  const isQRAccess = hasQRParam || 
    document.referrer.includes('qr') || 
    sessionStorage.getItem('accessedViaQR') === 'true' ||
    window.location.pathname.includes('/participant/');
    
  if (isQRAccess) {
    console.log('📱 DEVICE DETECTION: QR/Participant access detected - FORCING MOBILE');
    sessionStorage.setItem('accessedViaQR', 'true');
    cacheDeviceDetection(true);
    return true;
  }
  
  // 2. Enhanced User Agent Check with mobile-specific patterns
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'iphone', 'ipad', 'ipod', 'mobile', 'mobi', 
    'blackberry', 'opera mini', 'windows phone', 'samsung',
    'webos', 'symbian', 'series60', 'series40', 'palm',
    'avantgo', 'blazer', 'elaine', 'hiptop', 'plucker',
    'xiino', 'fennec', 'maemo', 'iris', 'kindle', 'silk'
  ];
  const mobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // 3. Enhanced Touch Detection
  const hasTouchScreen = 'ontouchstart' in window && 
                        navigator.maxTouchPoints > 0 &&
                        window.TouchEvent !== undefined;
  
  // 4. Screen Size Detection (more aggressive for mobile)
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const isSmallScreen = Math.min(screenWidth, screenHeight) <= 768 ||
                       Math.min(viewportWidth, viewportHeight) <= 768;
  
  // 5. Orientation API (mobile-specific)
  const hasOrientationAPI = 'orientation' in window;
  
  // 6. Device Memory (typically lower on mobile)
  const deviceMemory = (navigator as any).deviceMemory;
  const lowMemory = deviceMemory !== undefined && deviceMemory <= 4;
  
  // 7. Hardware Concurrency (mobile typically has fewer cores exposed)
  const hardwareConcurrency = navigator.hardwareConcurrency;
  const limitedCores = hardwareConcurrency !== undefined && hardwareConcurrency <= 8;
  
  // 8. Connection Type (mobile-specific)
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const hasCellularConnection = connection && (
    connection.effectiveType === '2g' || 
    connection.effectiveType === '3g' || 
    connection.effectiveType === '4g' ||
    connection.type === 'cellular'
  );
  
  // Enhanced scoring system for mobile detection
  let mobileScore = 0;
  if (mobileUA) mobileScore += 4;           // User agent is strong indicator
  if (hasTouchScreen) mobileScore += 3;     // Touch is very strong indicator  
  if (isSmallScreen) mobileScore += 2;      // Small screen suggests mobile
  if (hasOrientationAPI) mobileScore += 1;  // Orientation API
  if (lowMemory) mobileScore += 1;          // Lower memory
  if (limitedCores) mobileScore += 1;       // Fewer cores
  if (hasCellularConnection) mobileScore += 2; // Cellular connection
  
  // Threshold: 4+ points = mobile (more conservative than before)
  const isMobile = mobileScore >= 4;
  
  // FORCE OVERRIDE for debugging
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : isMobile;
  
  console.log('📱 ENHANCED Mobile Detection:', {
    userAgent: navigator.userAgent,
    mobileUA,
    hasTouchScreen,
    touchPoints: navigator.maxTouchPoints,
    isSmallScreen,
    screenSize: `${screenWidth}x${screenHeight}`,
    viewportSize: `${viewportWidth}x${viewportHeight}`,
    hasOrientationAPI,
    lowMemory,
    deviceMemory,
    limitedCores,
    hardwareConcurrency,
    hasCellularConnection,
    connectionType: connection?.effectiveType,
    mobileScore,
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

// Backward compatibility
export const detectMobile = detectMobileAggressively;

export const checkMediaDevicesSupport = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

export const getCameraPreference = (): 'user' | 'environment' => {
  // For mobile, default to 'environment' (rear camera)
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
  const isParticipantRoute = window.location.pathname.includes('/participant/');
  
  if (!isMobile && isParticipantRoute) {
    return {
      isValid: false,
      reason: 'Desktop device detected on mobile-only participant page'
    };
  }
  
  if (!isMobile && !hasQRAccess) {
    return {
      isValid: false,
      reason: 'No QR code access detected for non-mobile device'
    };
  }
  
  return {
    isValid: true,
    reason: 'Valid mobile access detected'
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
