
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { addParticipantToSession } from '@/utils/sessionUtils';

interface UseParticipantManagementProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantManagementProps) => {
  const { toast } = useToast();

  useEffect(() => {
    if (participantList.length === 0) {
      const initialParticipants = Array(4).fill(0).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `Participante ${i + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      }));
      setParticipantList(initialParticipants);
    }
  }, [participantList.length, setParticipantList]);

  useEffect(() => {
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        if (participant.selected) {
          const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
          updateVideoElement(previewContainer, stream);
        }
        
        const gridContainer = document.getElementById(`participant-video-${participantId}`);
        updateVideoElement(gridContainer, stream);
      }
    });
  }, [participantList, participantStreams]);

  const updateVideoElement = (container: HTMLElement | null, stream: MediaStream) => {
    if (!container) {
      console.warn("Video container not found");
      return;
    }
    
    let videoElement = container.querySelector('video');
    
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.className = 'w-full h-full object-cover';
      container.innerHTML = '';
      container.appendChild(videoElement);
      console.log("Created new video element in container:", container.id);
    }
    
    if (videoElement.srcObject !== stream) {
      console.log(`Setting video source for ${container.id} to stream with ${stream.getTracks().length} tracks`);
      stream.getTracks().forEach(track => {
        console.log(`- Track: ${track.kind} (${track.id}), enabled=${track.enabled}, muted=${track.muted}, state=${track.readyState}`);
      });
      
      videoElement.srcObject = stream;
      
      videoElement.play().catch(err => {
        console.error(`Error playing video in ${container.id}:`, err);
        
        setTimeout(() => {
          videoElement.play().catch(retryErr => {
            console.error(`Error playing video in ${container.id} on retry:`, retryErr);
          });
        }, 500);
      });
    }
  };

  const handleParticipantTrack = (participantId: string, track: MediaStreamTrack) => {
    console.log(`Processing track from participant ${participantId}:`, track);
    
    setParticipantStreams(prev => {
      if (prev[participantId]) {
        const existingStream = prev[participantId];
        const trackExists = existingStream.getTracks().some(t => t.id === track.id);
        
        if (!trackExists) {
          console.log(`Adding new track ${track.id} to existing stream for participant ${participantId}`);
          existingStream.addTrack(track);
          return { ...prev };
        }
        console.log(`Track ${track.id} already exists in stream for participant ${participantId}`);
        return prev;
      }
      
      console.log(`Creating new stream for participant ${participantId} with track ${track.id}`);
      const newStream = new MediaStream([track]);
      
      return {
        ...prev,
        [participantId]: newStream
      };
    });
    
    setParticipantList(prev => 
      prev.map(p => p.id === participantId ? { ...p, hasVideo: true } : p)
    );
    
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'video-stream',
          participantId,
          stream: { hasStream: true, trackId: track.id }
        });
        setTimeout(() => channel.close(), 500);
      } catch (e) {
        console.error("Error sending video stream notification to transmission window:", e);
      }
    }
  };

  const handleParticipantSelect = (id: string) => {
    setParticipantList(prev => {
      const updatedList = prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p);
      
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: updatedList
        }, '*');
      }
      
      return updatedList;
    });
  };

  const handleParticipantRemove = (id: string) => {
    setParticipantList(prev => {
      const newList = prev.filter(p => p.id !== id);
      
      const nextId = `placeholder-${prev.length}`;
      const now = Date.now();
      const newParticipant = {
        id: nextId,
        name: `Participante ${newList.length + 1}`,
        joinedAt: now,
        lastActive: now,
        active: false,
        selected: false,
        hasVideo: false
      };
      
      return [...newList, newParticipant];
    });
  };

  const handleParticipantJoin = (participantId: string) => {
    console.log("Participant joined via backend:", participantId);
    
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        return prev.map(p => p.id === participantId ? { ...p, active: true, hasVideo: true, lastActive: Date.now(), connectedAt: Date.now() } : p);
      }
      
      const participantName = `Participante ${prev.filter(p => !p.id.startsWith('placeholder-')).length + 1}`;
      const now = Date.now();
      const newParticipant = {
        id: participantId,
        name: participantName,
        joinedAt: now,
        lastActive: now,
        active: true,
        selected: true,
        hasVideo: true,
        connectedAt: now
      };
      
      if (sessionId) {
        addParticipantToSession(sessionId, participantId, participantName);
      }
      
      toast({
        title: "Novo participante conectado",
        description: `${participantName} se conectou à sessão via backend.`,
      });
      
      const filteredList = prev.filter(p => !p.id.startsWith('placeholder-') || p.active);
      return [...filteredList, newParticipant];
    });
    
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'participant-joined',
        id: participantId,
        sessionId
      }, '*');
    }
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin
  };
};
