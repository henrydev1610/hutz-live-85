
import { useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';

interface UseParticipantStreamsProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  updateVideoElementsImmediately: (participantId: string, stream: MediaStream, transmissionWindowRef: React.MutableRefObject<Window | null>) => void;
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
    
    // IMMEDIATE participant list update
    setParticipantList(prev => {
      const updated = prev.map(p => {
        if (p.id === participantId) {
          console.log(`✅ IMMEDIATE participant update: ${participantId} now has video`);
          return { 
            ...p, 
            hasVideo: true, 
            active: true, 
            lastActive: Date.now(),
            connectedAt: Date.now()
          };
        }
        return p;
      });
      
      console.log('📝 Updated participant list - active participants:', 
        updated.filter(p => p.active && p.hasVideo).length);
      return updated;
    });
    
    // Show toast notification
    toast({
      title: "Vídeo conectado!",
      description: `Participante ${participantId.substring(0, 8)} está transmitindo`,
    });
    
    // IMMEDIATE video element update
    setTimeout(() => {
      updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
    }, 0);
  }, [setParticipantStreams, setParticipantList, toast, updateVideoElementsImmediately, transmissionWindowRef]);

  const handleParticipantTrack = useCallback((participantId: string, track: MediaStreamTrack) => {
    console.log(`📺 Processing track from participant ${participantId}:`, track.kind);
    
    setParticipantStreams(prev => {
      if (prev[participantId]) {
        const existingStream = prev[participantId];
        const trackExists = existingStream.getTracks().some(t => t.id === track.id);
        
        if (!trackExists) {
          console.log(`Adding new track ${track.id} to existing stream`);
          existingStream.addTrack(track);
          return { ...prev };
        }
        return prev;
      }
      
      console.log(`Creating new stream for participant ${participantId}`);
      const newStream = new MediaStream([track]);
      
      return {
        ...prev,
        [participantId]: newStream
      };
    });
    
    setParticipantList(prev => 
      prev.map(p => p.id === participantId ? { ...p, hasVideo: true, active: true } : p)
    );
  }, [setParticipantStreams, setParticipantList]);

  return {
    handleParticipantStream,
    handleParticipantTrack
  };
};
