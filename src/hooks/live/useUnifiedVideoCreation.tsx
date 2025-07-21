
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
    stream: MediaStream,
    participantId: string
  ): Promise<HTMLVideoElement | null> => {
    if (!container || !stream) {
      console.error('🚫 UNIFIED VIDEO: Missing container or stream');
      return null;
    }

    const containerId = container.id || `container-${participantId}`;
    const isMobile = detectMobileAggressively();
    
    console.log(`🎬 UNIFIED VIDEO: Creating video for ${participantId}`, {
      containerId,
      isMobile,
      streamId: stream.id,
      tracks: stream.getTracks().length
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
    
    // Set stream
    videoElement.srcObject = stream;

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
        videoElement.play().then(handleSuccess).catch(handleError);
      });

      videoElement.addEventListener('canplay', () => {
        if (!videoElement.paused) return;
        videoElement.play().then(handleSuccess).catch(handleError);
      });

      videoElement.addEventListener('error', handleError);

      // Immediate play attempt
      videoElement.play().then(handleSuccess).catch(() => {
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
