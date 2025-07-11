// Media permissions handling
export interface PermissionStatus {
  camera: PermissionState | 'unknown';
  microphone: PermissionState | 'unknown';
}

export const checkMediaPermissions = async (): Promise<PermissionStatus> => {
  let cameraPermission: PermissionState | 'unknown' = 'unknown';
  let micPermission: PermissionState | 'unknown' = 'unknown';
  
  console.log('🔐 PERMISSIONS: Checking media permissions...');
  
  try {
    if (navigator.permissions) {
      const cameraQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      cameraPermission = cameraQuery.state;
      micPermission = micQuery.state;
      
      console.log(`🎥 PERMISSIONS: Camera: ${cameraPermission}, Microphone: ${micPermission}`);
      
      if (cameraPermission === 'denied') {
        console.error('❌ PERMISSIONS: Camera permission DENIED - this will cause "NOT FOUND"');
        throw new Error('Permissão de câmera negada - acesse as configurações do navegador');
      }
      
      if (micPermission === 'denied') {
        console.warn('⚠️ PERMISSIONS: Microphone permission denied (camera may still work)');
      }
    }
  } catch (error) {
    console.warn('⚠️ PERMISSIONS: Could not check permissions:', error);
  }
  
  return { camera: cameraPermission, microphone: micPermission };
};

export const requestMediaPermissions = async (isMobile: boolean): Promise<boolean> => {
  console.log(`🔐 PERMISSIONS: Requesting explicit permissions (Mobile: ${isMobile})`);
  
  try {
    // Primeira tentativa: solicitar permissões básicas
    const permissionStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    
    console.log('✅ PERMISSIONS: Permissions granted successfully');
    
    // Fechar o stream temporário para liberar a câmera
    permissionStream.getTracks().forEach(track => track.stop());
    
    // Aguardar um momento para estabilizar no mobile
    if (isMobile) {
      console.log('📱 PERMISSIONS: Waiting for mobile stabilization...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return true;
  } catch (error) {
    console.error('❌ PERMISSIONS: Permission request failed:', error);
    return false;
  }
};

export const waitForMobilePermissions = async (isMobile: boolean): Promise<void> => {
  if (isMobile) {
    console.log(`📱 PERMISSIONS: Mobile detected, waiting for permission processing...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
};