
import { useCallback, useRef } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { useStreamTransmission } from './useStreamTransmission';

interface StreamInfo {
  stream: MediaStream;
  participantId: string;
  isMobile: boolean;
  processed: boolean;
  timestamp: number;
}

export const useCleanStreamManagement = ({
  setParticipantStreams,
  setParticipantList,
  updateVideoElementsImmediately,
  transmissionWindowRef
}: {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef: React.MutableRefObject<Window | null>) => Promise<void>;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
}) => {
  const streamBufferRef = useRef<Map<string, StreamInfo>>(new Map());
  const processingRef = useRef<Set<string>>(new Set());
  
  // FASE 2: Integração do sistema de transmissão de streams
  const { sendStreamToTransmission } = useStreamTransmission();

  const handleParticipantStream = useCallback(async (participantId: string, stream: MediaStream) => {
    if (!participantId || !stream) {
      console.warn('⚠️ CLEAN STREAM: Invalid participantId or stream');
      return;
    }

    // Prevent duplicate processing
    if (processingRef.current.has(participantId)) {
      console.log(`🔄 CLEAN STREAM: Already processing ${participantId}, skipping`);
      return;
    }

    processingRef.current.add(participantId);

    try {
      const isMobile = detectMobileAggressively();
      
      console.log(`🎥 CLEAN STREAM: Processing stream for ${participantId}`, {
        streamId: stream.id,
        isMobile,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });

      // Buffer the stream info
      streamBufferRef.current.set(participantId, {
        stream,
        participantId,
        isMobile,
        processed: false,
        timestamp: Date.now()
      });

      // Update participant streams state
      setParticipantStreams(prev => ({
        ...prev,
        [participantId]: stream
      }));

      // Update participant list with correct mobile detection
      setParticipantList(prev => prev.map(p => 
        p.id === participantId 
          ? { 
              ...p, 
              hasVideo: stream.getVideoTracks().length > 0,
              active: true,
              selected: true,
              isMobile,
              lastActive: Date.now()
            }
          : p
      ));

      // Process video creation immediately
      await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);

      // FASE 2: Registrar stream globalmente e notificar popup
      console.log('📡 CRITICAL: Registrando stream no host para:', participantId);
      sendStreamToTransmission(participantId, stream, transmissionWindowRef);
      
      console.log(`✅ CLEAN STREAM: Stream registrado e notificado para ${participantId}`);

      // Mark as processed
      const streamInfo = streamBufferRef.current.get(participantId);
      if (streamInfo) {
        streamInfo.processed = true;
      }

      console.log(`✅ CLEAN STREAM: Successfully processed ${participantId} (${isMobile ? 'mobile' : 'desktop'})`);

    } catch (error) {
      console.error(`❌ CLEAN STREAM: Error processing ${participantId}:`, error);
    } finally {
      processingRef.current.delete(participantId);
    }
  }, [setParticipantStreams, setParticipantList, updateVideoElementsImmediately, transmissionWindowRef]);

  const getStreamInfo = useCallback((participantId: string) => {
    return streamBufferRef.current.get(participantId) || null;
  }, []);

  const cleanup = useCallback(() => {
    streamBufferRef.current.clear();
    processingRef.current.clear();
  }, []);

  return {
    handleParticipantStream,
    getStreamInfo,
    cleanup
  };
};
