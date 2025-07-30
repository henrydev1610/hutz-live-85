
import { useCallback } from 'react';

export const useContainerManagement = () => {
  const findVideoContainers = useCallback((participantId: string) => {
    return new Promise<HTMLElement[]>((resolve) => {
      const searchContainers = () => {
         const containers: HTMLElement[] = [];
         
         console.log(`🔍 CRITICAL: FORCE searching containers for participant: ${participantId}`);
         console.log('🔍 CRITICAL: DOM State:', {
           totalDivs: document.querySelectorAll('div').length,
           participantGrids: document.querySelectorAll('.participant-grid').length,
           previewContainers: document.querySelectorAll('[id*="preview-participant"]').length,
           participantVideoContainers: document.querySelectorAll('.participant-video').length,
           participantContainersWithId: document.querySelectorAll(`[data-participant-id="${participantId}"]`).length,
           allParticipantContainers: document.querySelectorAll('.participant-video').length
         });
        
        // ENHANCED search with FORCED container detection
        const selectors = [
          // Most specific first - EXACT participant container
          `#preview-participant-video-${participantId}`,
          `#participant-video-${participantId}`, 
          `[data-participant-id="${participantId}"]`,
          `.participant-video-${participantId}`,
          // ANY participant container without video
          '.participant-video:not(:has(video))',
          // ANY container in participant grid
          '.participant-grid .participant-video',
          '.participant-grid > div',
          // FORCE any available video container
          '.aspect-video',
          '.bg-gray-800',
          // EMERGENCY - any div that looks like a container
          '[class*="participant"]',
          '[class*="video"]'
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
        // CORREÇÃO 2: SEMPRE criar container se não encontrar
        console.log(`🆘 CRÍTICO: Nenhum container encontrado, criando de emergência para ${participantId}`);
        
        const emergencyContainer = createEmergencyContainer(participantId);
        if (emergencyContainer) {
          console.log(`✅ CRÍTICO: Container de emergência criado para ${participantId}`);
          resolve([emergencyContainer]);
        } else {
          // Wait and try again como fallback final
          console.log(`⏳ Fallback: Aguardando containers aparecerem para ${participantId}...`);
          setTimeout(() => {
            const retryContainers = searchContainers();
            console.log(`🔄 Retry found ${retryContainers.length} containers for ${participantId}`);
            
            // Se ainda não encontrou, criar outro emergency
            if (retryContainers.length === 0) {
              const finalEmergency = createEmergencyContainer(participantId);
              resolve(finalEmergency ? [finalEmergency] : []);
            } else {
              resolve(retryContainers);
            }
          }, 300);
        }
      }
    });
  }, []);

  const createEmergencyContainer = useCallback((participantId: string) => {
    console.log('🆘 CRÍTICO: Criando container de emergência GARANTIDO para:', participantId);
    
    // CORREÇÃO 2: Buscar parent com fallbacks múltiplos
    let targetParent = document.querySelector('.participant-grid') ||
                      document.querySelector('.live-preview') || 
                      document.querySelector('[class*="preview"]') ||
                      document.querySelector('.grid') ||
                      document.querySelector('[class*="container"]') ||
                      document.querySelector('main') ||
                      document.body;
    
    if (!targetParent) {
      console.error('❌ CRÍTICO: Nenhum parent encontrado - usando body como fallback');
      targetParent = document.body;
    }
    
    // GARANTIR que temos uma grid de participantes
    let participantGrid = document.querySelector('.participant-grid');
    if (!participantGrid) {
      console.log('🆘 CRÍTICO: Criando participant-grid de emergência');
      const emergencyGrid = document.createElement('div');
      emergencyGrid.className = 'participant-grid grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-lg min-h-[400px]';
      emergencyGrid.id = 'emergency-participant-grid';
      emergencyGrid.style.position = 'relative';
      emergencyGrid.style.zIndex = '10';
      targetParent.appendChild(emergencyGrid);
      participantGrid = emergencyGrid;
    }
    
    // CRIAR container com múltiplos IDs para garantir detecção
    const emergencyContainer = document.createElement('div');
    const containerId = `preview-participant-video-${participantId}`;
    
    emergencyContainer.id = containerId;
    emergencyContainer.className = 'participant-video aspect-video bg-gray-800 rounded-lg overflow-hidden relative border-2 border-green-500';
    emergencyContainer.setAttribute('data-participant-id', participantId);
    emergencyContainer.setAttribute('data-emergency', 'true');
    
    // CORREÇÃO: Dimensões e visibilidade garantidas
    emergencyContainer.style.minHeight = '240px';
    emergencyContainer.style.minWidth = '320px';
    emergencyContainer.style.backgroundColor = 'rgba(55, 65, 81, 0.8)';
    emergencyContainer.style.display = 'block';
    emergencyContainer.style.visibility = 'visible';
    emergencyContainer.style.opacity = '1';
    emergencyContainer.style.position = 'relative';
    
    // Indicador visual melhorado
    const indicator = document.createElement('div');
    indicator.className = 'absolute top-2 left-2 bg-green-500 text-white text-xs px-3 py-1 rounded z-30 font-bold';
    indicator.textContent = `EMERGENCY ${participantId.substring(0, 6)}`;
    indicator.style.pointerEvents = 'none';
    emergencyContainer.appendChild(indicator);
    
    // Loading indicator
    const loader = document.createElement('div');
    loader.className = 'absolute inset-0 flex items-center justify-center text-white text-sm bg-black/50';
    loader.textContent = 'Aguardando stream...';
    loader.id = `loader-${participantId}`;
    emergencyContainer.appendChild(loader);
    
    participantGrid.appendChild(emergencyContainer);
    
    console.log('✅ CRÍTICO: Container de emergência criado com GARANTIAS:', {
      id: containerId,
      parent: participantGrid.className,
      dimensions: `${emergencyContainer.offsetWidth}x${emergencyContainer.offsetHeight}`,
      visible: emergencyContainer.offsetParent !== null
    });
    
    // Força uma atualização do layout
    emergencyContainer.offsetHeight;
    
    return emergencyContainer;
  }, []);

  return { findVideoContainers, createEmergencyContainer };
};
