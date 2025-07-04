
import { useCallback } from 'react';

export const useVideoElementManagement = () => {
  const updateVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    if (!container) {
      console.warn("❌ Video container not found");
      return;
    }
    
    console.log('🎬 Updating video element in container:', container.id);
    
    let videoElement = container.querySelector('video') as HTMLVideoElement;
    
    if (!videoElement) {
      console.log('📹 Creating new video element for:', container.id);
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.className = 'w-full h-full object-cover';
      
      // Clear container and add video
      container.innerHTML = '';
      container.appendChild(videoElement);
    }
    
    // Set stream and play
    if (videoElement.srcObject !== stream) {
      console.log('✅ Setting stream for video element:', container.id);
      videoElement.srcObject = stream;
      
      // Ensure video plays
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ Video playing successfully for:', container.id);
        }).catch(err => {
          console.error(`❌ Video play failed for ${container.id}:`, err);
          // Retry after a short delay
          setTimeout(() => {
            videoElement.play().catch(retryErr => {
              console.error(`❌ Video retry failed for ${container.id}:`, retryErr);
            });
          }, 500);
        });
      }
    }
  }, []);

  const updateVideoElementsImmediately = useCallback((
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef: React.MutableRefObject<Window | null>
  ) => {
    console.log('🎬 IMMEDIATE video update for:', participantId);
    
    // Update preview video
    const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
    if (previewContainer) {
      console.log('📹 Updating preview video for:', participantId);
      updateVideoElement(previewContainer, stream);
    } else {
      console.log('⚠️ Preview container not found for:', participantId);
    }
    
    // Update grid video
    const gridContainer = document.getElementById(`participant-video-${participantId}`);
    if (gridContainer) {
      console.log('📹 Updating grid video for:', participantId);
      updateVideoElement(gridContainer, stream);
    } else {
      console.log('⚠️ Grid container not found for:', participantId);
    }
    
    // Update transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      console.log(`📤 Sending stream to transmission window for: ${participantId}`);
      
      transmissionWindowRef.current.postMessage({
        type: 'video-stream',
        participantId: participantId,
        hasStream: true,
        timestamp: Date.now()
      }, '*');
    }
  }, [updateVideoElement]);

  return {
    updateVideoElement,
    updateVideoElementsImmediately
  };
};
