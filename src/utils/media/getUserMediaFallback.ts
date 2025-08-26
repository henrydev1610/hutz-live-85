// src/utils/media/getUserMediaFallback.ts
import { detectMobileAggressively, getCameraPreference, validateMobileCameraCapabilities } from './deviceDetection';
import { streamLogger } from '../debug/StreamLogger';

// --- helpers -----------------------------------------------------------------

const isParticipantRoute = (): boolean => window.location.pathname.includes('/participant/');

const logPermissionRequest = (
  constraints: MediaStreamConstraints,
  attempt: number,
  participantId: string = 'unknown'
): void => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const videoConstraints = constraints.video;
  let permissionType = 'UNKNOWN';

  if (typeof videoConstraints === 'object' && videoConstraints !== null) {
    if ('facingMode' in videoConstraints) {
      const facingMode: any = (videoConstraints as MediaTrackConstraints).facingMode;
      if (typeof facingMode === 'object' && facingMode !== null) {
        if ('exact' in facingMode) permissionType = `MOBILE (exact: ${facingMode.exact})`;
        else if ('ideal' in facingMode) permissionType = `MOBILE (ideal: ${facingMode.ideal})`;
      } else if (typeof facingMode === 'string') {
        permissionType = `MOBILE (${facingMode})`;
      }
    } else {
      permissionType = 'DESKTOP (no facingMode)';
    }
  } else if (videoConstraints === true) {
    permissionType = 'BASIC (could be desktop or mobile)';
  }

  console.log(`🔐 FASE 4: PERMISSION REQUEST ${attempt} - Type: ${permissionType}`, constraints);

  streamLogger.logPermission(participantId, isMobile, deviceType, `request_${attempt}_${permissionType}`);
  streamLogger.logConstraints(participantId, isMobile, deviceType, constraints, attempt);

  if (isParticipantRoute() && permissionType.includes('DESKTOP')) {
    console.error('❌ FASE 4: CRITICAL - Desktop permission requested on participant route!');
    streamLogger.log(
      'STREAM_ERROR' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0, errorType: 'CRITICAL_DESKTOP_ON_PARTICIPANT' },
      undefined,
      'PERMISSION_ERROR',
      'Desktop permission requested on participant route'
    );
  }
};

// Aguarda o track produzir frames reais (evita vídeo 2x2)
async function waitForRealFrames(stream: MediaStream, timeoutMs = 8000): Promise<boolean> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;

  const hasFrame = () => (v.videoWidth ?? 0) > 2 && (v.videoHeight ?? 0) > 2;

  const playPromise = v.play().catch(() => {}); // ignora erro de autoplay
  void playPromise;

  return await new Promise<boolean>((resolve) => {
    const cleanup = () => {
      v.removeEventListener('resize', onResize);
      v.onloadedmetadata = null;
      try { v.pause(); } catch {}
      v.srcObject = null;
      v.remove();
    };

    const onResize = () => {
      if (hasFrame()) {
        clearTimeout(to);
        cleanup();
        resolve(true);
      }
    };

    const to = setTimeout(() => {
      const ok = hasFrame();
      cleanup();
      resolve(ok);
    }, timeoutMs);

    v.addEventListener('resize', onResize);
    v.onloadedmetadata = onResize;
  });
}

// Reaperta constraints no track se ele vier "miúdo"
async function tightenTrackConstraintsIfTiny(track?: MediaStreamTrack) {
  if (!track) return;
  try {
    // Ajuda alguns encoders a priorizarem fluidez
    (track as any).contentHint = 'motion';
  } catch {}

  const s = track.getSettings();
  if ((s.width ?? 0) <= 2 || (s.height ?? 0) <= 2) {
    await track.applyConstraints({
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 360, ideal: 720, max: 1080 },
      frameRate: { min: 15, ideal: 30, max: 30 }
    });
  }
}

// -----------------------------------------------------------------------------

export const getUserMediaWithFallback = async (participantId: string = 'unknown'): Promise<MediaStream | null> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';
  const isParticipant = isParticipantRoute();

  console.log(`🎬 FASE 1: DIAGNÓSTICO CRÍTICO - Starting media capture process`);
  console.log(`📱 FASE 1: Mobile: ${isMobile}, Participant: ${isParticipant}`);
  console.log(`🔐 FASE 1: Permission API available: ${!!navigator?.permissions}`);
  console.log(`📹 FASE 1: getUserMedia available: ${!!navigator?.mediaDevices?.getUserMedia}`);

  // Diagnóstico de permissões
  try {
    if (navigator.permissions) {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log(`🔐 FASE 1: PERMISSÕES ATUAIS - Camera: ${cameraPermission.state}, Micro: ${micPermission.state}`);

      if (cameraPermission.state === 'denied') {
        console.error(`❌ FASE 1: CRÍTICO - Câmera NEGADA pelo usuário`);
        streamLogger.log(
          'STREAM_ERROR' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0, errorType: 'CAMERA_PERMISSION_DENIED' },
          undefined,
          'PERMISSION_CRITICAL',
          'Camera permission denied by user'
        );
        return null;
      }
      if (cameraPermission.state === 'prompt') {
        console.log(`🔐 FASE 1: Câmera requer permissão - dialog será exibido`);
      }
    }
  } catch (permError) {
    console.warn(`⚠️ FASE 1: Não foi possível verificar permissões:`, permError);
  }

  // Escolha do pipeline
  const mediaPromise = (isParticipant || isMobile)
    ? getMobileStreamWithForceValidation(isParticipant, participantId)
    : getDesktopStreamWithMobileFallback(participantId);

  // Dê mais tempo pro primeiro grant em mobile
  const timeoutPromise = new Promise<MediaStream | null>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT: Permission dialog ignored or taking too long (20s)')), 20000);
  });

  try {
    const result = await Promise.race([mediaPromise, timeoutPromise]);

    if (result) {
      console.log(`✅ FASE 1: SUCESSO - Stream capturado:`, {
        streamId: result.id,
        active: result.active,
        tracks: result.getTracks().length
      });

      streamLogger.log(
        'STREAM_SUCCESS' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'MEDIA_CAPTURE',
        'Stream captured successfully'
      );
    }

    return result;
  } catch (error) {
    console.error(`❌ FASE 1: FALHA NA CAPTURA:`, error);
    if (error instanceof Error && error.message.includes('TIMEOUT')) {
      console.error(`⏰ FASE 1: TIMEOUT - Permission dialog pode ter sido ignorado`);
      streamLogger.log(
        'STREAM_ERROR' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0, errorType: 'PERMISSION_TIMEOUT' },
        undefined,
        'PERMISSION_CRITICAL',
        'Permission dialog timeout'
      );
    }
    return null;
  }
};

const getMobileStreamWithForceValidation = async (
  participantRouteStrict: boolean,
  participantId: string = 'unknown'
): Promise<MediaStream | null> => {
  const deviceType = 'mobile';
  const isMobile = true;

  console.log(
    `📱 FASE 3: MOBILE CAPTURE - ${participantRouteStrict ? 'PARTICIPANT ROUTE' : 'FORCED'} mobile camera acquisition`
  );

  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'MOBILE_CAPTURE',
    `Mobile capture ${participantRouteStrict ? 'PARTICIPANT ROUTE' : 'FORCED'}`,
    { isParticipantRoute: participantRouteStrict }
  );

  // Preferência de câmera: URL > memória do app > environment
  const urlParams = new URLSearchParams(window.location.search);
  const forcedCamera = urlParams.get('camera');
  const storedPref = getCameraPreference?.();
  const preferredFacing =
    forcedCamera === 'environment'
      ? 'environment'
      : forcedCamera === 'user'
      ? 'user'
      : storedPref === 'user' || storedPref === 'environment'
      ? (storedPref as 'user' | 'environment')
      : 'environment';

  console.log(`📱 FASE 3: Using camera preference: ${preferredFacing} (from URL/memory)`);

  // Constraints mais rígidas (com min + frameRate) nas 4 prioridades iniciais
  const mobileConstraints: MediaStreamConstraints[] = [
    // 1) EXACT preferred (alta)
    {
      video: {
        facingMode: { exact: preferredFacing },
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 360, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // 2) IDEAL preferred (média)
    {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 360, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // 3) EXACT oposta
    {
      video: {
        facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 360, ideal: 720, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // 4) IDEAL oposta
    {
      video: {
        facingMode: { ideal: preferredFacing === 'user' ? 'environment' : 'user' },
        width: { min: 480, ideal: 960, max: 1280 },
        height: { min: 270, ideal: 540, max: 720 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // 5) Qualquer vídeo com áudio (sem facingMode) — **apenas** se NÃO for rota participant estrita
    ...(participantRouteStrict
      ? []
      : [
          {
            video: {
              width: { min: 480, ideal: 960, max: 1280 },
              height: { min: 270, ideal: 540, max: 720 },
              frameRate: { min: 15, ideal: 30, max: 30 }
            },
            audio: true
          }
        ]),
    // 6) Vídeo simples com áudio
    ...(participantRouteStrict ? [] : [{ video: true, audio: true }]),
    // 7) Somente vídeo com facingMode
    { video: { facingMode: { ideal: preferredFacing } }, audio: false },
    // 8) Somente vídeo básico
    ...(participantRouteStrict ? [] : [{ video: true, audio: false }])
  ];

  // Validação de capacidades (informativo, não bloqueia)
  try {
    const ok = await validateMobileCameraCapabilities();
    streamLogger.logValidation(participantId, isMobile, deviceType, !!ok, {
      reason: ok ? 'camera_capabilities_validated' : 'camera_validation_inconclusive'
    });
  } catch {}

  for (let i = 0; i < mobileConstraints.length; i++) {
    const startTime = Date.now();
    try {
      logPermissionRequest(mobileConstraints[i], i + 1, participantId);
      console.log(
        `📱 FASE 3: Mobile attempt ${i + 1}/${mobileConstraints.length} with constraints:`,
        mobileConstraints[i]
      );

      const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints[i]);

      // Reapertar constraints no track se necessário
      await tightenTrackConstraintsIfTiny(stream.getVideoTracks()[0]);

      // Validar frames reais (evita 2x2)
      const hasFrames = await waitForRealFrames(stream, 8000);
      if (!hasFrames) {
        console.warn('⚠️ Frame validation failed (2x2 likely) – trying next constraint');
        stream.getTracks().forEach((t) => t.stop());
        continue;
      }

      const duration = Date.now() - startTime;
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();

      console.log('✅ FASE 3: Mobile stream acquired successfully:', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        cameraSettings: settings
      });

      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);

      // Confirmação de câmera "mobile"
      if (settings?.facingMode) {
        console.log(`🎉 FASE 3: CONFIRMED mobile camera with facingMode: ${settings.facingMode}`);
        streamLogger.logValidation(participantId, isMobile, deviceType, true, {
          reason: 'mobile_camera_confirmed',
          facingMode: settings.facingMode,
          attempt: i + 1
        });
        sessionStorage.setItem('mobileValidated', 'true');
        sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
        return stream;
      } else {
        console.warn('⚠️ FASE 3: Got camera but no facingMode - might be desktop camera accessed via mobile browser');
        streamLogger.logValidation(participantId, isMobile, deviceType, false, {
          reason: 'no_facing_mode_detected',
          attempt: i + 1,
          settings
        });

        if (participantRouteStrict && i < 4) {
          console.log('📱 PARTICIPANT ROUTE - Rejecting non-facingMode camera, trying next constraint');
          stream.getTracks().forEach((track) => {
            streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_rejected', track);
            track.stop();
          });
          continue;
        }

        // Aceita como fallback fora da rota estrita ou após as 4 primeiras tentativas
        if (i >= 4 || !participantRouteStrict) {
          console.log('📱 Accepting camera as mobile fallback');
          streamLogger.logValidation(participantId, isMobile, deviceType, true, {
            reason: 'mobile_fallback_accepted',
            attempt: i + 1
          });
          return stream;
        }

        // Clean & continue
        stream.getTracks().forEach((track) => {
          streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped', track);
          track.stop();
        });
      }
    } catch (error: any) {
      console.error(`❌ FASE 3: Mobile attempt ${i + 1} failed:`, error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);

      if (error?.name === 'NotAllowedError') {
        console.error('❌ FASE 3: Permission denied - cannot continue');
        streamLogger.logPermission(participantId, isMobile, deviceType, 'permission_denied');

        if (participantRouteStrict) {
          console.error('❌ FASE 4: CRITICAL - Mobile camera permission denied on participant route!');
          streamLogger.log(
            'STREAM_ERROR' as any,
            participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: 0, errorType: 'PERMISSION_DENIED_PARTICIPANT' },
            undefined,
            'PERMISSION_CRITICAL',
            'Mobile camera permission denied on participant route'
          );
        }
        break;
      }
    }
  }

  console.error('❌ FASE 3: All mobile attempts failed');
  streamLogger.log(
    'STREAM_ERROR' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0, errorType: 'ALL_MOBILE_ATTEMPTS_FAILED' },
    undefined,
    'MOBILE_CAPTURE',
    'All mobile capture attempts failed'
  );

  return null;
};

const getDesktopStreamWithMobileFallback = async (
  participantId: string = 'unknown'
): Promise<MediaStream | null> => {
  const deviceType = 'desktop';
  const isMobile = false;

  console.log('🖥️ FASE 3: DESKTOP CAPTURE with mobile fallback capability');

  streamLogger.log(
    'STREAM_START' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'DESKTOP_CAPTURE',
    'Desktop capture with mobile fallback'
  );

  const desktopConstraints: MediaStreamConstraints[] = [
    // High quality desktop
    {
      video: {
        width: { min: 960, ideal: 1920, max: 1920 },
        height: { min: 540, ideal: 1080, max: 1080 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // Medium quality
    {
      video: {
        width: { min: 640, ideal: 1280, max: 1280 },
        height: { min: 360, ideal: 720, max: 720 },
        frameRate: { min: 15, ideal: 30, max: 30 }
      },
      audio: true
    },
    // Basic quality
    {
      video: {
        width: { min: 640, ideal: 640, max: 640 },
        height: { min: 480, ideal: 480, max: 480 },
        frameRate: { min: 10, ideal: 24, max: 30 }
      },
      audio: true
    },
    // Video only fallback
    { video: true, audio: false }
  ];

  for (let i = 0; i < desktopConstraints.length; i++) {
    const startTime = Date.now();
    try {
      logPermissionRequest(desktopConstraints[i], i + 1, participantId);

      console.log(`🖥️ FASE 3: Desktop constraint set ${i + 1}`);
      const stream = await navigator.mediaDevices.getUserMedia(desktopConstraints[i]);

      // Reapertar e validar frames
      await tightenTrackConstraintsIfTiny(stream.getVideoTracks()[0]);
      const ok = await waitForRealFrames(stream, 6000);
      if (!ok) {
        console.warn('⚠️ Desktop frame validation failed – trying next constraint');
        stream.getTracks().forEach((t) => t.stop());
        continue;
      }

      const duration = Date.now() - startTime;
      console.log(`✅ FASE 3: Desktop success with constraint set ${i + 1}`);
      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, duration);
      return stream;
    } catch (error) {
      console.log(`⚠️ FASE 3: Desktop constraint set ${i + 1} failed:`, error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, i + 1);
    }
  }

  console.error('❌ FASE 3: All desktop constraint sets failed');
  streamLogger.log(
    'STREAM_ERROR' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0, errorType: 'ALL_DESKTOP_ATTEMPTS_FAILED' },
    undefined,
    'DESKTOP_CAPTURE',
    'All desktop capture attempts failed'
  );

  return null;
};

// -----------------------------------------------------------------------------

export const getCameraInfo = async (participantId: string = 'unknown'): Promise<void> => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');

    console.log(
      '📹 CAMERA INFO: Available cameras with mobile detection:',
      videoDevices.map((device) => ({
        deviceId: device.deviceId?.substring(0, 20),
        label: device.label || 'Unknown Camera',
        groupId: device.groupId?.substring(0, 20),
        isMobileCapable:
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('front') ||
          device.label.toLowerCase().includes('user')
      }))
    );

    streamLogger.logDeviceEnumeration(participantId, isMobile, deviceType, videoDevices);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('debug') || urlParams.has('forceMobile')) {
      await testMobileCameraCapabilities(participantId);
    }
  } catch (error) {
    console.error('❌ CAMERA INFO: Failed to enumerate devices:', error);
    streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
  }
};

const testMobileCameraCapabilities = async (participantId: string = 'unknown') => {
  const isMobile = detectMobileAggressively();
  const deviceType = isMobile ? 'mobile' : 'desktop';

  console.log('🧪 FASE 4: TESTING mobile camera capabilities...');

  streamLogger.log(
    'VALIDATION' as any,
    participantId,
    isMobile,
    deviceType,
    { timestamp: Date.now(), duration: 0 },
    undefined,
    'CAPABILITY_TEST',
    'Testing mobile camera capabilities'
  );

  const facingModes: Array<'environment' | 'user'> = ['environment', 'user'];
  for (const facingMode of facingModes) {
    try {
      const testConstraints: MediaStreamConstraints = { video: { facingMode: { ideal: facingMode } } };
      logPermissionRequest(testConstraints, 0, participantId);

      const testStream = await navigator.mediaDevices.getUserMedia(testConstraints);
      const settings = testStream.getVideoTracks()[0]?.getSettings();

      console.log(`✅ FASE 4: ${facingMode} camera available:`, settings);
      streamLogger.logValidation(participantId, isMobile, deviceType, true, {
        reason: `${facingMode}_camera_available`,
        settings
      });

      testStream.getTracks().forEach((track) => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'test_track_stopped', track);
        track.stop();
      });
    } catch (error: any) {
      console.log(`❌ FASE 4: ${facingMode} camera not available:`, error?.name);
      streamLogger.logValidation(participantId, isMobile, deviceType, false, {
        reason: `${facingMode}_camera_not_available`,
        error: error?.name
      });
    }
  }
};
