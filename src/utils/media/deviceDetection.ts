export const detectMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const checkMediaDevicesSupport = (): boolean => {
  console.log('🔍 DEVICE: Checking media support...');
  
  // Verificar se está em contexto seguro (HTTPS ou localhost)
  const isSecureContext = window.isSecureContext || 
                         window.location.protocol === 'https:' || 
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1';
  
  console.log('🔍 DEVICE: Secure context:', isSecureContext);
  console.log('🔍 DEVICE: Protocol:', window.location.protocol);
  console.log('🔍 DEVICE: Hostname:', window.location.hostname);
  
  if (!isSecureContext) {
    console.error('❌ DEVICE: Not in secure context - getUserMedia requires HTTPS on network IPs');
    return false;
  }
  
  const hasNavigator = typeof navigator !== 'undefined';
  const hasMediaDevices = hasNavigator && 'mediaDevices' in navigator;
  const hasGetUserMedia = hasMediaDevices && 'getUserMedia' in navigator.mediaDevices;
  
  console.log('🔍 DEVICE: Support check:', {
    hasNavigator,
    hasMediaDevices,
    hasGetUserMedia,
    userAgent: navigator?.userAgent
  });
  
  return hasGetUserMedia;
};