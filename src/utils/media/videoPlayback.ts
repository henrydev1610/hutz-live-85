import { detectMobileAggressively } from './deviceDetection';

const waitForRealFrames = async (
  video: HTMLVideoElement,
  timeoutMs = 3000
): Promise<boolean> => {
  const hasRealDims = () => video.videoWidth > 2 && video.videoHeight > 2;

  if (hasRealDims()) return true;

  const useRVFC = 'requestVideoFrameCallback' in video;
  let done = false;
  let ok = false;

  await new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      done = true;
      resolve();
    }, timeoutMs);

    const step = () => {
      if (done) return;
      if (hasRealDims()) {
        ok = true;
        done = true;
        clearTimeout(t);
        resolve();
        return;
      }
      if (useRVFC) {
        // @ts-ignore - Safari/Chrome support RVFC
        (video as any).requestVideoFrameCallback(() => step());
      } else {
        requestAnimationFrame(step);
      }
    };

    step();
  });

  return ok;
};

export const setupVideoElement = async (
  videoElement: HTMLVideoElement,
  stream: MediaStream
): Promise<void> => {
  const isMobile = detectMobileAggressively();

  console.log('📺 SETUP VIDEO: start', {
    isMobile,
    streamId: stream.id,
    streamActive: stream.active,
    vTracks: stream.getVideoTracks().length,
    aTracks: stream.getAudioTracks().length,
  });

  // 1) Ajustes críticos p/ autoplay em mobile/iOS
  videoElement.playsInline = true;
  videoElement.setAttribute('playsinline', '');
  videoElement.muted = true;
  videoElement.setAttribute('muted', '');
  videoElement.autoplay = true;
  videoElement.setAttribute('autoplay', '');

  // 2) Evitar reflows desnecessários: só limpa se for stream diferente
  if (videoElement.srcObject && videoElement.srcObject !== stream) {
    console.log('📺 SETUP VIDEO: clearing previous srcObject');
    videoElement.srcObject = null;
  }

  // 3) Dica para o encoder priorizar movimento
  const vTrack = stream.getVideoTracks()[0];
  if (vTrack) {
    try {
      // @ts-ignore
      if (typeof (vTrack as any).contentHint === 'string') {
        // @ts-ignore
        (vTrack as any).contentHint = 'motion';
        console.log('🎯 SETUP VIDEO: contentHint=motion applied');
      }
    } catch {}
  }

  // 4) Atribui o stream
  videoElement.srcObject = stream;

  // 5) Tenta tocar
  try {
    console.log('📺 SETUP VIDEO: trying play()');
    await videoElement.play();
  } catch (err) {
    console.warn('⚠️ SETUP VIDEO: play() failed, retrying…', err);
    // Em mobile, uma segunda tentativa costuma resolver
    await new Promise((r) => setTimeout(r, 400));
    try {
      await videoElement.play();
      console.log('✅ SETUP VIDEO: play() retry ok');
    } catch (err2) {
      console.error('❌ SETUP VIDEO: play() retry failed', err2);
    }
  }

  // 6) Espera por frames reais (>2×2). Isso evita o bug do 2×2.
  let hasFrames = await waitForRealFrames(videoElement, 2500);
  if (!hasFrames && vTrack) {
    // 6.1) Se ainda “miúdo”, tenta “reapertar” constraints do track
    try {
      const s = vTrack.getSettings();
      const tiny = (s.width ?? 0) <= 2 || (s.height ?? 0) <= 2;

      if (tiny) {
        console.warn('🧩 SETUP VIDEO: detected tiny track (2×2/0×0) — applying constraints bump');
        await vTrack.applyConstraints({
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
          frameRate: { min: 15, ideal: 30, max: 30 },
        });
      } else {
        // Mesmo com dims “ok”, alguns browsers só liberam após reaplicar
        await vTrack.applyConstraints({
          width: { ideal: Math.min(1280, (s.width as number) || 1280), max: 1920 },
          height: { ideal: Math.min(720, (s.height as number) || 720), max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        });
      }

      // Re-tenta play (alguns engines pedem isso depois do applyConstraints)
      try {
        await videoElement.play();
      } catch {}

      hasFrames = await waitForRealFrames(videoElement, 2000);
    } catch (e) {
      console.warn('⚠️ SETUP VIDEO: applyConstraints failed/unsupported', e);
    }
  }

  // 7) Logs finais
  if (hasFrames) {
    console.log(
      `✅ SETUP VIDEO: ready ${videoElement.videoWidth}×${videoElement.videoHeight}`
    );
  } else {
    console.warn(
      '⚠️ SETUP VIDEO: no real frames detected (still 0×0 or 2×2) — upstream capture likely constrained'
    );
  }

  // 8) Eventos úteis de depuração
  videoElement.addEventListener('loadedmetadata', () => {
    console.log('📺 EVENT: loadedmetadata', {
      w: videoElement.videoWidth,
      h: videoElement.videoHeight,
      dur: videoElement.duration,
    });
  });

  videoElement.addEventListener('resize', () => {
    console.log('📐 EVENT: resize', {
      w: videoElement.videoWidth,
      h: videoElement.videoHeight,
    });
  });

  videoElement.addEventListener('canplay', () => console.log('▶️ EVENT: canplay'));
  videoElement.addEventListener('playing', () => console.log('🎞️ EVENT: playing'));
  videoElement.addEventListener('stalled', () => console.warn('🚫 EVENT: stalled'));
  videoElement.addEventListener('waiting', () => console.warn('⏳ EVENT: waiting'));
  videoElement.addEventListener('error', (e) => console.error('❌ EVENT: error', e));
};
