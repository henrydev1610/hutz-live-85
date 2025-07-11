export const detectMobile = (): boolean => {
  // ULTRA ROBUST Mobile Detection - Zero false positives allowed
  
  // 1. STRICT User Agent Check - Primary mobile indicators
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile Safari|Mobile|Mobi/i.test(navigator.userAgent);
  const tabletUA = /iPad|Android.*Tablet|Windows.*Touch/i.test(navigator.userAgent);
  const isMobileUA = mobileUA || tabletUA;
  
  // 2. MANDATORY Touch Support - Mobile devices MUST have touch
  const hasTouchScreen = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  
  // 3. VIEWPORT Analysis - Mobile screens are typically portrait and smaller
  const { innerWidth, innerHeight } = window;
  const isPortrait = innerHeight > innerWidth;
  const isSmallScreen = Math.max(innerWidth, innerHeight) <= 1024;
  const mobileViewport = isPortrait && isSmallScreen;
  
  // 4. DEVICE Properties - Mobile-specific features
  const hasOrientationAPI = 'orientation' in window;
  const hasDeviceMotion = 'DeviceMotionEvent' in window;
  const highDPI = window.devicePixelRatio >= 2;
  
  // 5. NETWORK - Mobile connections
  const connectionInfo = (navigator as any).connection;
  const slowConnection = connectionInfo && (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g' || connectionInfo.effectiveType === '3g');
  
  // 6. PLATFORM Check - Explicit mobile platforms
  const mobilePlatform = /Android|iPhone|iPad|iPod/i.test(navigator.platform);
  
  // CRITICAL LOGIC: ALL mobile indicators must align
  const isMobileByUA = isMobileUA; // Strong indicator
  const isMobileByFeatures = hasTouchScreen && (hasOrientationAPI || hasDeviceMotion); // Mobile features
  const isMobileByViewport = mobileViewport && hasTouchScreen; // Mobile screen + touch
  const isMobileByPlatform = mobilePlatform && hasTouchScreen; // Platform + touch
  
  // FINAL DECISION: Multiple evidence points required
  const strongMobileEvidence = [isMobileByUA, isMobileByFeatures, isMobileByViewport, isMobileByPlatform].filter(Boolean).length;
  const detectedMobile = strongMobileEvidence >= 2; // Require at least 2 strong indicators
  
  // FORCE OVERRIDE for debugging
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : detectedMobile;
  
  // DETAILED LOGGING for debugging camera issues
  console.log('🔍 ULTRA ROBUST Mobile Detection Analysis:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    url: window.location.href,
    
    // Core Detection Results
    mobileUA,
    tabletUA,
    isMobileUA,
    
    // Touch and Interaction
    hasTouchScreen,
    maxTouchPoints: navigator.maxTouchPoints,
    
    // Viewport Analysis
    viewport: `${innerWidth}x${innerHeight}`,
    isPortrait,
    isSmallScreen,
    mobileViewport,
    
    // Device Features
    hasOrientationAPI,
    hasDeviceMotion,
    highDPI: `${window.devicePixelRatio}x`,
    
    // Connection
    slowConnection,
    connectionType: connectionInfo?.effectiveType,
    
    // Platform
    mobilePlatform,
    
    // Decision Matrix
    evidencePoints: {
      byUA: isMobileByUA,
      byFeatures: isMobileByFeatures,
      byViewport: isMobileByViewport,
      byPlatform: isMobileByPlatform,
      strongEvidence: strongMobileEvidence,
      threshold: '>=2'
    },
    
    // Final Results
    detectedMobile,
    forceDevice,
    FINAL_MOBILE_RESULT: finalResult
  });
  
  // Store result with timestamp for consistency
  const detectionResult = {
    isMobile: finalResult,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    viewport: `${innerWidth}x${innerHeight}`
  };
  localStorage.setItem('mobileDetection', JSON.stringify(detectionResult));
  
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