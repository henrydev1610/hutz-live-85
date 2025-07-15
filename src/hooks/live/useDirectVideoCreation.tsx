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
    console.log(`🎬 UNIFIED-DIRECT: Creating video for ${participantId} in ${containerId}`, {
      streamId: mediaStream.id,
      active: mediaStream.active,
      videoTracks: mediaStream.getVideoTracks().length,
      containerId,
      timestamp: Date.now()
    });
    
    // Remove any existing video first
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      console.log(`🧹 UNIFIED-DIRECT: Removing existing video for ${participantId}`);
      existingVideo.remove();
    }

    // Create new video element
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.className = 'w-full h-full object-cover absolute inset-0 z-10';
    
    // Force styles
    video.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
      background: transparent !important;
    `;

    // Set stream and append to container
    video.srcObject = mediaStream;
    container.appendChild(video);

    console.log(`📺 UNIFIED-DIRECT: Video element created and appended for ${participantId}`);

    // Force play
    const playVideo = async () => {
      try {
        await video.play();
        console.log(`✅ UNIFIED-DIRECT: Video playing for ${participantId}`, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          currentTime: video.currentTime,
          duration: video.duration
        });
      } catch (error) {
        console.log(`⚠️ UNIFIED-DIRECT: Play failed for ${participantId}:`, error);
        // Retry after short delay
        setTimeout(() => {
          video.play().catch(e => console.log(`⚠️ UNIFIED-DIRECT: Retry failed:`, e));
        }, 100);
      }
    };

    // Try to play immediately and on events
    playVideo();
    
    video.addEventListener('loadedmetadata', () => {
      console.log(`📋 UNIFIED-DIRECT: Metadata loaded for ${participantId}`);
      playVideo();
    });
    
    video.addEventListener('canplay', () => {
      console.log(`🎬 UNIFIED-DIRECT: Can play for ${participantId}`);
      playVideo();
    });

    return video;
  }, [participantId, containerId]);

  const tryCreateVideo = useCallback(() => {
    if (!stream) {
      console.log(`🚫 DIRECT: No stream for ${participantId}`);
      return false;
    }

    // More lenient stream validation - just check if stream exists
    const hasValidTracks = stream.getTracks().length > 0;
    if (!hasValidTracks) {
      console.log(`🚫 DIRECT: No tracks in stream for ${participantId}`, {
        streamId: stream.id,
        tracks: stream.getTracks().length
      });
      return false;
    }

    console.log(`🎯 DIRECT: Processing stream for ${participantId}`, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      totalTracks: stream.getTracks().length
    });

    const container = document.getElementById(containerId);
    if (!container) {
      console.log(`⚠️ DIRECT: Container ${containerId} not found for ${participantId}`);
      return false;
    }

    // Check if video already exists and is playing
    const existingVideo = container.querySelector('video') as HTMLVideoElement;
    if (existingVideo && existingVideo.srcObject === stream && !existingVideo.paused) {
      console.log(`✅ DIRECT: Video already playing for ${participantId}`);
      return true;
    }

    console.log(`✅ DIRECT: Creating video for ${participantId}`);
    createVideoElementDirect(container, stream);
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