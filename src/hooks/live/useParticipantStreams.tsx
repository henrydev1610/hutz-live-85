
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
      console.log('🎯 CRITICAL: [STREAM_PROCESSING] Starting for:', participantId, {
        streamId: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        trackStates: stream.getTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      });
      
      // Update stream state immediately
      updateStreamState(participantId, stream);
      console.log('✅ CRITICAL: [STREAM_PROCESSING] Stream state updated for:', participantId);
      
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
      
      console.log('🎯 CRITICAL: [STREAM_PROCESSING] DOM ready, updating video elements for:', participantId);
      
      // Process video update with timeout
      await Promise.race([
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Video processing timeout')), 5000))
      ]);
      
      console.log('✅ CRITICAL: [STREAM_PROCESSING] Video elements updated for:', participantId);
      
      // Send to transmission window
      await sendStreamToTransmission(participantId, stream, transmissionWindowRef);
      console.log('✅ CRITICAL: [STREAM_PROCESSING] Stream sent to transmission for:', participantId);
      
      // Success notification
      toast({
        title: "Participante conectado!",
        description: `${participantId.substring(0, 8)} está transmitindo vídeo`,
      });
      
      console.log('✅ CRITICAL: [STREAM_PROCESSING] Processing completed successfully for:', participantId);
      return true;
    } catch (error) {
      console.error('❌ CRITICAL: [STREAM_PROCESSING] Error processing stream for:', participantId, error);
      
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
    console.log('🎬 CRITICAL: [STREAM_HANDLER] New participant stream received:', participantId, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      timestamp: new Date().toISOString()
    });
    
    if (!validateStream(stream, participantId)) {
      console.warn('❌ [STREAM_HANDLER] Stream validation failed for:', participantId);
      return;
    }

    console.log('✅ [STREAM_HANDLER] Stream validation passed for:', participantId);

    // Try immediate processing first
    const success = await processStreamSafely(participantId, stream);
    
    if (!success) {
      // Add to buffer for retry
      console.log('📦 [STREAM_HANDLER] Processing failed, adding to buffer for retry:', participantId);
      addToBuffer(participantId, stream);
    } else {
      console.log('✅ [STREAM_HANDLER] Stream processing successful for:', participantId);
    }
  }, [validateStream, processStreamSafely, addToBuffer]);

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
