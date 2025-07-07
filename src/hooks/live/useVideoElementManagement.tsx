
import { useCallback } from 'react';

export const useVideoElementManagement = () => {
  const createVideoElement = useCallback((container: HTMLElement, stream: MediaStream) => {
    console.log('🎬 Creating video element in container:', container.id || container.className);
    
    // Remove any existing video elements
    const existingVideos = container.querySelectorAll('video');
    existingVideos.forEach(video => video.remove());
    
    // Clear container content
    container.innerHTML = '';
    
    // Create new video element
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.className = 'w-full h-full object-cover';
    videoElement.style.display = 'block';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.backgroundColor = 'transparent';
    
    // Set stream immediately
    videoElement.srcObject = stream;
    
    // Add to container
    container.appendChild(videoElement);
    
    // Force play with error handling
    const attemptPlay = async () => {
      try {
        await videoElement.play();
        console.log(`✅ Video playing successfully in: ${container.id || container.className}`);
        container.style.background = 'transparent';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
      } catch (error) {
        console.error(`❌ Video play failed in ${container.id || container.className}:`, error);
        // Retry after short delay
        setTimeout(() => {
          videoElement.play().catch(retryError => 
            console.error('❌ Video play retry failed:', retryError)
          );
        }, 500);
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

  const findVideoContainers = useCallback((participantId: string) => {
    return new Promise<HTMLElement[]>((resolve) => {
      const searchContainers = () => {
        const containers: HTMLElement[] = [];
        
        // Enhanced search strategies with more specific selectors
        const selectors = [
          // Specific participant containers
          `#preview-participant-video-${participantId}`,
          `#participant-video-${participantId}`,
          `[data-participant-id="${participantId}"]`,
          `.participant-video-${participantId}`,
          // Generic participant containers
          '.participant-video',
          '.participant-grid .bg-gray-800',
          '.participant-grid > div',
          '[class*="participant-video"]',
          '[class*="bg-gray-800"]',
          // Fallback to any video containers
          '.aspect-video',
          '[class*="aspect-video"]'
        ];
        
        console.log(`🔍 Searching containers for participant: ${participantId}`);
        
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            console.log(`🔍 Selector "${selector}" found ${elements.length} elements`);
            
            elements.forEach((el, index) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl && !containers.includes(htmlEl)) {
                // Check if this container is related to our participant or is available
                const isSpecific = selector.includes(participantId) || 
                                 htmlEl.id.includes(participantId) || 
                                 htmlEl.getAttribute('data-participant-id') === participantId;
                
                const isGeneric = !htmlEl.querySelector('video') && 
                                htmlEl.children.length === 0;
                
                if (isSpecific || (containers.length === 0 && isGeneric)) {
                  console.log(`✅ Found container ${index + 1}:`, {
                    id: htmlEl.id,
                    className: htmlEl.className,
                    hasVideo: !!htmlEl.querySelector('video'),
                    childrenCount: htmlEl.children.length
                  });
                  containers.push(htmlEl);
                }
              }
            });
          } catch (e) {
            console.warn(`⚠️ Selector error for "${selector}":`, e);
          }
        });
        
        return containers;
      };
      
      const containers = searchContainers();
      if (containers.length > 0) {
        console.log(`✅ Found ${containers.length} container(s) for ${participantId}`);
        resolve(containers);
      } else {
        // Wait a bit and try again
        console.log(`⏳ No containers found initially, retrying for ${participantId}...`);
        setTimeout(() => {
          const retryContainers = searchContainers();
          if (retryContainers.length === 0) {
            console.warn(`⚠️ Still no containers found for ${participantId}, will create emergency container`);
          }
          resolve(retryContainers);
        }, 200);
      }
    });
  }, []);

  const createEmergencyContainer = useCallback((participantId: string) => {
    console.log('🆘 Creating emergency video container for:', participantId);
    
    // Find the participant grid first
    let targetParent = document.querySelector('.participant-grid');
    
    if (!targetParent) {
      // Try to find the preview area
      targetParent = document.querySelector('.live-preview') || 
                   document.querySelector('[class*="preview"]') ||
                   document.querySelector('.aspect-video');
    }
    
    if (!targetParent) {
      // Create a preview area if none exists
      const mainContainer = document.querySelector('.container') || document.body;
      const previewArea = document.createElement('div');
      previewArea.className = 'participant-grid grid grid-cols-2 gap-4 p-4';
      mainContainer.appendChild(previewArea);
      targetParent = previewArea;
    }
    
    if (targetParent) {
      const emergencyContainer = document.createElement('div');
      emergencyContainer.id = `participant-video-${participantId}`;
      emergencyContainer.className = 'participant-video aspect-video bg-gray-800 rounded-lg overflow-hidden relative';
      emergencyContainer.setAttribute('data-participant-id', participantId);
      emergencyContainer.style.minHeight = '200px';
      emergencyContainer.style.minWidth = '300px';
      
      targetParent.appendChild(emergencyContainer);
      console.log('✅ Emergency container created:', emergencyContainer.id);
      return emergencyContainer;
    }
    
    console.error('❌ Could not create emergency container - no suitable parent found');
    return null;
  }, []);

  const updateVideoElementsImmediately = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef?: React.MutableRefObject<Window | null>
  ) => {
    console.log('🎬 IMMEDIATE video update for:', participantId, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Stream is not active or has no video tracks');
      return;
    }
    
    try {
      // Find existing containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ No containers found for ${participantId}, creating emergency container`);
        const emergencyContainer = createEmergencyContainer(participantId);
        if (emergencyContainer) {
          createVideoElement(emergencyContainer, stream);
        }
      } else {
        console.log(`📹 Found ${containers.length} container(s) for ${participantId}`);
        containers.forEach((container, index) => {
          console.log(`🎯 Updating container ${index + 1}:`, container.id || container.className);
          createVideoElement(container, stream);
        });
      }
      
      // Update transmission window if available
      if (transmissionWindowRef?.current && !transmissionWindowRef.current.closed) {
        console.log(`📤 Sending stream to transmission window for: ${participantId}`);
        
        transmissionWindowRef.current.postMessage({
          type: 'video-stream',
          participantId: participantId,
          hasStream: true,
          timestamp: Date.now(),
          streamInfo: {
            id: stream.id,
            active: stream.active,
            trackCount: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length
          }
        }, '*');
      } else {
        console.log('ℹ️ Transmission window not available (this is normal for preview)');
      }
      
    } catch (error) {
      console.error('❌ Failed to update video elements:', error);
    }
  }, [findVideoContainers, createEmergencyContainer, createVideoElement]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers
  };
};
