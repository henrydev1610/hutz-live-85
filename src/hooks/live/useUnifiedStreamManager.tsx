/**
 * FASE 2: Hook unificado para gerenciamento de streams
 * Consolida funcionalidade de useParticipantStreams + useUnifiedVideoCreation
 * Elimina duplicidade e conflitos entre hooks
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';

interface StreamState {
  [participantId: string]: {
    stream: MediaStream;
    videoElement: HTMLVideoElement | null;
    isPlaying: boolean;
    lastUpdate: number;
    container: HTMLElement | null;
  };
}

interface UseUnifiedStreamManagerProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useUnifiedStreamManager = ({
  setParticipantStreams,
  setParticipantList,
  transmissionWindowRef
}: UseUnifiedStreamManagerProps) => {
  const { toast } = useToast();
  const streamStatesRef = useRef<StreamState>({});
  const [processingQueue, setProcessingQueue] = useState<Map<string, MediaStream>>(new Map());
  const isMobile = detectMobileAggressively();

  // FASE 2: Função unificada para criar e gerenciar video elements
  const createVideoElementUnified = useCallback(async (
    container: HTMLElement, 
    stream: MediaStream,
    participantId: string
  ): Promise<HTMLVideoElement | null> => {
    if (!container || !stream) {
      console.error('🚫 UNIFIED STREAM: Missing container or stream');
      return null;
    }

    console.log(`🎬 UNIFIED STREAM: Creating video for ${participantId}`, {
      containerId: container.id,
      isMobile,
      streamId: stream.id,
      tracks: stream.getTracks().length
    });

    // Limpar video existente
    const existingVideo = container.querySelector('video');
    if (existingVideo) {
      existingVideo.remove();
      console.log(`🧹 UNIFIED STREAM: Removed existing video`);
    }

    // Criar video element otimizado
    const videoElement = document.createElement('video');
    
    // Configuração universal
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.preload = 'auto';
    
    // Atributos específicos para mobile
    if (isMobile) {
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.setAttribute('playsinline', 'true');
    }
    
    // Styling unificado
    videoElement.className = 'w-full h-full object-cover absolute inset-0 z-10';
    videoElement.style.cssText = `
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
      background-color: transparent !important;
    `;

    // Adicionar ao DOM e definir stream
    container.appendChild(videoElement);
    videoElement.srcObject = stream;

    // Retornar promise com handling unificado
    return new Promise((resolve) => {
      const handleSuccess = () => {
        console.log(`✅ UNIFIED STREAM: Video playing successfully for ${participantId}`);
        
        // Atualizar estado unificado
        streamStatesRef.current[participantId] = {
          stream,
          videoElement,
          isPlaying: true,
          lastUpdate: Date.now(),
          container
        };
        
        resolve(videoElement);
      };

      const handleError = (error: any) => {
        console.error(`❌ UNIFIED STREAM: Video error for ${participantId}:`, error);
        resolve(null);
      };

      // Event listeners
      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play().then(handleSuccess).catch(handleError);
      });

      videoElement.addEventListener('canplay', () => {
        if (!videoElement.paused) return;
        videoElement.play().then(handleSuccess).catch(handleError);
      });

      videoElement.addEventListener('error', handleError);

      // Tentativa imediata
      videoElement.play().then(handleSuccess).catch(() => {
        console.log(`⏳ UNIFIED STREAM: Waiting for metadata for ${participantId}`);
      });

      // Timeout de fallback
      setTimeout(() => {
        if (!streamStatesRef.current[participantId]?.isPlaying) {
          console.warn(`⚠️ UNIFIED STREAM: Timeout for ${participantId}, resolving anyway`);
          resolve(videoElement);
        }
      }, 3000);
    });
  }, [isMobile]);

  // FASE 2: Função unificada para enviar stream para transmission window
  const sendStreamToTransmission = useCallback(async (
    participantId: string, 
    stream: MediaStream
  ): Promise<void> => {
    if (!transmissionWindowRef.current) {
      console.warn('⚠️ UNIFIED STREAM: No transmission window available');
      return;
    }

    try {
      const message = {
        type: 'participant-stream',
        participantId,
        streamId: stream.id,
        hasVideo: stream.getVideoTracks().length > 0,
        hasAudio: stream.getAudioTracks().length > 0,
        timestamp: Date.now()
      };

      transmissionWindowRef.current.postMessage(message, '*');
      console.log(`📡 UNIFIED STREAM: Stream data sent to transmission for ${participantId}`);
    } catch (error) {
      console.error(`❌ UNIFIED STREAM: Failed to send stream to transmission:`, error);
    }
  }, [transmissionWindowRef]);

  // FASE 2: Processamento unificado de stream
  const processStreamUnified = useCallback(async (
    participantId: string, 
    stream: MediaStream
  ): Promise<boolean> => {
    try {
      console.log(`🎯 UNIFIED STREAM: Processing stream for ${participantId}`);
      
      // Atualizar estado de streams imediatamente
      setParticipantStreams(prev => ({
        ...prev,
        [participantId]: stream
      }));
      
      // Aguardar DOM estar pronto
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(undefined);
        } else {
          const handler = () => {
            document.removeEventListener('readystatechange', handler);
            resolve(undefined);
          };
          document.addEventListener('readystatechange', handler);
        }
      });
      
      // Enviar para transmission window
      await sendStreamToTransmission(participantId, stream);
      
      // Notificação de sucesso
      toast({
        title: "Participante conectado!",
        description: `${participantId.substring(0, 8)} está transmitindo vídeo`,
      });
      
      console.log(`✅ UNIFIED STREAM: Processing completed for ${participantId}`);
      return true;
    } catch (error) {
      console.error(`❌ UNIFIED STREAM: Processing failed for ${participantId}:`, error);
      
      toast({
        title: "Erro no vídeo",
        description: `Falha ao processar vídeo de ${participantId.substring(0, 8)}`,
        variant: "destructive"
      });
      
      return false;
    }
  }, [setParticipantStreams, sendStreamToTransmission, toast]);

  // FASE 2: Handler principal de participant stream
  const handleParticipantStream = useCallback(async (
    participantId: string, 
    stream: MediaStream
  ) => {
    console.log(`🎬 UNIFIED STREAM: Handling participant stream for ${participantId}`);
    
    // Validar stream
    if (!stream || !stream.active || stream.getTracks().length === 0) {
      console.error(`❌ UNIFIED STREAM: Invalid stream for ${participantId}`);
      return;
    }

    // Atualizar lista de participantes
    setParticipantList(prev => {
      const updated = prev.map(p => 
        p.id === participantId 
          ? { 
              ...p, 
              hasVideo: true, 
              active: true, 
              selected: true,
              connectedAt: Date.now(),
              isMobile: isMobile
            }
          : p
      );
      
      // Adicionar se não existe
      if (!updated.find(p => p.id === participantId)) {
        updated.push({
          id: participantId,
          name: `${isMobile ? 'Mobile' : 'Desktop'}-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: isMobile
        });
      }
      
      return updated;
    });
    
    // Processar stream
    const success = await processStreamUnified(participantId, stream);
    
    if (!success) {
      // Adicionar à fila para retry
      setProcessingQueue(prev => new Map(prev).set(participantId, stream));
    }
  }, [processStreamUnified, setParticipantList, isMobile]);

  // FASE 2: Função para atualizar video elements
  const updateVideoElementsImmediately = useCallback(async (
    participantId: string,
    stream: MediaStream,
    transmissionWindowRef?: React.MutableRefObject<Window | null>
  ) => {
    try {
      // Encontrar containers de vídeo para este participante
      const containers = document.querySelectorAll(`[data-participant-id="${participantId}"]`);
      
      for (const container of containers) {
        await createVideoElementUnified(container as HTMLElement, stream, participantId);
      }
      
      console.log(`🔄 UNIFIED STREAM: Video elements updated for ${participantId}`);
    } catch (error) {
      console.error(`❌ UNIFIED STREAM: Failed to update video elements for ${participantId}:`, error);
    }
  }, [createVideoElementUnified]);

  // Processar fila de retry periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      if (processingQueue.size > 0) {
        processingQueue.forEach(async (stream, participantId) => {
          console.log(`🔄 UNIFIED STREAM: Retrying processing for ${participantId}`);
          const success = await processStreamUnified(participantId, stream);
          
          if (success) {
            setProcessingQueue(prev => {
              const updated = new Map(prev);
              updated.delete(participantId);
              return updated;
            });
          }
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [processingQueue, processStreamUnified]);

  // Cleanup
  const cleanup = useCallback(() => {
    Object.values(streamStatesRef.current).forEach(state => {
      if (state.videoElement) {
        state.videoElement.remove();
      }
    });
    streamStatesRef.current = {};
    setProcessingQueue(new Map());
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    handleParticipantStream,
    updateVideoElementsImmediately,
    createVideoElementUnified,
    sendStreamToTransmission,
    cleanup,
    getStreamState: (participantId: string) => streamStatesRef.current[participantId] || null
  };
};