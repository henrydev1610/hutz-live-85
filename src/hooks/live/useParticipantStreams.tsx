
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
    console.log('🎬 FASE 3: CRITICAL UNIFIED stream handler for:', participantId);
    
    // FASE 3: Enhanced stream validation according to custom instructions
    if (!stream || !stream.getVideoTracks().length) {
      console.warn(`❌ FASE 3: Stream invalid for ${participantId}`, {
        streamExists: !!stream,
        tracks: stream?.getTracks()?.length || 0,
        videoTracks: stream?.getVideoTracks()?.length || 0
      });
      return;
    }
    
    // FASE 3: Critical stream validation - ensure stream is ready
    console.log(`📡 Vídeo remoto recebido`, stream);
    
    // ENHANCED mobile detection with settings fallback
    const isMobileStream = participantId.includes('mobile') || participantId.includes('qr') || 
                          stream.getVideoTracks().some(track => {
                            try {
                              const settings = track.getSettings();
                              return settings.facingMode === 'environment' || settings.facingMode === 'user';
                            } catch (error) {
                              // Fallback for browsers that don't support getSettings()
                              return participantId.includes('mobile') || participantId.includes('qr');
                            }
                          });
    
    // FASE 3: Critical stream logging as required by rules
    console.log('🎬 FASE 3-STREAM-INFO:', {
      id: participantId,
      hasVideoTracks: stream.getVideoTracks().length,
      hasAudioTracks: stream.getAudioTracks().length,
      videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
      streamActive: stream.active,
      isMobile: isMobileStream,
      streamId: stream.id,
      timestamp: Date.now(),
      readyState: stream.getVideoTracks()[0]?.readyState
    });
    
    // FASE 3: FORCE immediate stream state update FIRST with UNIFIED manager
    setParticipantStreams(prev => {
      const updated = { ...prev, [participantId]: stream };
      console.log('🔄 FASE 3-UNIFIED-STREAM: Updated streams for:', participantId);
      return updated;
    });
    
    // FASE 3: FORCE immediate participant state update - with mobile detection
    setParticipantList(prev => {
      const updated = prev.map(p => 
        p.id === participantId 
          ? { 
              ...p, 
              hasVideo: true, 
              active: true, 
              selected: true,
              connectedAt: Date.now(),
              isMobile: isMobileStream
            }
          : p
      );
      
      // If participant doesn't exist, add it
      if (!updated.find(p => p.id === participantId)) {
        updated.push({
          id: participantId,
          name: `${isMobileStream ? 'Mobile' : 'Desktop'}-${participantId.substring(0, 8)}`,
          hasVideo: true,
          active: true,
          selected: true,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          connectedAt: Date.now(),
          isMobile: isMobileStream
        });
        console.log('✅ UNIFIED-NEW: Added new participant:', participantId, `(${isMobileStream ? 'MOBILE' : 'DESKTOP'})`);
      }
      
      console.log('🔄 UNIFIED-STATE: Updated participant list for:', participantId);
      return updated;
    });
    
    // UNIFIED: SIMPLIFIED validation - accept any stream with video tracks
    const hasVideoTracks = stream.getVideoTracks().length > 0;
    if (!hasVideoTracks) {
      console.warn('❌ UNIFIED: No video tracks in stream for:', participantId);
      return;
    }
    
    console.log('✅ UNIFIED-VALIDATION: Stream is valid for:', participantId);

    // UNIFIED: Try immediate processing with retry system
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`🔄 UNIFIED-ATTEMPT ${i + 1}: Processing stream for:`, participantId);
        success = await processStreamSafely(participantId, stream);
        if (success) break;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`❌ UNIFIED-ATTEMPT ${i + 1} failed:`, error);
      }
    }
    
    if (!success) {
      console.log('📦 UNIFIED-BUFFER: Adding to buffer for background retry:', participantId);
      addToBuffer(participantId, stream);
    } else {
      console.log('✅ UNIFIED-SUCCESS: Stream processed successfully for:', participantId);
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
