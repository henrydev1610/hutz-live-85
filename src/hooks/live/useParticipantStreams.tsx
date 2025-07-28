
import { useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { useStreamValidation } from './useStreamValidation';
import { useStreamTransmission } from './useStreamTransmission';
import { useStreamStateManagement } from './useStreamStateManagement';
import { useStreamBuffer } from './useStreamBuffer';

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

  // Process function for buffered streams
  const processStreamSafely = useCallback(async (participantId: string, stream: MediaStream): Promise<boolean> => {
    try {
      console.log('🎯 CRITICAL: Processing stream for:', participantId);
      
      // Update stream state immediately
      updateStreamState(participantId, stream);
      
      // Wait for DOM to be ready
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
      
      // Process video update with timeout
      await Promise.race([
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Video processing timeout')), 5000))
      ]);
      
      // Send to transmission window
      await sendStreamToTransmission(participantId, stream, transmissionWindowRef);
      
      // Success notification
      toast({
        title: "Participante conectado!",
        description: `${participantId.substring(0, 8)} está transmitindo vídeo`,
      });
      
      console.log('✅ CRITICAL: Stream processing completed for:', participantId);
      return true;
    } catch (error) {
      console.error('❌ Error processing stream for:', participantId, error);
      
      // Error notification only for final failures
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
    console.log('🎬 STREAM-CRÍTICO: Processando stream do participante:', participantId);
    
    // VISUAL LOG: Toast quando stream é recebido no hook
    toast({
      title: "🎥 Stream Recebido",
      description: `Stream de ${participantId.substring(0, 8)} sendo processado`,
    });
    
    // Atualização imediata do participante para streams móveis
    setParticipantList(prev => {
      const updated = prev.map(p => 
        p.id === participantId 
          ? { 
              ...p, 
              hasVideo: true, 
              active: true, 
              selected: true,
              connectedAt: Date.now(),
              isMobile: true
            }
          : p
      );
      
      // Se participante não existe, adicionar
      if (!updated.find(p => p.id === participantId)) {
        updated.push({
          id: participantId,
          name: `Mobile-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: true
        });
        
        // VISUAL LOG: Toast quando novo participante é adicionado
        toast({
          title: "👤 Novo Participante",
          description: `${participantId.substring(0, 8)} adicionado à lista`,
        });
      }
      
      console.log('🔄 STREAM-CRÍTICO: Lista de participantes atualizada para:', participantId);
      return updated;
    });
    
    if (!validateStream(stream, participantId)) {
      console.warn('❌ STREAM-CRÍTICO: Validação de stream falhou para:', participantId);
      toast({
        title: "❌ Stream Inválido",
        description: `Stream de ${participantId.substring(0, 8)} não passou na validação`,
        variant: "destructive"
      });
      return;
    }

    // Atualização forçada do estado do stream
    setParticipantStreams(prev => {
      const updated = { ...prev, [participantId]: stream };
      console.log('🔄 STREAM-CRÍTICO: Streams atualizados para:', participantId);
      
      // VISUAL LOG: Toast quando stream é adicionado ao estado
      toast({
        title: "📹 Stream Adicionado",
        description: `Stream de ${participantId.substring(0, 8)} adicionado ao estado`,
      });
      
      return updated;
    });

    // Tentar processamento imediato primeiro
    const success = await processStreamSafely(participantId, stream);
    
    if (!success) {
      console.log('📦 STREAM-CRÍTICO: Adicionando ao buffer para retry:', participantId);
      addToBuffer(participantId, stream);
      
      toast({
        title: "🔄 Stream em Buffer",
        description: `Stream de ${participantId.substring(0, 8)} será reprocessado`,
      });
    } else {
      // VISUAL LOG: Toast quando processamento é bem-sucedido
      toast({
        title: "✅ Stream Processado",
        description: `Stream de ${participantId.substring(0, 8)} processado com sucesso`,
      });
    }
  }, [validateStream, processStreamSafely, addToBuffer, setParticipantList, setParticipantStreams, toast]);

  // Process buffer periodically
  useEffect(() => {
    const interval = setInterval(() => {
      processBuffer(processStreamSafely);
    }, 2000);

    return () => clearInterval(interval);
  }, [processBuffer, processStreamSafely]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleParticipantTrack = useCallback((participantId: string, track: MediaStreamTrack) => {
    updateTrackState(participantId, track);
    
    // Send updated stream to transmission and update video elements
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
