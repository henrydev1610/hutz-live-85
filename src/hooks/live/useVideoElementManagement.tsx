
import { useCallback, useEffect } from 'react';
import { useVideoCreation } from './useVideoCreation';
import { useContainerManagement } from './useContainerManagement';
import { useStreamManager } from './useStreamManager';

export const useVideoElementManagement = () => {
  const { createVideoElement, cleanup } = useVideoCreation();
  const { findVideoContainers, createEmergencyContainer } = useContainerManagement();
  const { processStreamSafely, resetParticipantState } = useStreamManager();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const updateVideoElementsImmediately = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef?: React.MutableRefObject<Window | null>
  ) => {
    const operationId = `${participantId}-${Date.now()}`;
    console.log(`🎬 CRITICAL: IMMEDIATE video update for: ${participantId} (${operationId})`, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      active: stream.active
    });
    
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn(`⚠️ CRITICAL: Invalid stream for ${participantId} (${operationId})`);
      return;
    }
    
    // Usar processamento ULTRA SEGURO para evitar piscar
    await processStreamSafely(participantId, stream, async (pId, str) => {
      console.log(`🔐 CRITICAL: Ultra-safe video processing for ${pId} (${operationId})`);
      
      // Aguardar DOM estar completamente pronto
      if (document.readyState !== 'complete') {
        console.log(`⏳ CRITICAL: Waiting for DOM (${operationId})`);
        await new Promise(resolve => {
          const checkReady = () => {
            if (document.readyState === 'complete') {
              resolve(null);
            } else {
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        });
      }
      
      // Aguardar mais um pouco para garantir estabilidade
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Encontrar containers
      const containers = await findVideoContainers(pId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ CRITICAL: No containers found for ${pId}, creating emergency (${operationId})`);
        const emergencyContainer = createEmergencyContainer(pId);
        if (emergencyContainer) {
          console.log(`🆘 CRITICAL: Creating video in emergency container (${operationId})`);
          await createVideoElement(emergencyContainer, str);
        } else {
          console.error(`❌ CRITICAL: Failed to create emergency container (${operationId})`);
          return;
        }
      } else {
        console.log(`📹 CRITICAL: Found ${containers.length} container(s) for ${pId} (${operationId})`);
        // Processar apenas o primeiro container para evitar duplicação
        const primaryContainer = containers[0];
        console.log(`🎯 CRITICAL: Creating video in PRIMARY container: ${primaryContainer.id || primaryContainer.className} (${operationId})`);
        await createVideoElement(primaryContainer, str);
      }
      
      // Atualizar janela de transmissão apenas se não foi fechada
      if (transmissionWindowRef?.current && !transmissionWindowRef.current.closed) {
        console.log(`📤 CRITICAL: Sending stream to transmission window for: ${pId} (${operationId})`);
        
        try {
          transmissionWindowRef.current.postMessage({
            type: 'video-stream',
            participantId: pId,
            hasStream: true,
            timestamp: Date.now(),
            streamInfo: {
              id: str.id,
              active: str.active,
              trackCount: str.getTracks().length,
              videoTracks: str.getVideoTracks().length
            }
          }, '*');
        } catch (error) {
          console.warn(`⚠️ CRITICAL: Failed to send message to transmission window:`, error);
        }
      }
      
      console.log(`✅ CRITICAL: Video update completed successfully for ${pId} (${operationId})`);
    });
    
  }, [findVideoContainers, createEmergencyContainer, createVideoElement, processStreamSafely]);

  const resetVideoState = useCallback((participantId: string) => {
    console.log(`🔄 CRITICAL: Resetting video state for ${participantId}`);
    resetParticipantState(participantId);
  }, [resetParticipantState]);

  return {
    updateVideoElementsImmediately,
    createVideoElement,
    findVideoContainers,
    resetVideoState,
    cleanup
  };
};
