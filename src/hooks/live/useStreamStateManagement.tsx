
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
    console.log('🔄 STATE: Updating stream state for:', participantId, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    flushSync(() => {
      // IMMEDIATE stream update
      setParticipantStreams(prev => {
        const updated = {
          ...prev,
          [participantId]: stream
        };
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
