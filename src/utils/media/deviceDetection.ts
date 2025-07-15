export const detectMobileAggressively = (): boolean => {
  // SIMPLE and RELIABLE Mobile Detection
  
  // 1. QR CODE ACCESS - Primary indicator for mobile
  const urlParams = new URLSearchParams(window.location.search);
  const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
  const hasMobileParam = urlParams.has('mobile') || urlParams.get('mobile') === 'true';
  const isQRAccess = hasQRParam || hasMobileParam || 
    document.referrer.includes('qr') || 
    sessionStorage.getItem('accessedViaQR') === 'true';
    
  if (isQRAccess) {
    console.log('📱 SIMPLE MOBILE: QR access detected - MOBILE device');
    sessionStorage.setItem('accessedViaQR', 'true');
    return true;
  }
  
  // 2. User Agent Check - Basic mobile detection
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile Safari|Mobile|Mobi/i.test(navigator.userAgent);
  const hasTouchScreen = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
  
  // Simple logic: mobile UA + touch = mobile device
  const detectedMobile = mobileUA && hasTouchScreen;
  
  // FORCE OVERRIDE for debugging
  const forceDevice = localStorage.getItem('forceDeviceType');
  const finalResult = forceDevice === 'mobile' ? true : forceDevice === 'desktop' ? false : detectedMobile;
  
  console.log('📱 SIMPLE Mobile Detection:', {
    isQRAccess,
    mobileUA,
    hasTouchScreen,
    detectedMobile,
    forceDevice,
    FINAL_RESULT: finalResult ? 'MOBILE' : 'DESKTOP'
  });
  
  return finalResult;
};

// Backward compatibility
export const detectMobile = detectMobileAggressively;

export const checkMediaDevicesSupport = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

export const getCameraPreference = (): 'user' | 'environment' => {
  const saved = localStorage.getItem('cameraPreference');
  
  // Se não há preferência salva, usar 'environment' (traseira) como padrão em mobile
  if (!saved) {
    const isMobile = detectMobileAggressively();
    return isMobile ? 'environment' : 'user';
  }
  
  return (saved as 'user' | 'environment');
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