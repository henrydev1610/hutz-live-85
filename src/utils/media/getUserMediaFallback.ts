import { detectMobile, checkMediaDevicesSupport } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

  if (!checkMediaDevicesSupport()) {
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // Verificar permissões primeiro se possível
  try {
    if (navigator.permissions) {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log(`🎥 MEDIA: Permissions - Camera: ${cameraPermission.state}, Microphone: ${micPermission.state}`);
    }
  } catch (error) {
    console.warn('⚠️ MEDIA: Could not check permissions:', error);
  }

  // Listar dispositivos disponíveis se possível
  try {
    if (navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      console.log(`📹 MEDIA: Available devices - Video: ${videoDevices.length}, Audio: ${audioDevices.length}`);
    }
  } catch (error) {
    console.warn('⚠️ MEDIA: Could not enumerate devices:', error);
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();
  let lastError: any = null;

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    try {
      console.log(`🎥 MEDIA: Trying constraint ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, constraints);

      // Aguardar mais tempo no mobile e após erros
      if (isMobile && i > 0) {
        const delay = Math.min(500 + (i * 200), 2000);
        console.log(`⏳ MEDIA: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Timeout para getUserMedia
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('getUserMedia timeout')), 10000)
        )
      ]);
      
      // Verificar se o stream é válido
      if (!stream || stream.getTracks().length === 0) {
        throw new Error('Stream inválido ou sem tracks');
      }

      // Verificar se pelo menos um track está ativo
      const activeTracks = stream.getTracks().filter(t => t.readyState === 'live');
      if (activeTracks.length === 0) {
        console.warn('⚠️ MEDIA: Stream obtained but no active tracks, continuing anyway...');
      }

      console.log(`✅ MEDIA: Successfully obtained media (Mobile: ${isMobile}):`, {
        streamId: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted,
          constraints: t.getConstraints()
        }))
      });

      // Configurar listeners para monitorar mudanças nos tracks
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.warn(`⚠️ MEDIA: Track ${track.kind} ended`);
        });
        track.addEventListener('mute', () => {
          console.warn(`⚠️ MEDIA: Track ${track.kind} muted`);
        });
        track.addEventListener('unmute', () => {
          console.log(`🔊 MEDIA: Track ${track.kind} unmuted`);
        });
      });

      return stream;
    } catch (error) {
      lastError = error;
      handleMediaError(error, isMobile, i + 1, constraintsList.length);
      
      // Se for erro de permissão, não tentar mais vídeo
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.warn('⚠️ MEDIA: Permission denied, skipping video constraints');
        // Pular para constraints apenas de áudio
        const audioOnlyIndex = constraintsList.findIndex(c => c.video === false);
        if (audioOnlyIndex > i) {
          i = audioOnlyIndex - 1; // -1 porque o loop vai incrementar
        }
      }
    }
  }

  console.warn(`⚠️ MEDIA: All constraints failed, last error:`, lastError);
  console.warn(`⚠️ MEDIA: Returning null for degraded mode`);
  return null; // Permite modo degradado
};