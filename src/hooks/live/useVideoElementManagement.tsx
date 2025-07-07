
import { useCallback } from 'react';

export const useVideoElementManagement = () => {
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

  const findVideoContainers = useCallback((participantId: string) => {
    return new Promise<HTMLElement[]>((resolve) => {
      const searchContainers = () => {
        const containers: HTMLElement[] = [];
        
        console.log(`🔍 ENHANCED: Searching containers for participant: ${participantId}`);
        console.log('🔍 DOM State:', {
          totalDivs: document.querySelectorAll('div').length,
          participantGrids: document.querySelectorAll('.participant-grid').length,
          previewContainers: document.querySelectorAll('[id*="preview-participant"]').length
        });
        
        // Enhanced search strategies with more specific selectors
        const selectors = [
          // Most specific first
          `#preview-participant-video-${participantId}`,
          `#participant-video-${participantId}`,
          `[data-participant-id="${participantId}"]`,
          `.participant-video-${participantId}`,
          // General participant containers
          '.participant-video:not(:has(video))',
          '.participant-grid .bg-gray-800:not(:has(video))',
          '.participant-grid > div:not(:has(video))',
          // Fallback to any available containers
          '.aspect-video:not(:has(video))',
          '.bg-gray-800:not(:has(video))'
        ];
        
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            console.log(`🔍 Selector "${selector}" found ${elements.length} elements`);
            
            elements.forEach((el, index) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl && !containers.includes(htmlEl)) {
                // Check if this container is suitable
                const isSpecific = selector.includes(participantId) || 
                                 htmlEl.id.includes(participantId) || 
                                 htmlEl.getAttribute('data-participant-id') === participantId;
                
                const isAvailable = !htmlEl.querySelector('video') && 
                                  htmlEl.offsetWidth > 0 && 
                                  htmlEl.offsetHeight > 0;
                
                if (isSpecific || (containers.length === 0 && isAvailable)) {
                  console.log(`✅ Found suitable container ${index + 1}:`, {
                    id: htmlEl.id,
                    className: htmlEl.className,
                    hasVideo: !!htmlEl.querySelector('video'),
                    dimensions: `${htmlEl.offsetWidth}x${htmlEl.offsetHeight}`,
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
        // Wait and try again
        console.log(`⏳ No containers found initially, retrying for ${participantId}...`);
        setTimeout(() => {
          const retryContainers = searchContainers();
          console.log(`🔄 Retry found ${retryContainers.length} containers for ${participantId}`);
          resolve(retryContainers);
        }, 300);
      }
    });
  }, []);

  const createEmergencyContainer = useCallback((participantId: string) => {
    console.log('🆘 Creating emergency video container for:', participantId);
    
    // Find the participant grid first
    let targetParent = document.querySelector('.participant-grid');
    
    if (!targetParent) {
      console.log('⚠️ No participant grid found, searching for alternatives...');
      // Try to find alternative parent containers
      targetParent = document.querySelector('.live-preview') || 
                   document.querySelector('[class*="preview"]') ||
                   document.querySelector('.aspect-video') ||
                   document.querySelector('[class*="container"]');
    }
    
    if (!targetParent) {
      console.log('🆘 No suitable parent found, creating emergency preview area...');
      // Create emergency preview area
      const mainContainer = document.querySelector('.container') || 
                           document.querySelector('main') || 
                           document.body;
      const previewArea = document.createElement('div');
      previewArea.className = 'participant-grid grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-lg';
      previewArea.id = 'emergency-participant-grid';
      mainContainer.appendChild(previewArea);
      targetParent = previewArea;
    }
    
    if (targetParent) {
      const emergencyContainer = document.createElement('div');
      emergencyContainer.id = `preview-participant-video-${participantId}`;
      emergencyContainer.className = 'participant-video aspect-video bg-gray-800 rounded-lg overflow-hidden relative';
      emergencyContainer.setAttribute('data-participant-id', participantId);
      emergencyContainer.style.minHeight = '200px';
      emergencyContainer.style.minWidth = '300px';
      emergencyContainer.style.backgroundColor = 'rgba(55, 65, 81, 0.6)';
      
      // Add visual indicator
      const indicator = document.createElement('div');
      indicator.className = 'absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded z-20';
      indicator.textContent = `P${participantId.substring(0, 4)}`;
      emergencyContainer.appendChild(indicator);
      
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
    console.log('🎬 CRITICAL: IMMEDIATE video update for:', participantId, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active,
      domReady: document.readyState
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Stream is not active or has no video tracks');
      return;
    }
    
    try {
      // Wait for DOM to be fully ready if needed
      if (document.readyState !== 'complete') {
        console.log('⏳ Waiting for DOM to be ready...');
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(null);
          } else {
            window.addEventListener('load', () => resolve(null), { once: true });
          }
        });
      }
      
      // Find existing containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ No containers found for ${participantId}, creating emergency container`);
        const emergencyContainer = createEmergencyContainer(participantId);
        if (emergencyContainer) {
          console.log('🎬 Creating video in emergency container');
          createVideoElement(emergencyContainer, stream);
        } else {
          console.error('❌ Failed to create emergency container');
          return;
        }
      } else {
        console.log(`📹 Found ${containers.length} container(s) for ${participantId}, creating videos`);
        containers.forEach((container, index) => {
          console.log(`🎯 Creating video in container ${index + 1}:`, container.id || container.className);
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
      
      console.log(`✅ Video update completed successfully for ${participantId}`);
      
    } catch (error) {
      console.error('❌ Failed to update video elements:', error);
      throw error;
    }
  }, [findVideoContainers, createEmergencyContainer, createVideoElement]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers
  };
};
