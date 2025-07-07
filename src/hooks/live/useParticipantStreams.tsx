
import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';

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

  const handleParticipantStream = useCallback((participantId: string, stream: MediaStream) => {
    console.log('🎥 CRITICAL: handleParticipantStream called for:', participantId);
    console.log('🎥 Stream details:', {
      streamId: stream.id,
      active: stream.active,
      tracks: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    // Validate stream
    if (!stream.active || stream.getVideoTracks().length === 0) {
      console.warn('⚠️ Received inactive stream or stream without video tracks');
      return;
    }
    
    // STEP 1: Force React state update with flushSync
    flushSync(() => {
      // IMMEDIATE stream update
      setParticipantStreams(prev => {
        const updated = {
          ...prev,
          [participantId]: stream
        };
        console.log('✅ IMMEDIATE stream update for:', participantId);
        console.log('📦 Total streams now:', Object.keys(updated).length);
        return updated;
      });
      
      // IMMEDIATE participant list update with AUTO-SELECTION for transmission
      setParticipantList(prev => {
        const updated = prev.map(p => {
          if (p.id === participantId) {
            console.log(`✅ IMMEDIATE participant update: ${participantId} now has video and is SELECTED`);
            return { 
              ...p, 
              hasVideo: true, 
              active: true, 
              selected: true,
              lastActive: Date.now(),
              connectedAt: Date.now()
            };
          }
          return p;
        });
        
        // If participant doesn't exist, add them
        const existingParticipant = updated.find(p => p.id === participantId);
        if (!existingParticipant) {
          console.log(`➕ Adding new participant: ${participantId}`);
          updated.push({
            id: participantId,
            name: `Participante ${participantId.substring(0, 8)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true,
            hasVideo: true
          });
        }
        
        console.log('📝 Updated participant list - selected participants:', 
          updated.filter(p => p.selected && p.hasVideo).length);
        
        return updated;
      });
    });
    
    // STEP 2: Wait for DOM to be ready, then update video elements
    const updateVideoWithRetry = async (attempt = 1, maxAttempts = 5) => {
      console.log(`📤 CRITICAL: Video update attempt ${attempt}/${maxAttempts} for ${participantId}`);
      
      try {
        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
        
        // Update video elements
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Send to transmission window
        sendStreamToTransmission(participantId, stream, transmissionWindowRef);
        
        console.log(`✅ Video elements updated successfully on attempt ${attempt}`);
        
        // Show success toast
        toast({
          title: "Vídeo conectado!",
          description: `Participante ${participantId.substring(0, 8)} está transmitindo`,
        });
        
      } catch (error) {
        console.error(`❌ Video update attempt ${attempt} failed:`, error);
        
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying video update for ${participantId} (attempt ${attempt + 1})`);
          setTimeout(() => updateVideoWithRetry(attempt + 1, maxAttempts), 300);
        } else {
          console.error(`❌ All video update attempts failed for ${participantId}`);
        }
      }
    };
    
    // Start the retry process
    updateVideoWithRetry();
    
  }, [setParticipantStreams, setParticipantList, toast, updateVideoElementsImmediately, transmissionWindowRef]);

  // Enhanced function to send streams to transmission window
  const sendStreamToTransmission = (
    participantId: string, 
    stream: MediaStream, 
    transmissionWindowRef: React.MutableRefObject<Window | null>
  ) => {
    console.log('📡 CRITICAL: Sending stream to transmission for:', participantId);
    
    try {
      // Send via postMessage to transmission window
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'participant-stream-ready',
          participantId: participantId,
          streamInfo: {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            hasVideo: stream.getVideoTracks().length > 0
          },
          timestamp: Date.now()
        }, '*');
        
        console.log('✅ Stream info sent to transmission window via postMessage');
      } else {
        console.log('ℹ️ Transmission window not available (normal for preview mode)');
      }
      
      // Also send via BroadcastChannel for redundancy
      const sessionId = window.sessionStorage.getItem('currentSessionId');
      if (sessionId) {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'video-stream',
          participantId: participantId,
          hasStream: true,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          videoTrackCount: stream.getVideoTracks().length,
          timestamp: Date.now()
        });
        
        console.log('✅ Stream info sent via BroadcastChannel');
        
        // Close channel after sending
        setTimeout(() => channel.close(), 1000);
      }
      
    } catch (error) {
      console.error('❌ Failed to send stream to transmission:', error);
    }
  };

  const handleParticipantTrack = useCallback((participantId: string, track: MediaStreamTrack) => {
    console.log(`📺 Processing track from participant ${participantId}:`, track.kind);
    
    flushSync(() => {
      setParticipantStreams(prev => {
        if (prev[participantId]) {
          const existingStream = prev[participantId];
          const trackExists = existingStream.getTracks().some(t => t.id === track.id);
          
          if (!trackExists) {
            console.log(`Adding new track ${track.id} to existing stream`);
            existingStream.addTrack(track);
            
            // Send updated stream to transmission and update video elements
            setTimeout(async () => {
              sendStreamToTransmission(participantId, existingStream, transmissionWindowRef);
              await updateVideoElementsImmediately(participantId, existingStream, transmissionWindowRef);
            }, 100);
            
            return { ...prev };
          }
          return prev;
        }
        
        console.log(`Creating new stream for participant ${participantId}`);
        const newStream = new MediaStream([track]);
        
        // Send new stream to transmission and update video elements
        setTimeout(async () => {
          sendStreamToTransmission(participantId, newStream, transmissionWindowRef);
          await updateVideoElementsImmediately(participantId, newStream, transmissionWindowRef);
        }, 100);
        
        return {
          ...prev,
          [participantId]: newStream
        };
      });
      
      // Auto-select participant with new track
      setParticipantList(prev => 
        prev.map(p => p.id === participantId ? { 
          ...p, 
          hasVideo: track.kind === 'video' || p.hasVideo, 
          active: true,
          selected: true
        } : p)
      );
    });
  }, [setParticipantStreams, setParticipantList, transmissionWindowRef, updateVideoElementsImmediately]);

  return {
    handleParticipantStream,
    handleParticipantTrack,
    sendStreamToTransmission
  };
};
