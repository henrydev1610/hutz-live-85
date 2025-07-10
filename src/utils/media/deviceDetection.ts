export const detectMobile = (): boolean => {
  // ROBUST Mobile Detection - Multiple checks to ensure accuracy
  
  // 1. User Agent Check (Primary indicator)
  const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // 2. Touch Support Check
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 3. Viewport Check - Mobile typically has smaller screens
  const smallViewport = window.innerWidth <= 768 && window.innerHeight <= 1024;
  
  // 4. Screen properties check
  const mobileScreenRatio = window.screen ? (window.screen.height / window.screen.width) > 1.3 : false;
  
  // 5. Orientation API Check (mostly mobile devices)
  const hasOrientationAPI = 'orientation' in window;
  
  // 6. Device pixel ratio check (mobile devices often have high DPI)
  const highDPI = window.devicePixelRatio && window.devicePixelRatio > 1.5;
  
  // 7. Platform check
  const mobileNavigator = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.platform);
  
  // ROBUST LOGIC: Multiple factors must align for mobile detection
  const isMobileByUA = userAgentMobile || mobileNavigator;
  const isMobileByFeatures = hasTouchScreen && (smallViewport || hasOrientationAPI);
  const isMobileByScreen = mobileScreenRatio && smallViewport;
  
  // Final decision: User Agent OR (Touch + Mobile Features)
  const isMobile = isMobileByUA || (isMobileByFeatures || isMobileByScreen);
  
  // FORCE OVERRIDE for debugging - check localStorage
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : isMobile;
  
  console.log('🔍 ROBUST Device Detection:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    
    // Detection factors
    userAgentMobile,
    mobileNavigator,
    hasTouchScreen,
    smallViewport: `${window.innerWidth}x${window.innerHeight} <= 768x1024 = ${smallViewport}`,
    mobileScreenRatio: window.screen ? `${window.screen.height}/${window.screen.width} = ${(window.screen.height / window.screen.width).toFixed(2)} > 1.3 = ${mobileScreenRatio}` : 'N/A',
    hasOrientationAPI,
    highDPI: `${window.devicePixelRatio} > 1.5 = ${highDPI}`,
    maxTouchPoints: navigator.maxTouchPoints,
    
    // Logic results
    isMobileByUA,
    isMobileByFeatures,
    isMobileByScreen,
    calculatedResult: isMobile,
    
    // Override
    forceDevice,
    FINAL_RESULT: finalResult
  });
  
  // Save detection result for consistency
  localStorage.setItem('detectedDeviceType', finalResult ? 'mobile' : 'desktop');
  
  return finalResult;
};

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
  } else {
    localStorage.setItem('forceDeviceType', type);
  }
  console.log(`🔧 Device type forced to: ${type}`);
  console.log('🔄 Refresh the page to apply changes');
};

// Make available globally for debugging
(window as any).forceDeviceType = forceDeviceType;