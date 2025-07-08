export const detectMobile = (): boolean => {
  // Check for touch capability and mobile user agents
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const smallScreen = window.screen.width <= 768;
  
  return hasTouchScreen || mobileUserAgent || smallScreen;
};

export const checkMediaDevicesSupport = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

export const waitForStableConditions = async (delay: number = 1000): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, delay));
};