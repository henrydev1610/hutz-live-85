import { detectMobile, checkMediaDevicesSupport } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

  if (!checkMediaDevicesSupport()) {
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    try {
      console.log(`🎥 MEDIA: Trying constraint ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, constraints);

      // Aguardar um pouco no mobile para evitar problemas de timing
      if (isMobile && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log(`✅ MEDIA: Successfully obtained media (Mobile: ${isMobile}):`, {
        streamId: stream.id,
        tracks: stream.getTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState,
          constraints: t.getConstraints()
        }))
      });

      return stream;
    } catch (error) {
      handleMediaError(error, isMobile, i + 1, constraintsList.length);
    }
  }

  console.warn(`⚠️ MEDIA: All constraints failed, returning null for degraded mode`);
  return null; // Permite modo degradado
};