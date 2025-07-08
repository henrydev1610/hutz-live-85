import { detectMobile, checkMediaDevicesSupport } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

  if (!checkMediaDevicesSupport()) {
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // Primeiro, verificar se temos dispositivos disponíveis
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    
    console.log(`📱 MEDIA: Found ${videoDevices.length} video devices and ${audioDevices.length} audio devices`);
    
    if (videoDevices.length === 0 && audioDevices.length === 0) {
      throw new Error('Nenhum dispositivo de mídia encontrado');
    }
  } catch (error) {
    console.warn('⚠️ MEDIA: Could not enumerate devices:', error);
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    try {
      console.log(`🎥 MEDIA: Trying constraint ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, constraints);

      // Aguardar um pouco entre tentativas para evitar problemas
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verificar se o stream é válido
      if (!stream || !stream.active) {
        console.warn(`⚠️ MEDIA: Stream is not active for constraint ${i + 1}`);
        continue;
      }
      
      console.log(`✅ MEDIA: Successfully obtained media (Mobile: ${isMobile}):`, {
        streamId: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });

      return stream;
    } catch (error) {
      handleMediaError(error, isMobile, i + 1, constraintsList.length);
    }
  }

  throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
};