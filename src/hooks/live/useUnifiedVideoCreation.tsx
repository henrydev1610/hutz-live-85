
import { useCallback, useRef } from 'react';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';

interface VideoCreationState {
  [containerId: string]: {
    videoElement: HTMLVideoElement | null;
    isPlaying: boolean;
    lastUpdate: number;
  };
}

export const useUnifiedVideoCreation = () => {
  const videoStatesRef = useRef<VideoCreationState>({});

  const createVideoElementUnified = useCallback(async (
    container: HTMLElement, 
    stream: MediaStream | any,
    participantId: string
  ): Promise<HTMLVideoElement | null> => {
    if (!container || !stream) {
      console.error('🚫 UNIFIED VIDEO: Missing container or stream');
      return null;
    }

    const containerId = container.id || `container-${participantId}`;
    const isMobile = detectMobileAggressively();
    
    // 🚨 FASE 4: DETECTAR TWILIO VIDEO TRACK
    const isTwilioTrack = stream && typeof stream.attach === 'function';
    const streamInfo = isTwilioTrack ? 
      { kind: stream.kind, enabled: stream.enabled, sid: stream.sid } :
      { streamId: stream.id, tracks: stream.getTracks().length };

    console.log(`🎬 UNIFIED VIDEO: Creating video for ${participantId}`, {
      containerId,
      isMobile,
      isTwilioTrack,
      ...streamInfo
    });

    // Clear any existing video in container
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      existingVideo.remove();
      console.log(`🧹 UNIFIED VIDEO: Removed existing video from ${containerId}`);
    }

    // Create new video element with unified configuration
    const videoElement = document.createElement('video');
    
    // Universal video configuration that works for both mobile and desktop
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.preload = 'auto';
    
    // Mobile-specific attributes
    if (isMobile) {
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('playsinline', 'true');
    }
    
    // Unified styling
    videoElement.className = 'w-full h-full object-cover absolute inset-0 z-10';
    videoElement.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
      background-color: transparent !important;
    `;

    // Add to DOM first
    container.appendChild(videoElement);
    
    // Set stream with instrumentation
    const elId = videoElement.id || `video-${participantId}`;
    videoElement.id = elId;
    
    console.log(`HOST-UI-ATTACH-START {id=${participantId}, elId=${elId}, isTwilio=${isTwilioTrack}}`);
    
    // 🚨 FASE 4: USAR TWILIO .attach() OU srcObject BASEADO NO TIPO
    if (isTwilioTrack) {
      console.log(`🔥 TWILIO ATTACH: Usando track.attach() para ${participantId}`);
      stream.attach(videoElement);
      console.log(`HOST-UI-TWILIO-ATTACH-DONE {id=${participantId}, elId=${elId}, kind=${stream.kind}}`);
    } else {
      console.log(`📺 STANDARD ATTACH: Usando srcObject para ${participantId}`);
      videoElement.srcObject = stream;
      console.log(`HOST-UI-ATTACH-DONE {id=${participantId}, elId=${elId}, readyState=${videoElement.readyState}}`);
    }

    // Unified event handling
    return new Promise((resolve) => {
      const handleSuccess = () => {
        console.log(`✅ UNIFIED VIDEO: Successfully playing ${participantId} (${isMobile ? 'mobile' : 'desktop'})`);
        
        // Update state
        videoStatesRef.current[containerId] = {
          videoElement,
          isPlaying: true,
          lastUpdate: Date.now()
        };
        
        resolve(videoElement);
      };

      const handleError = (error: any) => {
        console.error(`❌ UNIFIED VIDEO: Error for ${participantId}:`, error);
        resolve(null);
      };

      // Event listeners
      videoElement.addEventListener('loadedmetadata', () => {
        console.log(`📺 UNIFIED VIDEO: Metadata loaded for ${participantId}`);
        videoElement.play().then(() => {
          console.log(`HOST-UI-PLAY-OK {id=${participantId}, elId=${elId}, muted=${videoElement.muted}, autoplay=${videoElement.autoplay}}`);
          handleSuccess();
        }).catch(error => {
          console.log(`HOST-UI-PLAY-ERR {id=${participantId}, elId=${elId}, name=${error.name}, message=${error.message}}`);
          handleError(error);
        });
      });

      videoElement.addEventListener('canplay', () => {
        if (!videoElement.paused) return;
        videoElement.play().then(() => {
          console.log(`HOST-UI-PLAY-OK {id=${participantId}, elId=${elId}, muted=${videoElement.muted}, autoplay=${videoElement.autoplay}}`);
          handleSuccess();
        }).catch(error => {
          console.log(`HOST-UI-PLAY-ERR {id=${participantId}, elId=${elId}, name=${error.name}, message=${error.message}}`);
          handleError(error);
        });
      });

      videoElement.addEventListener('error', handleError);

      // Immediate play attempt
      videoElement.play().then(() => {
        console.log(`HOST-UI-PLAY-OK {id=${participantId}, elId=${elId}, muted=${videoElement.muted}, autoplay=${videoElement.autoplay}}`);
        handleSuccess();
      }).catch(() => {
        // Fallback: wait for metadata
        console.log(`⏳ UNIFIED VIDEO: Waiting for metadata for ${participantId}`);
      });

      // Timeout fallback
      setTimeout(() => {
        if (!videoStatesRef.current[containerId]?.isPlaying) {
          console.warn(`⚠️ UNIFIED VIDEO: Timeout for ${participantId}, but resolving anyway`);
          resolve(videoElement);
        }
      }, 3000);
    });
  }, []);

  const getVideoState = useCallback((containerId: string) => {
    return videoStatesRef.current[containerId] || null;
  }, []);

  const cleanup = useCallback(() => {
    Object.values(videoStatesRef.current).forEach(state => {
      if (state.videoElement) {
        state.videoElement.remove();
      }
    });
    videoStatesRef.current = {};
  }, []);

  return {
    createVideoElementUnified,
    getVideoState,
    cleanup
  };
};
