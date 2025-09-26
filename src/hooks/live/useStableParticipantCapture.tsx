// FASE 3: Hook para captura estável no participante com recaptura inteligente

import { useCallback, useRef, useEffect } from 'react';

interface CaptureState {
  stream: MediaStream | null;
  track: MediaStreamTrack | null;
  isMuted: boolean;
  captureAttempts: number;
  lastCaptureTime: number;
}

interface StableParticipantCaptureOptions {
  onStreamReady?: (stream: MediaStream) => void;
  onTrackReplace?: (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) => void;
  onError?: (error: Error) => void;
}

export const useStableParticipantCapture = (options: StableParticipantCaptureOptions = {}) => {
  const captureState = useRef<CaptureState>({
    stream: null,
    track: null,
    isMuted: true,
    captureAttempts: 0,
    lastCaptureTime: 0
  });

  const primeVideoElement = useRef<HTMLVideoElement | null>(null);

  // FASE 3: Captura inicial com constraints otimizados
  const performInitialCapture = useCallback(async (): Promise<MediaStream | null> => {
    const now = Date.now();
    
    // Rate limiting - máximo 1 captura por 2 segundos
    if (now - captureState.current.lastCaptureTime < 2000) {
      console.log('🚫 CAPTURE: Rate limited, skipping capture');
      return captureState.current.stream;
    }

    try {
      captureState.current.captureAttempts++;
      captureState.current.lastCaptureTime = now;

      console.log(`📹 CAPTURE: Attempt #${captureState.current.captureAttempts} - requesting video-only stream`);

      // FASE 3: Vídeo-only com constraints otimizados
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 }
        },
        audio: false // Vídeo-only conforme especificação
      });

      const videoTrack = stream.getVideoTracks()[0];
      
      captureState.current.stream = stream;
      captureState.current.track = videoTrack;
      captureState.current.isMuted = videoTrack.muted;

      console.log(`✅ CAPTURE: Initial capture successful`, {
        trackId: videoTrack.id,
        settings: videoTrack.getSettings(),
        muted: videoTrack.muted,
        readyState: videoTrack.readyState
      });

        // FASE 3: Aguardar brevemente por unmute se necessário
        if (videoTrack.muted) {
          console.log('⏳ CAPTURE: Track is muted, waiting for unmute...');
          await waitForUnmute(videoTrack);
        }

        // Inicializar "prime" invisível para drenar frames
        initializePrimeVideo(stream);

      // Callback de sucesso
      if (options.onStreamReady) {
        options.onStreamReady(stream);
      }

      return stream;

    } catch (error: any) {
      console.error(`❌ CAPTURE: Failed attempt #${captureState.current.captureAttempts}:`, error);
      
      if (options.onError) {
        options.onError(error);
      }

        // FASE 3: Tentar recaptura com constraints mais leves
        if (captureState.current.captureAttempts === 1) {
          return performFallbackCapture();
        }

      return null;
    }
  }, [options]);

  // FASE 3: Aguardar unmute por até 2 segundos
  const waitForUnmute = useCallback(async (track: MediaStreamTrack): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const maxWait = 2000; // 2 segundos

      const checkUnmute = () => {
        if (!track.muted) {
          console.log('✅ CAPTURE: Track unmuted successfully');
          resolve();
        } else if (Date.now() - startTime > maxWait) {
          console.log('⏰ CAPTURE: Unmute timeout, proceeding with muted track');
          resolve();
        } else {
          setTimeout(checkUnmute, 100);
        }
      };

      checkUnmute();
    });
  }, []);

  // FASE 3: Recaptura com constraints mais leves
  const performFallbackCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      console.log('🔄 CAPTURE: Attempting fallback capture with lighter constraints');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 10 }
        },
        audio: false
      });

      const videoTrack = stream.getVideoTracks()[0];
      
      // Substituir track se temos um anterior
      if (captureState.current.track && options.onTrackReplace) {
        options.onTrackReplace(captureState.current.track, videoTrack);
      }

      captureState.current.stream = stream;
      captureState.current.track = videoTrack;
      captureState.current.isMuted = videoTrack.muted;

      console.log('✅ CAPTURE: Fallback capture successful');
      
      initializePrimeVideo(stream);
      
      if (options.onStreamReady) {
        options.onStreamReady(stream);
      }

      return stream;

    } catch (error: any) {
      console.error('❌ CAPTURE: Fallback capture also failed:', error);
      if (options.onError) {
        options.onError(error);
      }
      return null;
    }
  }, [options]);

  // FASE 3: Manter "prime" invisível para acelerar frames
  const initializePrimeVideo = useCallback((stream: MediaStream): void => {
    if (!primeVideoElement.current) {
      primeVideoElement.current = document.createElement('video');
      primeVideoElement.current.autoplay = true;
      primeVideoElement.current.playsInline = true;
      primeVideoElement.current.muted = true;
      primeVideoElement.current.style.position = 'absolute';
      primeVideoElement.current.style.top = '-9999px';
      primeVideoElement.current.style.left = '-9999px';
      primeVideoElement.current.style.width = '1px';
      primeVideoElement.current.style.height = '1px';
      primeVideoElement.current.style.opacity = '0';
      
      document.body.appendChild(primeVideoElement.current);
      console.log('📹 CAPTURE: Prime video element created (invisible)');
    }

    primeVideoElement.current.srcObject = stream;
    primeVideoElement.current.play().catch(() => {
      console.log('⚠️ CAPTURE: Prime video autoplay blocked (silent)');
    });
  }, []);

  // FASE 3: Recapturar e substituir track
  const recaptureAndReplace = useCallback(async (): Promise<MediaStreamTrack | null> => {
    console.log('🔄 CAPTURE: Performing recapture and replace');
    
    const newStream = await performInitialCapture();
    if (newStream) {
      const newTrack = newStream.getVideoTracks()[0];
      
      if (captureState.current.track && options.onTrackReplace) {
        console.log('🔄 CAPTURE: Replacing track via callback');
        options.onTrackReplace(captureState.current.track, newTrack);
      }
      
      return newTrack;
    }
    
    return null;
  }, [performInitialCapture, options, waitForUnmute, initializePrimeVideo]);

  // Limpeza
  const cleanup = useCallback(() => {
    console.log('🧹 CAPTURE: Cleaning up capture resources');
    
    if (captureState.current.stream) {
      captureState.current.stream.getTracks().forEach(track => {
        track.stop();
      });
    }

    if (primeVideoElement.current) {
      primeVideoElement.current.srcObject = null;
      if (primeVideoElement.current.parentNode) {
        primeVideoElement.current.parentNode.removeChild(primeVideoElement.current);
      }
      primeVideoElement.current = null;
    }

    captureState.current = {
      stream: null,
      track: null,
      isMuted: true,
      captureAttempts: 0,
      lastCaptureTime: 0
    };
  }, []);

  // Cleanup no unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    performInitialCapture,
    recaptureAndReplace,
    cleanup,
    getCurrentTrack: () => captureState.current.track,
    getCurrentStream: () => captureState.current.stream,
    getCaptureState: () => ({ ...captureState.current })
  };
};