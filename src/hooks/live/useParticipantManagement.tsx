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
      updateVideoElementsImmediately(participantId, stream);
    }, 0);
  };

  const handleParticipantJoin = (participantId: string) => {
    console.log("🚀 CRITICAL: Participant joined:", participantId);
    
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        console.log(`🔄 Updating existing participant: ${participantId}`);
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
        const participantName = `Participante ${participantId.substring(0, 8)}`;
        updated[placeholderIndex] = {
          id: participantId,
          name: participantName,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: false,
          hasVideo: false,
          connectedAt: Date.now()
        };
        console.log(`✅ Replaced placeholder at index ${placeholderIndex} with ${participantId}`);
        
        // Add to session
        if (sessionId) {
          addParticipantToSession(sessionId, participantId, participantName);
        }
        
        toast({
          title: "Participante conectado",
          description: `${participantName} entrou na sessão`,
        });
        
        return updated;
      }
      
      // Add new participant if no placeholder available
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
        title: "Novo participante",
        description: `${participantName} se conectou`,
      });
      
      console.log(`➕ Added new participant: ${participantId}`);
      return [...prev, newParticipant];
    });
    
    // Update transmission window immediately
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'participant-joined',
        id: participantId,
        sessionId
      }, '*');
    }
    
    // Update transmission participants
    setTimeout(() => {
      updateTransmissionParticipants();
    }, 100);
  };

  const updateVideoElementsImmediately = (participantId: string, stream: MediaStream) => {
    console.log('🎬 IMMEDIATE video update for:', participantId);
    
    // Update preview video
    const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
    if (previewContainer) {
      console.log('📹 Updating preview video for:', participantId);
      updateVideoElement(previewContainer, stream);
    } else {
      console.log('⚠️ Preview container not found for:', participantId);
    }
    
    // Update grid video
    const gridContainer = document.getElementById(`participant-video-${participantId}`);
    if (gridContainer) {
      console.log('📹 Updating grid video for:', participantId);
      updateVideoElement(gridContainer, stream);
    } else {
      console.log('⚠️ Grid container not found for:', participantId);
    }
    
    // Update transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      console.log(`📤 Sending stream to transmission window for: ${participantId}`);
      
      transmissionWindowRef.current.postMessage({
        type: 'video-stream',
        participantId: participantId,
        hasStream: true,
        timestamp: Date.now()
      }, '*');
    }
  };

  const updateVideoElement = (container: HTMLElement, stream: MediaStream) => {
    if (!container) {
      console.warn("❌ Video container not found");
      return;
    }
    
    console.log('🎬 Updating video element in container:', container.id);
    
    let videoElement = container.querySelector('video') as HTMLVideoElement;
    
    if (!videoElement) {
      console.log('📹 Creating new video element for:', container.id);
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.setAttribute('playsinline', '');
      videoElement.className = 'w-full h-full object-cover';
      
      // Clear container and add video
      container.innerHTML = '';
      container.appendChild(videoElement);
    }
    
    // Set stream and play
    if (videoElement.srcObject !== stream) {
      console.log('✅ Setting stream for video element:', container.id);
      videoElement.srcObject = stream;
      
      // Ensure video plays
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('✅ Video playing successfully for:', container.id);
        }).catch(err => {
          console.error(`❌ Video play failed for ${container.id}:`, err);
          // Retry after a short delay
          setTimeout(() => {
            videoElement.play().catch(retryErr => {
              console.error(`❌ Video retry failed for ${container.id}:`, retryErr);
            });
          }, 500);
        });
      }
    }
  };

  // Set up WebRTC callbacks immediately
  useEffect(() => {
    console.log('🔧 Setting up IMMEDIATE WebRTC callbacks');
    
    // Set callbacks immediately
    setStreamCallback(handleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 Cleaning up WebRTC callbacks');
    };
  }, [sessionId]); // Depend on sessionId to ensure callbacks are set when session is ready

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

  // Monitor stream changes and update videos immediately
  useEffect(() => {
    console.log('🔍 Monitoring participant streams:', Object.keys(participantStreams).length);
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant && participant.active) {
        console.log(`📹 Ensuring video display for active participant: ${participantId}`);
        updateVideoElementsImmediately(participantId, stream);
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
