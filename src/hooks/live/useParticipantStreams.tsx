
import { useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { useStreamTransmission } from './useStreamTransmission';
import { useStreamStateManagement } from './useStreamStateManagement';
import { useStreamBuffer } from './useStreamBuffer';
import { useMobileDebugger } from './useMobileDebugger';
import { useMobileStreamProcessor } from './useMobileStreamProcessor';

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
  const { sendStreamToTransmission } = useStreamTransmission();
  const { updateStreamState, updateTrackState } = useStreamStateManagement({
    setParticipantStreams,
    setParticipantList
  });
  const { addToBuffer, processBuffer, removeFromBuffer, cleanup } = useStreamBuffer();
  const { debugInfo, updateDebugInfo } = useMobileDebugger();
  const { processMobileStream, validateMobileStream } = useMobileStreamProcessor();

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
    console.log('🎬 MOBILE-CRITICAL: Handling participant stream for:', participantId);
    
    // SIMPLIFIED: Basic stream validation for mobile compatibility
    console.log(`[HOST] MOBILE-CRITICAL: Stream received from ${participantId}:`, {
      streamId: stream.id,
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      streamActive: stream.active,
      tracks: stream.getTracks().map(t => ({ kind: t.kind, id: t.id, readyState: t.readyState }))
    });

    // SIMPLIFIED: Accept any stream with tracks
    if (!stream || stream.getTracks().length === 0) {
      console.error(`❌ MOBILE-CRITICAL: Invalid stream received from ${participantId} (no tracks)`);
      return;
    }
    
    // MOBILE-CRITICAL: Accept ALL streams regardless of active state for mobile compatibility
    const isMobileParticipant = participantId.includes('mobile-') || 
                               participantId.includes('Mobile') ||
                               sessionStorage.getItem('isMobile') === 'true' ||
                               sessionStorage.getItem('accessedViaQR') === 'true';
    
    console.log(`✅ MOBILE-CRITICAL: Stream validation passed for ${participantId} (mobile: ${isMobileParticipant})`);
    
    console.log(`📱 MOBILE-DETECTION: Participant ${participantId} mobile status:`, {
      includesMobile: participantId.includes('mobile-'),
      includesCapitalMobile: participantId.includes('Mobile'),
      sessionMobile: sessionStorage.getItem('isMobile') === 'true',
      accessedViaQR: sessionStorage.getItem('accessedViaQR') === 'true',
      finalResult: isMobileParticipant
    });
    
    console.log(`📱 MOBILE-CRITICAL: Updating participant state for ${participantId} (mobile: ${isMobileParticipant})`);
    setParticipantList(prev => {
      const existingIndex = prev.findIndex(p => p.id === participantId);
      let updated;
      
      if (existingIndex >= 0) {
        // Update existing participant - FORCE mobile priority
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          hasVideo: true,
          active: true,
          selected: true,
          connectedAt: Date.now(),
          lastActive: Date.now(),
          isMobile: isMobileParticipant,
          name: isMobileParticipant ? `📱 Mobile-${participantId.substring(0, 8)}` : updated[existingIndex].name
        };
        console.log(`✅ MOBILE-CRITICAL: Updated existing participant ${participantId} (mobile: ${isMobileParticipant})`);
      } else {
        // Add new participant - FORCE mobile priority
        updated = [...prev, {
          id: participantId,
          name: isMobileParticipant ? `📱 Mobile-${participantId.substring(0, 8)}` : `Participant-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: isMobileParticipant
        }];
        console.log(`✅ MOBILE-CRITICAL: Added new participant ${participantId} (mobile: ${isMobileParticipant})`);
      }
      
      // MOBILE-CRITICAL: Sort to ensure mobile participants are always first
      updated.sort((a, b) => {
        if (a.isMobile && !b.isMobile) return -1;
        if (!a.isMobile && b.isMobile) return 1;
        return (b.connectedAt || b.joinedAt || 0) - (a.connectedAt || a.joinedAt || 0);
      });
      
      // FASE 4: Update debug info
      const mobileParticipants = updated.filter(p => p.isMobile).map(p => p.id);
      updateDebugInfo({
        participantCount: updated.length,
        mobileCount: mobileParticipants.length,
        mobileParticipants: mobileParticipants,
        connectionState: 'connected'
      });
      
      return updated;
    });

    // CRITICAL FIX: Update stream state IMMEDIATELY after participant update
    console.log(`🔄 MOBILE-CRITICAL: Updating stream state for ${participantId}`);
    setParticipantStreams(prev => {
      const updated = { ...prev, [participantId]: stream };
      console.log(`✅ MOBILE-CRITICAL: Stream state updated for ${participantId}`, {
        streamId: stream.id,
        totalStreams: Object.keys(updated).length,
        isMobile: isMobileParticipant
      });
      
      // FASE 4: Update debug info with stream count
      updateDebugInfo({
        streamsCount: Object.keys(updated).length
      });
      
      return updated;
    });

    // MOBILE-CRITICAL: Enhanced processing with mobile-specific handling
    let success = false;
    
    if (isMobileParticipant) {
      console.log('📱 MOBILE-CRITICAL: Processing mobile stream with specialized handler');
      success = await processMobileStream(participantId, stream, updateVideoElementsImmediately);
      
      // If mobile processing fails, try standard processing as fallback
      if (!success) {
        console.log('🔄 MOBILE-FALLBACK: Trying standard processing for mobile stream');
        success = await processStreamSafely(participantId, stream);
      }
    } else {
      // Standard processing for desktop participants
      success = await processStreamSafely(participantId, stream);
    }
    
    if (!success) {
      // Add to buffer for retry with mobile priority
      console.log(`📦 Adding to buffer for retry: ${participantId} (mobile: ${isMobileParticipant})`);
      addToBuffer(participantId, stream);
    } else {
      console.log(`✅ MOBILE-SUCCESS: Stream processing completed for ${participantId} (mobile: ${isMobileParticipant})`);
    }
  }, [processStreamSafely, addToBuffer, setParticipantList, setParticipantStreams]);

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
