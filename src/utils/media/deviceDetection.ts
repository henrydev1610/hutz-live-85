export const detectMobile = (): boolean => {
  // Check user agent
  const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check touch support
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check viewport dimensions (typical mobile breakpoint)
  const smallViewport = window.innerWidth <= 768;
  
  // Check orientation API availability (mostly mobile)
  const hasOrientationAPI = 'orientation' in window;
  
  console.log('🔍 Device Detection:', {
    userAgent: navigator.userAgent,
    userAgentMobile,
    hasTouchScreen,
    smallViewport,
    hasOrientationAPI,
    windowWidth: window.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints
  });
  
  return userAgentMobile || (hasTouchScreen && smallViewport);
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