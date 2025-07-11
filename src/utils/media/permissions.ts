// Media permissions handling
export interface PermissionStatus {
  camera: PermissionState | 'unknown';
  microphone: PermissionState | 'unknown';
}

export const checkMediaPermissions = async (): Promise<PermissionStatus> => {
  let cameraPermission: PermissionState | 'unknown' = 'unknown';
  let micPermission: PermissionState | 'unknown' = 'unknown';
  
  try {
    if (navigator.permissions) {
      const cameraQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      cameraPermission = cameraQuery.state;
      micPermission = micQuery.state;
      
      console.log(`🎥 PERMISSIONS: Camera: ${cameraPermission}, Microphone: ${micPermission}`);
      
      if (cameraPermission === 'denied' && micPermission === 'denied') {
        console.error('❌ PERMISSIONS: Both camera and microphone permissions denied');
        throw new Error('Permissões de câmera e microfone negadas');
      }
    }
  } catch (error) {
    console.warn('⚠️ PERMISSIONS: Could not check permissions:', error);
  }
  
  return { camera: cameraPermission, microphone: micPermission };
};

export const waitForMobilePermissions = async (isMobile: boolean): Promise<void> => {
  if (isMobile) {
    console.log(`📱 PERMISSIONS: Mobile detected, waiting for permission processing...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
};