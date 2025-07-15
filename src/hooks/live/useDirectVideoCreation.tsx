import { useEffect, useCallback, useRef } from 'react';

interface UseDirectVideoCreationProps {
  participantId: string;
  stream: MediaStream | null;
  containerId: string;
}

export const useDirectVideoCreation = ({
  participantId,
  stream,
  containerId
}: UseDirectVideoCreationProps) => {
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  const createVideoElementDirect = useCallback((container: HTMLElement, mediaStream: MediaStream) => {
    // Enhanced mobile detection
    const isMobile = participantId.includes('mobile') || 
                     participantId.includes('Mobile') ||
                     sessionStorage.getItem('isMobile') === 'true';
    
    console.log(`📱 MOBILE-DIRECT: Creating video for ${participantId} in ${containerId} (mobile: ${isMobile})`);
    
    // MOBILE-CRITICAL: Clear container completely
    container.innerHTML = '';
    
    // Create new video element with mobile optimization
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    
    // MOBILE-CRITICAL: Higher z-index for mobile streams
    const zIndex = isMobile ? 25 : 10;
    video.className = `w-full h-full object-cover absolute inset-0 z-${zIndex}`;
    
    // MOBILE-CRITICAL: Enhanced mobile attributes
    if (isMobile) {
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
      video.setAttribute('x5-playsinline', 'true');
      video.setAttribute('x5-video-player-type', 'h5');
      video.setAttribute('x5-video-player-fullscreen', 'true');
    }
    
    // MOBILE-CRITICAL: Force styles with mobile priority
    video.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: ${zIndex} !important;
      background: transparent !important;
      ${isMobile ? 'transform: scale(1.01) !important;' : ''}
    `;

    // Set stream and append to container
    video.srcObject = mediaStream;
    container.appendChild(video);

    // MOBILE-CRITICAL: Enhanced play logic for mobile
    const playVideo = async () => {
      try {
        await video.play();
        console.log(`✅ MOBILE-DIRECT: Video playing for ${participantId} (mobile: ${isMobile})`);
        
        // MOBILE-CRITICAL: Verify video is actually playing
        if (isMobile) {
          setTimeout(() => {
            if (video.paused || video.ended) {
              console.log(`⚠️ MOBILE-DIRECT: Video not playing, forcing play again`);
              video.play().catch(e => console.log(`⚠️ MOBILE-DIRECT: Force play failed:`, e));
            }
          }, 200);
        }
      } catch (error) {
        console.log(`⚠️ MOBILE-DIRECT: Play failed for ${participantId}:`, error);
        // Multiple retry attempts for mobile
        const retryAttempts = isMobile ? 3 : 1;
        for (let i = 0; i < retryAttempts; i++) {
          setTimeout(() => {
            video.play().catch(e => console.log(`⚠️ MOBILE-DIRECT: Retry ${i + 1} failed:`, e));
          }, 100 * (i + 1));
        }
      }
    };

    // Try to play immediately and on events
    playVideo();
    
    video.addEventListener('loadedmetadata', playVideo);
    video.addEventListener('canplay', playVideo);
    
    // MOBILE-CRITICAL: Force play on various events
    if (isMobile) {
      video.addEventListener('loadeddata', playVideo);
      video.addEventListener('canplaythrough', playVideo);
    }

    return video;
  }, [participantId, containerId]);

  const tryCreateVideo = useCallback(() => {
    if (!stream) {
      console.log(`🚫 DIRECT: No stream for ${participantId}`);
      return false;
    }

    // CRITICAL: Enhanced stream validation for mobile
    const hasValidTracks = stream.getTracks().length > 0;
    const hasVideoTracks = stream.getVideoTracks().length > 0;
    const isActive = stream.active;
    
    console.log(`🎯 MOBILE-CRITICAL: Stream validation for ${participantId}:`, {
      streamId: stream.id,
      active: isActive,
      hasValidTracks,
      hasVideoTracks,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      totalTracks: stream.getTracks().length,
      trackStates: stream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState, enabled: t.enabled }))
    });

    if (!hasValidTracks) {
      console.log(`🚫 DIRECT: No valid tracks in stream for ${participantId}`);
      return false;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.log(`⚠️ DIRECT: Container ${containerId} not found for ${participantId}`);
      // Try to find container with more aggressive search
      const altContainer = document.querySelector(`[data-participant-id="${participantId}"]`);
      if (altContainer) {
        console.log(`✅ DIRECT: Found alternative container for ${participantId}`);
        createVideoElementDirect(altContainer as HTMLElement, stream);
        return true;
      }
      return false;
    }

    // CRITICAL: Always recreate video for mobile to ensure proper display
    console.log(`🎬 MOBILE-CRITICAL: Force creating fresh video for ${participantId}`);
    createVideoElementDirect(container, stream);
    
    // VERIFICATION: Check if video was created successfully
    setTimeout(() => {
      const video = container.querySelector('video') as HTMLVideoElement;
      if (video && video.srcObject === stream) {
        console.log(`✅ MOBILE-CRITICAL: Video verification successful for ${participantId}`);
      } else {
        console.error(`❌ MOBILE-CRITICAL: Video verification failed for ${participantId}`);
      }
    }, 100);
    
    return true;
  }, [stream, participantId, containerId, createVideoElementDirect]);

  // Enhanced effect to handle stream changes and retry logic
  useEffect(() => {
    if (!stream) return;

    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 500;
    let retryTimeout: NodeJS.Timeout;

    const attemptVideoCreation = async () => {
      console.log(`🎬 Attempting video creation for ${participantId} (attempt ${retryCount + 1})`);
      
      try {
        const success = tryCreateVideo();
        
        if (success) {
          console.log(`✅ Video creation successful for ${participantId}`);
          return;
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(1.5, retryCount - 1);
          console.log(`⏰ Retrying video creation in ${delay}ms for ${participantId}`);
          
          retryTimeout = setTimeout(attemptVideoCreation, delay);
        } else {
          console.error(`❌ Max retries exceeded for ${participantId}`);
        }
      } catch (error) {
        console.error(`❌ Error during video creation attempt for ${participantId}:`, error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount - 1);
          retryTimeout = setTimeout(attemptVideoCreation, delay);
        }
      }
    };

    // Multiple strategies for DOM readiness
    const startCreation = () => {
      // Strategy 1: Immediate if DOM is ready
      if (document.readyState === 'complete') {
        attemptVideoCreation();
        return;
      }
      
      // Strategy 2: Wait for DOMContentLoaded
      if (document.readyState === 'loading') {
        const domHandler = () => {
          document.removeEventListener('DOMContentLoaded', domHandler);
          setTimeout(attemptVideoCreation, 100); // Small delay for React rendering
        };
        document.addEventListener('DOMContentLoaded', domHandler);
      } else {
        // Strategy 3: Interactive state - wait a bit for full readiness
        setTimeout(attemptVideoCreation, 200);
      }
    };

    startCreation();

    // Cleanup
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [stream, participantId, tryCreateVideo]);

  return { createVideoElementDirect, tryCreateVideo };
};