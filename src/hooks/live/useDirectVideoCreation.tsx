import { useEffect, useCallback } from 'react';

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

  useEffect(() => {
    if (!stream || !stream.active || stream.getVideoTracks().length === 0) {
      console.log(`🚫 DIRECT: No valid stream for ${participantId}`, {
        hasStream: !!stream,
        active: stream?.active,
        videoTracks: stream?.getVideoTracks().length || 0
      });
      return;
    }

    console.log(`🎯 DIRECT: Processing stream for ${participantId}`, {
      streamId: stream.id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    // Wait for DOM to be ready, then create video
    const processVideo = () => {
      const container = document.getElementById(containerId);
      
      if (!container) {
        console.log(`⚠️ DIRECT: Container ${containerId} not found for ${participantId}`);
        return;
      }

      console.log(`✅ DIRECT: Container found, creating video for ${participantId}`);
      createVideoElementDirect(container, stream);
    };

    // Process immediately if DOM is ready
    if (document.readyState === 'complete') {
      processVideo();
    } else {
      // Wait for DOM
      const timer = setTimeout(processVideo, 100);
      return () => clearTimeout(timer);
    }

  }, [stream, participantId, containerId, createVideoElementDirect]);

  return { createVideoElementDirect };
};