
import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseStreamStateManagementProps {
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
}

export const useStreamStateManagement = ({
  setParticipantStreams,
  setParticipantList
}: UseStreamStateManagementProps) => {
  
  const updateStreamState = useCallback((participantId: string, stream: MediaStream) => {
    console.log('🔄 CRITICAL: FORCE updating stream state for:', participantId, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    flushSync(() => {
      // FORCE immediate stream update
      setParticipantStreams(prev => {
        const updated = {
          ...prev,
          [participantId]: stream
        };
        console.log('📦 CRITICAL: Total streams now:', Object.keys(updated).length);
        return updated;
      });
      
      // FORCE immediate participant update with video enabled
      setParticipantList(prev => {
        const updated = prev.map(p => {
          if (p.id === participantId) {
            console.log(`✅ CRITICAL: FORCE participant ${participantId} to have video and be SELECTED`);
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
        
        // If participant doesn't exist, FORCE add them with video
        const existingParticipant = updated.find(p => p.id === participantId);
        if (!existingParticipant) {
          console.log(`➕ CRITICAL: FORCE adding new participant with video: ${participantId}`);
          updated.push({
            id: participantId,
            name: `Participante ${participantId.substring(0, 8)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true,
            hasVideo: true,
            connectedAt: Date.now()
          });
        }
        
        console.log('📝 CRITICAL: Updated participant list - selected with video:', 
          updated.filter(p => p.selected && p.hasVideo).length);
        
        return updated;
      });
    });
  }, [setParticipantStreams, setParticipantList]);

  const updateTrackState = useCallback((participantId: string, track: MediaStreamTrack) => {
    console.log(`📺 Processing track from participant ${participantId}:`, track.kind);
    
    flushSync(() => {
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
  }, [setParticipantStreams, setParticipantList]);

  return { updateStreamState, updateTrackState };
};
