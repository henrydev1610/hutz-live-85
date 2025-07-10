import { detectMobile, checkMediaDevicesSupport } from './deviceDetection';
import { getMobileConstraints, getDesktopConstraints } from './mediaConstraints';
import { handleMediaError } from './mediaErrorHandling';

export const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
  const isMobile = detectMobile();
  console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);
  console.log(`📱 MEDIA: User agent: ${navigator.userAgent}`);
  console.log(`📱 MEDIA: Platform: ${navigator.platform}`);

  if (!checkMediaDevicesSupport()) {
    console.error('❌ MEDIA: getUserMedia não é suportado neste navegador');
    throw new Error('getUserMedia não é suportado neste navegador');
  }

  // Aguardar tempo inicial no mobile para permissões serem processadas
  if (isMobile) {
    console.log(`📱 MEDIA: Mobile detected, waiting for permission processing...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Verificar permissões primeiro se possível
  let cameraPermission = 'unknown';
  let micPermission = 'unknown';
  try {
    if (navigator.permissions) {
      const cameraQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      cameraPermission = cameraQuery.state;
      micPermission = micQuery.state;
      console.log(`🎥 MEDIA: Permissions - Camera: ${cameraPermission}, Microphone: ${micPermission}`);
      
      if (cameraPermission === 'denied' && micPermission === 'denied') {
        console.error('❌ MEDIA: Both camera and microphone permissions denied');
        throw new Error('Permissões de câmera e microfone negadas');
      }
    }
  } catch (error) {
    console.warn('⚠️ MEDIA: Could not check permissions:', error);
  }

  // Listar dispositivos disponíveis com mais detalhes
  let deviceInfo = { video: 0, audio: 0, devices: [] as any[] };
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      deviceInfo.devices = devices;
      deviceInfo.video = devices.filter(d => d.kind === 'videoinput').length;
      deviceInfo.audio = devices.filter(d => d.kind === 'audioinput').length;
      console.log(`📹 MEDIA: Available devices - Video: ${deviceInfo.video}, Audio: ${deviceInfo.audio}`);
      console.log(`📹 MEDIA: Device details:`, devices.map(d => ({ 
        kind: d.kind, 
        label: d.label || 'unlabeled',
        deviceId: d.deviceId ? 'present' : 'missing' 
      })));
      
      if (deviceInfo.video === 0 && deviceInfo.audio === 0) {
        console.warn('⚠️ MEDIA: No devices found, but continuing...');
      }
    }
  } catch (error) {
    console.warn('⚠️ MEDIA: Could not enumerate devices:', error);
  }

  const constraintsList = isMobile ? getMobileConstraints() : getDesktopConstraints();
  let lastError: any = null;
  
  console.log(`🎯 MEDIA: Starting ${constraintsList.length} constraint attempts`);

  for (let i = 0; i < constraintsList.length; i++) {
    const constraints = constraintsList[i];
    
    try {
      console.log(`🎥 MEDIA: === ATTEMPT ${i + 1}/${constraintsList.length} ===`);
      console.log(`🎥 MEDIA: Constraints:`, JSON.stringify(constraints, null, 2));

      // Delay progressivo entre tentativas
      if (i > 0) {
        const delay = isMobile ? Math.min(800 + (i * 400), 3000) : Math.min(300 + (i * 200), 1500);
        console.log(`⏳ MEDIA: Waiting ${delay}ms before attempt ${i + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Timeout mais generoso para mobile e tentativas posteriores
      const timeoutMs = isMobile ? (i < 3 ? 15000 : 20000) : 12000;
      console.log(`⏰ MEDIA: Using ${timeoutMs}ms timeout for attempt ${i + 1}`);

      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`getUserMedia timeout (${timeoutMs}ms)`)), timeoutMs)
        )
      ]);
      
      // Validação intensiva do stream
      if (!stream) {
        throw new Error('Stream é null/undefined');
      }
      
      if (!stream.getTracks || typeof stream.getTracks !== 'function') {
        throw new Error('Stream não possui método getTracks');
      }
      
      const tracks = stream.getTracks();
      if (tracks.length === 0) {
        throw new Error('Stream sem tracks');
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      const activeTracks = tracks.filter(t => t.readyState === 'live');
      
      console.log(`✅ MEDIA: SUCCESS! Stream obtained:`, {
        streamId: stream.id,
        active: stream.active,
        totalTracks: tracks.length,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        activeTracks: activeTracks.length,
        attempt: i + 1,
        isMobile
      });

      // Log detalhado dos tracks
      tracks.forEach((track, idx) => {
        console.log(`📹 MEDIA: Track ${idx + 1}: ${track.kind} - ${track.label || 'unlabeled'} - ${track.readyState} - enabled: ${track.enabled}`);
      });

      // Configurar listeners de monitoramento
      tracks.forEach(track => {
        track.addEventListener('ended', () => {
          console.warn(`⚠️ MEDIA: Track ${track.kind} ended unexpectedly`);
        });
        track.addEventListener('mute', () => {
          console.warn(`🔇 MEDIA: Track ${track.kind} muted`);
        });
        track.addEventListener('unmute', () => {
          console.log(`🔊 MEDIA: Track ${track.kind} unmuted`);
        });
      });

      // Aguardar um pouco para garantir que o stream está estável
      if (isMobile) {
        console.log(`📱 MEDIA: Waiting for stream stabilization...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se ainda está ativo após aguardar
        if (!stream.active) {
          console.warn('⚠️ MEDIA: Stream became inactive, but continuing...');
        }
      }

      return stream;
      
    } catch (error) {
      lastError = error;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ MEDIA: Attempt ${i + 1} failed:`, {
        name: errorName,
        message: errorMessage,
        constraint: constraints,
        isMobile,
        deviceInfo
      });
      
      handleMediaError(error, isMobile, i + 1, constraintsList.length);
      
      // Lógica específica para diferentes tipos de erro
      if (errorName === 'NotAllowedError') {
        console.warn('⚠️ MEDIA: Permission denied - trying audio-only fallbacks');
        // Continuar, mas pular para tentativas só de áudio
        const audioOnlyIndex = constraintsList.findIndex(c => c.video === false);
        if (audioOnlyIndex > i) {
          console.log(`⏭️ MEDIA: Skipping to audio-only constraint at index ${audioOnlyIndex}`);
          i = audioOnlyIndex - 1; // -1 porque o loop vai incrementar
        }
      } else if (errorName === 'NotFoundError') {
        console.warn('⚠️ MEDIA: Device not found - trying more basic constraints');
        // Continuar com próximas tentativas mais básicas
      } else if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
        console.warn('⚠️ MEDIA: Constraints too restrictive - trying simpler ones');
        // Continuar com constraints mais simples
      } else if (errorMessage.includes('timeout')) {
        console.warn('⚠️ MEDIA: Timeout - device may be slow, trying next constraint');
        // Continuar com próxima tentativa
      }
    }
  }

  // Log detalhado do fracasso final
  console.error(`❌ MEDIA: ALL ${constraintsList.length} ATTEMPTS FAILED`);
  console.error(`❌ MEDIA: Final error:`, {
    name: lastError?.name,
    message: lastError?.message,
    isMobile,
    deviceInfo,
    permissions: { camera: cameraPermission, microphone: micPermission }
  });
  
  // Tentar um último fallback ultra-básico se ainda não tentamos
  console.log(`🏥 MEDIA: Attempting EMERGENCY fallback...`);
  try {
    const emergencyStream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Emergency fallback timeout')), 10000)
      )
    ]);
    
    if (emergencyStream && emergencyStream.getTracks().length > 0) {
      console.log(`🚑 MEDIA: EMERGENCY fallback succeeded!`);
      return emergencyStream;
    }
  } catch (emergencyError) {
    console.error(`🚨 MEDIA: Emergency fallback also failed:`, emergencyError);
  }

  console.warn(`⚠️ MEDIA: Returning null - entering degraded mode`);
  return null;
};