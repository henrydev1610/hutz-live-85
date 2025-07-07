
import { useCallback } from 'react';

export const useVideoCreation = () => {
  const createVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    console.log('🎬 Creating video element in container:', container.id || container.className);
    
    // Remove any existing video elements
    const existingVideos = container.querySelectorAll('video');
    existingVideos.forEach(video => video.remove());
    
    // Clear container content
    container.innerHTML = '';
    
    // Create new video element with enhanced attributes
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.className = 'w-full h-full object-cover';
    videoElement.style.display = 'block';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.backgroundColor = 'transparent';
    
    // Set stream immediately
    videoElement.srcObject = stream;
    
    // Add to container
    container.appendChild(videoElement);
    
    // Enhanced autoplay handling
    const attemptPlay = async (retryCount = 0, maxRetries = 3) => {
      try {
        await videoElement.play();
        console.log(`✅ Video playing successfully in: ${container.id || container.className}`);
        container.style.background = 'transparent';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        return true;
      } catch (error) {
        console.error(`❌ Video play failed in ${container.id || container.className} (attempt ${retryCount + 1}):`, error);
        
        if (retryCount < maxRetries) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
          return attemptPlay(retryCount + 1, maxRetries);
        } else {
          console.error(`❌ All play attempts failed for ${container.id || container.className}`);
          return false;
        }
      }
    };
    
    // Handle video events
    videoElement.onloadedmetadata = () => {
      console.log(`📊 Video metadata loaded for ${container.id || container.className}`);
      attemptPlay();
    };
    
    videoElement.oncanplay = () => {
      console.log(`🎯 Video can play for ${container.id || container.className}`);
      attemptPlay();
    };
    
    videoElement.onerror = (event) => {
      console.error(`❌ Video error in ${container.id || container.className}:`, videoElement.error);
    };
    
    // Start playing immediately
    attemptPlay();
    
    return videoElement;
  }, []);

  return { createVideoElement };
};
