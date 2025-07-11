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
    console.log(`🎬 DIRECT: [${participantId}] Creating video element in ${containerId}`);
    
    // Remove any existing video first
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      console.log(`🧹 DIRECT: [${participantId}] Removing existing video`);
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

    // Enhanced event logging
    video.addEventListener('loadstart', () => {
      console.log(`📱 DIRECT: [${participantId}] Video loadstart`);
    });
    
    video.addEventListener('loadedmetadata', () => {
      console.log(`📱 DIRECT: [${participantId}] Video metadata loaded`, {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration
      });
    });
    
    video.addEventListener('canplay', () => {
      console.log(`📱 DIRECT: [${participantId}] Video can play`);
    });
    
    video.addEventListener('playing', () => {
      console.log(`✅ DIRECT: [${participantId}] Video is playing!`);
    });
    
    video.addEventListener('error', (e) => {
      console.error(`❌ DIRECT: [${participantId}] Video error:`, e, video.error);
    });

    // Set stream and append to container
    console.log(`🔗 DIRECT: [${participantId}] Setting srcObject and appending to container`);
    video.srcObject = mediaStream;
    container.appendChild(video);

    // Force play with enhanced error handling
    const playVideo = async () => {
      try {
        console.log(`▶️ DIRECT: [${participantId}] Attempting to play video`);
        await video.play();
        console.log(`✅ DIRECT: [${participantId}] Video playing successfully`);
      } catch (error) {
        console.error(`⚠️ DIRECT: [${participantId}] Play failed:`, error);
        // Retry after short delay
        setTimeout(() => {
          console.log(`🔄 DIRECT: [${participantId}] Retrying play`);
          video.play().catch(e => console.error(`❌ DIRECT: [${participantId}] Retry failed:`, e));
        }, 100);
      }
    };

    // Try to play immediately and on events
    playVideo();
    
    video.addEventListener('loadedmetadata', playVideo);
    video.addEventListener('canplay', playVideo);

    return video;
  }, [participantId, containerId]);

  const tryCreateVideo = useCallback(() => {
    console.log(`🎯 DIRECT: [${participantId}] Trying to create video...`);
    
    if (!stream) {
      console.log(`🚫 DIRECT: [${participantId}] No stream available`);
      return false;
    }

    // Enhanced stream validation
    const hasValidTracks = stream.getTracks().length > 0;
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    console.log(`🔍 DIRECT: [${participantId}] Stream analysis:`, {
      streamId: stream.id,
      active: stream.active,
      totalTracks: stream.getTracks().length,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoTrackStates: videoTracks.map(t => ({ 
        id: t.id, 
        enabled: t.enabled, 
        readyState: t.readyState,
        muted: t.muted 
      }))
    });
    
    if (!hasValidTracks) {
      console.log(`🚫 DIRECT: [${participantId}] No tracks in stream`);
      return false;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.log(`⚠️ DIRECT: [${participantId}] Container ${containerId} not found`);
      return false;
    }

    // Check if video already exists and is playing correctly
    const existingVideo = container.querySelector('video') as HTMLVideoElement;
    if (existingVideo) {
      console.log(`🔍 DIRECT: [${participantId}] Existing video state:`, {
        srcObject: !!existingVideo.srcObject,
        sameStream: existingVideo.srcObject === stream,
        paused: existingVideo.paused,
        readyState: existingVideo.readyState,
        videoWidth: existingVideo.videoWidth,
        videoHeight: existingVideo.videoHeight
      });
      
      if (existingVideo.srcObject === stream && !existingVideo.paused && existingVideo.readyState >= 2) {
        console.log(`✅ DIRECT: [${participantId}] Video already playing correctly`);
        return true;
      }
    }

    console.log(`🎬 DIRECT: [${participantId}] Creating new video element`);
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