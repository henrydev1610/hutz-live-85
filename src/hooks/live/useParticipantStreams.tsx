import { useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { useStreamValidation } from './useStreamValidation';
import { useStreamTransmission } from './useStreamTransmission';
import { useStreamStateManagement } from './useStreamStateManagement';
import { useStreamBuffer } from './useStreamBuffer';
import { getWebRTCManagerInstance } from '@/utils/webrtc/webrtc';

interface UseParticipantStreamsProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef?: React.MutableRefObject<Window | null>) => void;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}

export const useParticipantStreams = ({
  setParticipantStreams,
  setParticipantList,
  updateVideoElementsImmediately,
  transmissionWindowRef
}: UseParticipantStreamsProps) => {
  const { toast } = useToast();
  const { validateStream } = useStreamValidation();
  const { sendStreamToTransmission } = useStreamTransmission();
  const { updateStreamState, updateTrackState } = useStreamStateManagement({
    setParticipantStreams,
    setParticipantList
  });
  const { addToBuffer, processBuffer, removeFromBuffer, cleanup } = useStreamBuffer();

  // FASE 4: CONFIGURAR CALLBACK NO WEBRTC MANAGER
  useEffect(() => {
    const manager = getWebRTCManagerInstance();

    console.log('🎯 Stream callback sendo registrado no WebRTC Manager');
    manager.setStreamCallback((participantId, stream) => {
      console.log('🎯 Stream callback triggered for:', participantId);
      setParticipantStreams((prev) => ({
        ...prev,
        [participantId]: stream
      }));

      // Processar stream imediatamente
      handleParticipantStream(participantId, stream);
    });
  }, []);

  const processStreamSafely = useCallback(async (participantId: string, stream: MediaStream): Promise<boolean> => {
    try {
      console.log('🎯 CRITICAL: Processing stream for:', participantId);

      updateStreamState(participantId, stream);

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

      await Promise.race([
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Video processing timeout')), 5000))
      ]);

      await sendStreamToTransmission(participantId, stream, transmissionWindowRef);

      toast({
        title: "Participante conectado!",
        description: `${participantId.substring(0, 8)} está transmitindo vídeo`,
      });

      console.log('✅ CRITICAL: Stream processing completed for:', participantId);
      return true;
    } catch (error) {
      console.error('❌ Error processing stream for:', participantId, error);

      if (error.message !== 'Video processing timeout') {
        toast({
          title: "Erro no vídeo",
          description: `Falha ao exibir vídeo de ${participantId.substring(0, 8)}`,
          variant: "destructive"
        });
      }
      return false;
    }
  }, [updateStreamState, updateVideoElementsImmediately, transmissionWindowRef, sendStreamToTransmission, toast]);

  const handleParticipantStream = useCallback(async (participantId: string, stream: MediaStream) => {
    console.log('🎬 FASE 1: FORÇAR AUTO-DETECTION - Stream recebido:', participantId);

    setParticipantList(prev => {
      const existingIndex = prev.findIndex(p => p.id === participantId);
      let updated = [...prev];

      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          hasVideo: true,
          active: true,
          selected: true,
          connectedAt: Date.now(),
          isMobile: true
        };
      } else {
        const newParticipant = {
          id: participantId,
          name: `Mobile-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: true
        };

        if (!updated.some(p => p.selected && p.active)) {
          updated.unshift(newParticipant);
          console.log('🎯 FASE 1: Participante vai para P1 (primeiro quadrante)');
        } else {
          updated.push(newParticipant);
        }

        toast({
          title: "👤 P1: Novo Participante",
          description: `${participantId.substring(0, 8)} conectado no primeiro quadrante`,
        });
      }

      return updated;
    });

    console.log('🌉 FASE 2: BRIDGE DIRETO - Disparando eventos para grid');

    window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
      detail: { participantId, stream, timestamp: Date.now(), isP1: true }
    }));

    window.dispatchEvent(new CustomEvent('participant-stream-connected', {
      detail: { participantId, stream, timestamp: Date.now() }
    }));

    try {
      const bc = new BroadcastChannel('participant-updates');
      bc.postMessage({
        type: 'stream-connected',
        participantId,
        hasVideo: true,
        isP1: true,
        timestamp: Date.now()
      });
      bc.close();
    } catch (error) {
      console.warn('⚠️ FASE 2: BroadcastChannel não disponível:', error);
    }

    if (!validateStream(stream, participantId)) {
      console.warn('❌ STREAM-CRÍTICO: Validação de stream falhou para:', participantId);
      toast({
        title: "❌ Stream Inválido",
        description: `Stream de ${participantId.substring(0, 8)} não passou na validação`,
        variant: "destructive"
      });
      return;
    }

    setParticipantStreams(prev => {
      const updated = { ...prev, [participantId]: stream };
      console.log('🔄 STREAM-CRÍTICO: Streams atualizados para:', participantId);

      toast({
        title: "📹 Stream Adicionado",
        description: `Stream de ${participantId.substring(0, 8)} adicionado ao estado`,
      });

      return updated;
    });

    const success = await processStreamSafely(participantId, stream);

    if (!success) {
      console.log('📦 STREAM-CRÍTICO: Adicionando ao buffer para retry:', participantId);
      addToBuffer(participantId, stream);

      toast({
        title: "🔄 Stream em Buffer",
        description: `Stream de ${participantId.substring(0, 8)} será reprocessado`,
      });
    } else {
      toast({
        title: "✅ Stream Processado",
        description: `Stream de ${participantId.substring(0, 8)} processado com sucesso`,
      });
    }
  }, [validateStream, processStreamSafely, addToBuffer, setParticipantList, setParticipantStreams, toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      processBuffer(processStreamSafely);
    }, 2000);

    return () => clearInterval(interval);
  }, [processBuffer, processStreamSafely]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleParticipantTrack = useCallback((participantId: string, track: MediaStreamTrack) => {
    updateTrackState(participantId, track);

    setTimeout(async () => {
      const currentStreams = await new Promise<{[id: string]: MediaStream}>(resolve => {
        setParticipantStreams(prev => {
          resolve(prev);
          return prev;
        });
      });

      const stream = currentStreams[participantId];
      if (stream) {
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
      }
    }, 100);
  }, [updateTrackState, transmissionWindowRef, updateVideoElementsImmediately, sendStreamToTransmission, setParticipantStreams]);

  return {
    handleParticipantStream,
    handleParticipantTrack,
    sendStreamToTransmission
  };
};
