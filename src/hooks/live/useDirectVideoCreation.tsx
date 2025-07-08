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
    console.log(`🎬 DIRECT: Creating video for ${participantId} in ${containerId}`);
    
    // Remove any existing video first
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      console.log(`🧹 DIRECT: Removing existing video for ${participantId}`);
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

    // Force play
    const playVideo = async () => {
      try {
        await video.play();
        console.log(`✅ DIRECT: Video playing for ${participantId}`);
      } catch (error) {
        console.log(`⚠️ DIRECT: Play failed for ${participantId}:`, error);
        // Retry after short delay
        setTimeout(() => {
          video.play().catch(e => console.log(`⚠️ DIRECT: Retry failed:`, e));
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

  useEffect(() => {
    if (!stream) return;

    // Reset retry count when stream changes
    retryCountRef.current = 0;

    const attemptVideoCreation = () => {
      const success = tryCreateVideo();
      
      if (!success && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 DIRECT: Retry ${retryCountRef.current}/${maxRetries} for ${participantId}`);
        setTimeout(attemptVideoCreation, 200 * retryCountRef.current); // Exponential backoff
      } else if (!success) {
        console.error(`❌ DIRECT: Failed to create video after ${maxRetries} retries for ${participantId}`);
      }
    };

    // Initial attempt
    attemptVideoCreation();

    // Also retry when DOM is fully loaded
    if (document.readyState !== 'complete') {
      const handleLoad = () => {
        setTimeout(attemptVideoCreation, 100);
      };
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }

  }, [stream, tryCreateVideo]);

  return { createVideoElementDirect };
};