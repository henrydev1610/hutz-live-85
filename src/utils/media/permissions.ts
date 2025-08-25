
import { detectMobileAggressively } from './deviceDetection';

// FASE 4: Enhanced media permissions handling with mobile-specific validation
export interface PermissionStatus {
  camera: PermissionState | 'unknown';
  microphone: PermissionState | 'unknown';
}

// FASE 4: Check if we're on participant route
const isParticipantRoute = (): boolean => {
  return window.location.pathname.includes('/participant/');
};

// FASE 4: Validate that the permission request will be for mobile camera
const validateMobilePermissionRequest = async (): Promise<boolean> => {
  const isParticipant = isParticipantRoute();
  const isMobile = detectMobileAggressively();
  
  console.log('🔐 FASE 4: VALIDATING mobile permission request...', {
    isParticipant,
    isMobile,
    shouldForceMobile: isParticipant || isMobile
  });
  
  if (!isParticipant && !isMobile) {
    console.log('✅ FASE 4: Desktop context - no mobile validation needed');
    return true;
  }
  
  try {
    // Test if mobile constraints are supported
    const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
    if (!supportedConstraints.facingMode) {
      console.error('❌ FASE 4: CRITICAL - facingMode not supported, cannot ensure mobile camera');
      return false;
    }
    
    console.log('✅ FASE 4: facingMode supported - mobile camera requests possible');
    return true;
  } catch (error) {
    console.error('❌ FASE 4: Failed to validate mobile permission support:', error);
    return false;
  }
};

export const checkMediaPermissions = async (): Promise<PermissionStatus> => {
  let cameraPermission: PermissionState | 'unknown' = 'unknown';
  let micPermission: PermissionState | 'unknown' = 'unknown';
  
  console.log('🔐 FASE 4: CHECKING media permissions with mobile validation...');
  
  // FASE 4: Validate mobile permission support first
  const canRequestMobile = await validateMobilePermissionRequest();
  if (!canRequestMobile && (isParticipantRoute() || detectMobileAggressively())) {
    console.error('❌ FASE 4: CRITICAL - Cannot guarantee mobile camera permission on mobile/participant context');
  }
  
  try {
    if (navigator.permissions) {
      const cameraQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      cameraPermission = cameraQuery.state;
      micPermission = micQuery.state;
      
      console.log(`🎥 FASE 4: PERMISSIONS - Camera: ${cameraPermission}, Microphone: ${micPermission}`);
      
      if (cameraPermission === 'denied') {
        console.error('❌ FASE 4: Camera permission DENIED - this will cause "NOT FOUND"');
        
        // FASE 4: Special warning for participant route
        if (isParticipantRoute()) {
          console.error('❌ FASE 4: CRITICAL - Camera denied on PARTICIPANT ROUTE - mobile camera will not work');
        }
        
        throw new Error('Permissão de câmera negada - acesse as configurações do navegador');
      }
      
      if (micPermission === 'denied') {
        console.warn('⚠️ FASE 4: Microphone permission denied (camera may still work)');
      }
    }
  } catch (error) {
    console.warn('⚠️ FASE 4: Could not check permissions:', error);
  }
  
  return { camera: cameraPermission, microphone: micPermission };
};

export const requestMediaPermissions = async (isMobile: boolean): Promise<boolean> => {
  console.log(`🔐 FASE 4: REQUESTING explicit permissions - Mobile: ${isMobile}, Participant: ${isParticipantRoute()}`);
  
  try {
    // FASE 4: For participant route or mobile, use mobile-specific constraints
    const shouldUseMobileConstraints = isParticipantRoute() || isMobile;
    
    let permissionConstraints: MediaStreamConstraints;
    
    if (shouldUseMobileConstraints) {
      // FASE 4: Use mobile-specific constraints to ensure mobile camera permission
      const urlParams = new URLSearchParams(window.location.search);
      const cameraParam = urlParams.get('camera');
      const preferredFacing = cameraParam === 'user' ? 'user' : 'environment';
      
      permissionConstraints = {
        video: { facingMode: { ideal: preferredFacing } },
        audio: true
      };
      
      console.log(`📱 FASE 4: Using MOBILE permission constraints with facingMode: ${preferredFacing}`);
    } else {
      // FASE 4: Use basic constraints for desktop
      permissionConstraints = { 
        video: true, 
        audio: true 
      };
      
      console.log('🖥️ FASE 4: Using DESKTOP permission constraints');
    }
    
    // FASE 4: Log the exact permission request being made
    console.log('🔐 FASE 4: PERMISSION REQUEST DETAILS:', permissionConstraints);
    
    const permissionStream = await navigator.mediaDevices.getUserMedia(permissionConstraints);
    
    console.log('✅ FASE 4: Permissions granted successfully');
    
    // FASE 4: Validate we got the expected camera type
    if (shouldUseMobileConstraints) {
      const videoTrack = permissionStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      
      if (settings?.facingMode) {
        console.log(`✅ FASE 4: CONFIRMED mobile camera permission with facingMode: ${settings.facingMode}`);
      } else {
        console.warn('⚠️ FASE 4: Permission granted but no facingMode - might be desktop camera on mobile browser');
      }
    }
    
    // Fechar o stream temporário para liberar a câmera
    permissionStream.getTracks().forEach(track => track.stop());
    
    // Aguardar um momento para estabilizar no mobile
    if (isMobile || isParticipantRoute()) {
      console.log('📱 FASE 4: Waiting for mobile permission stabilization...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return true;
  } catch (error) {
    console.error('❌ FASE 4: Permission request failed:', error);
    
    // FASE 4: Special error handling for participant route
    if (isParticipantRoute()) {
      console.error('❌ FASE 4: CRITICAL - Permission request failed on PARTICIPANT ROUTE');
      
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error('❌ FASE 4: CRITICAL - User denied mobile camera permission on participant route');
      }
    }
    
    return false;
  }
};

export const waitForMobilePermissions = async (isMobile: boolean): Promise<void> => {
  if (isMobile || isParticipantRoute()) {
    console.log(`📱 FASE 4: Mobile/Participant detected, waiting for permission processing...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
};
