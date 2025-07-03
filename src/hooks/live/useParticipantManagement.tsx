
import { useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Participant } from '@/components/live/ParticipantGrid';
import { addParticipantToSession } from '@/utils/sessionUtils';
import { setStreamCallback } from '@/utils/webrtc';

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
      tracks: stream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState
      }))
    });
    
    // Find if this participant exists in our list
    const existingParticipant = participantList.find(p => p.id === participantId);
    console.log('🔍 Existing participant lookup:', {
      participantId,
      found: !!existingParticipant,
      existingParticipant
    });
    
    setParticipantStreams(prev => {
      const updated = {
        ...prev,
        [participantId]: stream
      };
      console.log('📦 Updated participant streams:', Object.keys(updated));
      return updated;
    });
    
    setParticipantList(prev => {
      const updated = prev.map(p => {
        if (p.id === participantId) {
          console.log(`✅ Updating participant ${participantId} with video stream`);
          return { ...p, hasVideo: true, active: true };
        }
        return p;
      });
      
      // If participant not found, it might be a placeholder - update the first inactive one
      if (!existingParticipant) {
        console.log('⚠️ Participant not found in list, looking for placeholder to update');
        const placeholderIndex = updated.findIndex(p => p.id.startsWith('placeholder-') && !p.active);
        if (placeholderIndex !== -1) {
          console.log(`🔄 Replacing placeholder at index ${placeholderIndex} with participant ${participantId}`);
          updated[placeholderIndex] = {
            id: participantId,
            name: `Participante ${participantId.substring(0, 8)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true,
            hasVideo: true
          };
        }
      }
      
      return updated;
    });
    
    toast({
      title: "Vídeo recebido",
      description: `Stream de vídeo recebido do participante ${participantId}`,
    });
  };

  // Set up WebRTC stream callback
  useEffect(() => {
    setStreamCallback(handleParticipantStream);
  }, [setParticipantStreams, setParticipantList, toast]);

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
    console.log('🔍 Available participant streams:', Object.keys(participantStreams));
    console.log('🔍 Participants with streams:', Object.keys(participantStreams).length);
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        console.log(`📹 Processing stream for participant ${participantId}:`, {
          hasVideo: participant.hasVideo,
          selected: participant.selected,
          streamTracks: stream.getTracks().length
        });
        
        if (participant.selected) {
          const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
          updateVideoElement(previewContainer, stream);
          
          // Send stream to transmission window
          if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
            console.log(`📤 Sending stream to transmission window for participant ${participantId}`);
            
            // First notify about the stream
            transmissionWindowRef.current.postMessage({
              type: 'video-stream',
              participantId: participantId,
              hasStream: true,
              timestamp: Date.now()
            }, '*');
            
            // Then update the video element in the transmission window
            setTimeout(() => {
              if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
                const transmissionDoc = transmissionWindowRef.current.document;
                if (transmissionDoc) {
                  // Find existing video element or create slot
                  const existingVideo = transmissionDoc.querySelector(`[data-participant-id="${participantId}"]`);
                  if (existingVideo && existingVideo instanceof HTMLVideoElement) {
                    console.log(`✅ Found existing video element for ${participantId}, updating stream`);
                    existingVideo.srcObject = stream;
                    existingVideo.play().catch(e => console.error('Play error:', e));
                  } else {
                    // Try to find the slot by searching all participant slots
                    const slots = transmissionDoc.querySelectorAll('[id^="participant-slot-"]');
                    for (let slot of slots) {
                      const video = slot.querySelector('video');
                      if (video && video.dataset.participantId === participantId) {
                        console.log(`✅ Found video in slot for ${participantId}, updating stream`);
                        video.srcObject = stream;
                        video.play().catch(e => console.error('Play error:', e));
                        break;
                      }
                    }
                  }
                }
              }
            }, 100);
          }
        }
        
        const gridContainer = document.getElementById(`participant-video-${participantId}`);
        updateVideoElement(gridContainer, stream);
      }
    });
  }, [participantList, participantStreams, transmissionWindowRef]);

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
        
        // If selecting and we have a stream, send it to transmission window
        const participant = updatedList.find(p => p.id === id);
        if (participant?.selected && participantStreams[id]) {
          const stream = participantStreams[id];
          console.log(`📹 Participant ${id} selected, sending stream to transmission window`);
          
          // Notify about stream availability
          transmissionWindowRef.current.postMessage({
            type: 'video-stream',
            participantId: id,
            hasStream: true,
            timestamp: Date.now()
          }, '*');
          
          // Update video element directly
          setTimeout(() => {
            if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
              const transmissionDoc = transmissionWindowRef.current.document;
              if (transmissionDoc) {
                // Find slot for this participant
                const slots = transmissionDoc.querySelectorAll('[id^="participant-slot-"]');
                for (let slot of slots) {
                  const video = slot.querySelector('video');
                  if (video && video.dataset.participantId === id) {
                    console.log(`✅ Updating stream for selected participant ${id}`);
                    video.srcObject = stream;
                    video.play().catch(e => console.error('Play error:', e));
                    break;
                  }
                }
              }
            }
          }, 200);
        }
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
    handleParticipantJoin,
    handleParticipantStream
  };
};
