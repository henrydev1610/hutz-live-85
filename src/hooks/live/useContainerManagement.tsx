
import { useCallback } from 'react';

export const useContainerManagement = () => {
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

  return { findVideoContainers, createEmergencyContainer };
};
