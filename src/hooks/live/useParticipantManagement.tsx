import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { addParticipantToSession } from '@/utils/sessionUtils';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';

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

  const handleParticipantStream = (participantId: string, stream: MediaStream) => {
    console.log('📹 handleParticipantStream called:', {
      participantId,
      streamId: stream.id,
      active: stream.active,
      tracks: stream.getTracks().length
    });
    
    // Update participant streams immediately
    setParticipantStreams(prev => {
      const updated = {
        ...prev,
        [participantId]: stream
      };
      console.log('📦 Updated participant streams:', Object.keys(updated));
      return updated;
    });
    
    // Update participant list to mark as having video
    setParticipantList(prev => {
      const updated = prev.map(p => {
        if (p.id === participantId) {
          console.log(`✅ Updating participant ${participantId} with video stream`);
          return { ...p, hasVideo: true, active: true, lastActive: Date.now() };
        }
        return p;
      });
      
      console.log('📝 Updated participant list:', updated.filter(p => p.active).length, 'active participants');
      return updated;
    });
    
    // Show success toast
    toast({
      title: "Vídeo recebido",
      description: `Stream de vídeo recebido do participante ${participantId.substring(0, 8)}`,
    });
    
    // Update video elements immediately
    setTimeout(() => {
      updateVideoElements(participantId, stream);
    }, 100);
  };

  const handleParticipantJoin = (participantId: string) => {
    console.log("🚀 Participant joined via WebRTC:", participantId);
    
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        return prev.map(p => p.id === participantId ? { 
          ...p, 
          active: true, 
          lastActive: Date.now(), 
          connectedAt: Date.now() 
        } : p);
      }
      
      // Find placeholder to replace
      const placeholderIndex = prev.findIndex(p => p.id.startsWith('placeholder-') && !p.active);
      if (placeholderIndex !== -1) {
        const updated = [...prev];
        updated[placeholderIndex] = {
          id: participantId,
          name: `Participante ${participantId.substring(0, 8)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: false,
          hasVideo: false,
          connectedAt: Date.now()
        };
        console.log(`🔄 Replaced placeholder at index ${placeholderIndex} with participant ${participantId}`);
        return updated;
      }
      
      // Add new participant if no placeholder
      const participantName = `Participante ${participantId.substring(0, 8)}`;
      const newParticipant = {
        id: participantId,
        name: participantName,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: true,
        selected: false,
        hasVideo: false,
        connectedAt: Date.now()
      };
      
      if (sessionId) {
        addParticipantToSession(sessionId, participantId, participantName);
      }
      
      toast({
        title: "Novo participante conectado",
        description: `${participantName} se conectou à sessão.`,
      });
      
      console.log(`➕ Added new participant: ${participantId}`);
      return [...prev, newParticipant];
    });
    
    // Update transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'participant-joined',
        id: participantId,
        sessionId
      }, '*');
    }
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  const updateVideoElements = (participantId: string, stream: MediaStream) => {
    console.log('🎥 Updating video elements for participant:', participantId);
    
    // Update preview video
    const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
    if (previewContainer) {
      updateVideoElement(previewContainer, stream);
    }
    
    // Update grid video
    const gridContainer = document.getElementById(`participant-video-${participantId}`);
    if (gridContainer) {
      updateVideoElement(gridContainer, stream);
    }
    
    // Update transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      console.log(`📤 Sending stream to transmission window for participant ${participantId}`);
      
      transmissionWindowRef.current.postMessage({
        type: 'video-stream',
        participantId: participantId,
        hasStream: true,
        timestamp: Date.now()
      }, '*');
      
      // Update video in transmission window
      setTimeout(() => {
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          const transmissionDoc = transmissionWindowRef.current.document;
          if (transmissionDoc) {
            const slots = transmissionDoc.querySelectorAll('[id^="participant-slot-"]');
            for (let slot of slots) {
              const video = slot.querySelector('video');
              if (video && video.dataset.participantId === participantId) {
                console.log(`✅ Updating transmission video for ${participantId}`);
                video.srcObject = stream;
                video.play().catch(e => console.error('Play error:', e));
                break;
              }
            }
          }
        }
      }, 200);
    }
  };

  const updateVideoElement = (container: HTMLElement, stream: MediaStream) => {
    if (!container) {
      console.warn("Video container not found");
      return;
    }
    
    let videoElement = container.querySelector('video') as HTMLVideoElement;
    
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
      console.log(`Setting video source for ${container.id}`);
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

  // Set up WebRTC callbacks
  useEffect(() => {
    console.log('🔧 Setting up WebRTC callbacks');
    setStreamCallback(handleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 Cleaning up WebRTC callbacks');
    };
  }, []);

  // Initialize placeholder participants
  useEffect(() => {
    if (participantList.length === 0) {
      console.log('🎭 Initializing placeholder participants');
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

  // Update video elements when streams change
  useEffect(() => {
    console.log('🔍 Processing participant streams:', Object.keys(participantStreams).length);
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant && participant.hasVideo) {
        console.log(`📹 Processing stream for participant ${participantId}`);
        updateVideoElements(participantId, stream);
      }
    });
  }, [participantList, participantStreams, transmissionWindowRef]);

  const handleParticipantSelect = (id: string) => {
    setParticipantList(prev => {
      const updatedList = prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p);
      
      // Update transmission window
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: updatedList
        }, '*');
        
        // If selecting and we have a stream, send it
        const participant = updatedList.find(p => p.id === id);
        if (participant?.selected && participantStreams[id]) {
          const stream = participantStreams[id];
          console.log(`📹 Participant ${id} selected, updating transmission`);
          
          setTimeout(() => {
            if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
              transmissionWindowRef.current.postMessage({
                type: 'video-stream',
                participantId: id,
                hasStream: true,
                timestamp: Date.now()
              }, '*');
            }
          }, 100);
        }
      }
      
      return updatedList;
    });
  };

  const handleParticipantRemove = (id: string) => {
    setParticipantList(prev => {
      const newList = prev.filter(p => p.id !== id);
      
      // Add a new placeholder
      const nextId = `placeholder-${Date.now()}`;
      const newParticipant = {
        id: nextId,
        name: `Participante ${newList.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      };
      
      return [...newList, newParticipant];
    });
    
    // Remove stream
    setParticipantStreams(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  // Keep existing handleParticipantTrack method for compatibility
  const handleParticipantTrack = (participantId: string, track: MediaStreamTrack) => {
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
  };

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream
  };
};
