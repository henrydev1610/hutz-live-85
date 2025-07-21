
/**
 * Simplified and unified mobile device detection with cache busting
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
      const isExpired = Date.now() - timestamp > 10000; // 10 seconds cache
      
      if (!isExpired && version === DEVICE_DETECTION_VERSION) {
        console.log(`📱 DEVICE DETECTION: Using cached result: ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
        return isMobile;
      }
    } catch (error) {
      console.warn('⚠️ DEVICE DETECTION: Invalid cache, clearing');
      localStorage.removeItem('deviceDetectionCache');
    }
  }

  console.log('🔍 DEVICE DETECTION: Performing fresh detection');
  
  // 1. QR CODE ACCESS - Primary indicator for mobile
  const urlParams = new URLSearchParams(window.location.search);
  const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true' || urlParams.has('mobile') || urlParams.get('mobile') === 'true';
  const isQRAccess = hasQRParam || 
    document.referrer.includes('qr') || 
    sessionStorage.getItem('accessedViaQR') === 'true';
    
  if (isQRAccess) {
    console.log('📱 DEVICE DETECTION: QR access detected - MOBILE device');
    sessionStorage.setItem('accessedViaQR', 'true');
    cacheDeviceDetection(true);
    return true;
  }
  
  // 2. Enhanced User Agent Check
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'iphone', 'ipad', 'ipod', 'mobile', 'mobi', 
    'blackberry', 'opera mini', 'windows phone', 'samsung'
  ];
  const mobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
  
  // 3. Touch and Screen Size Detection
  const hasTouchScreen = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
  
  // 4. Orientation API (mobile-specific)
  const hasOrientationAPI = 'orientation' in window || screen.orientation !== undefined;
  
  // 5. Device Memory (typically lower on mobile)
  const deviceMemory = (navigator as any).deviceMemory;
  const lowMemory = deviceMemory !== undefined && deviceMemory <= 4;
  
  // Scoring system for mobile detection
  let mobileScore = 0;
  if (mobileUA) mobileScore += 3;
  if (hasTouchScreen) mobileScore += 2;
  if (smallScreen) mobileScore += 1;
  if (hasOrientationAPI) mobileScore += 1;
  if (lowMemory) mobileScore += 1;
  
  const isMobile = mobileScore >= 3;
  
  // FORCE OVERRIDE for debugging
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : isMobile;
  
  console.log('📱 UNIFIED Mobile Detection:', {
    userAgent: navigator.userAgent,
    mobileUA,
    hasTouchScreen,
    smallScreen,
    hasOrientationAPI,
    lowMemory,
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
  const saved = localStorage.getItem('cameraPreference');
  return (saved as 'user' | 'environment') || 'user';
};

export const setCameraPreference = (preference: 'user' | 'environment'): void => {
  localStorage.setItem('cameraPreference', preference);
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
