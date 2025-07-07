
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useParticipantStreams } from './useParticipantStreams';
import { useParticipantLifecycle } from './useParticipantLifecycle';

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
  const { updateVideoElementsImmediately } = useVideoElementManagement();
  
  const { handleParticipantStream, handleParticipantTrack } = useParticipantStreams({
    setParticipantStreams,
    setParticipantList,
    updateVideoElementsImmediately,
    transmissionWindowRef
  });

  const { 
    handleParticipantJoin, 
    handleParticipantSelect, 
    handleParticipantRemove 
  } = useParticipantLifecycle({
    participantList,
    setParticipantList,
    setParticipantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // Set up WebRTC callbacks immediately
  useEffect(() => {
    console.log('🔧 Setting up IMMEDIATE WebRTC callbacks');
    
    setStreamCallback(handleParticipantStream);
    setParticipantJoinCallback(handleParticipantJoin);
    
    return () => {
      console.log('🧹 Cleaning up WebRTC callbacks');
    };
  }, [sessionId, handleParticipantStream, handleParticipantJoin]);

  // Initialize placeholder participants - ONLY if no real participants exist
  useEffect(() => {
    const realParticipants = participantList.filter(p => !p.id.startsWith('placeholder-'));
    const placeholderCount = participantList.filter(p => p.id.startsWith('placeholder-')).length;
    
    console.log('🎭 Participant analysis:', {
      total: participantList.length,
      real: realParticipants.length,
      placeholders: placeholderCount
    });
    
    // Only create placeholders if we have less than 4 total participants
    if (participantList.length < 4) {
      const neededPlaceholders = 4 - participantList.length;
      console.log(`🎭 Creating ${neededPlaceholders} placeholder participants`);
      
      const newPlaceholders = Array(neededPlaceholders).fill(0).map((_, i) => ({
        id: `placeholder-${Date.now()}-${i}`,
        name: `Participante ${participantList.length + i + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      }));
      
      setParticipantList(prev => [...prev, ...newPlaceholders]);
    }
  }, [participantList.length, setParticipantList]);

  // CRITICAL: Auto-select participants with streams for transmission
  useEffect(() => {
    console.log('🎯 CRITICAL: Auto-selecting participants with streams');
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      
      if (participant && !participant.selected && stream.active) {
        console.log(`✅ AUTO-SELECTING participant ${participantId} for transmission`);
        
        setParticipantList(prev => prev.map(p => 
          p.id === participantId 
            ? { ...p, selected: true, hasVideo: true, active: true }
            : p
        ));
        
        // Immediately send to transmission window
        setTimeout(() => {
          transferStreamToTransmission(participantId, stream);
          updateTransmissionParticipants();
        }, 100);
      }
    });
  }, [participantStreams, participantList, transmissionWindowRef, updateTransmissionParticipants]);

  // NEW: Function to transfer streams to transmission window
  const transferStreamToTransmission = (participantId: string, stream: MediaStream) => {
    if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) {
      console.warn('⚠️ Transmission window not available for stream transfer');
      return;
    }

    console.log('📤 CRITICAL: Transferring stream to transmission window:', participantId);
    
    try {
      // Send stream information to transmission window
      transmissionWindowRef.current.postMessage({
        type: 'participant-stream-ready',
        participantId: participantId,
        streamInfo: {
          id: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        },
        timestamp: Date.now()
      }, '*');

      // Use BroadcastChannel for additional communication
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'video-stream',
        participantId: participantId,
        hasStream: true,
        streamActive: stream.active,
        trackCount: stream.getTracks().length
      });
      
      console.log('✅ Stream transfer initiated for:', participantId);
      
    } catch (error) {
      console.error('❌ Failed to transfer stream:', error);
    }
  };

  // Enhanced stream monitoring with better DOM-ready checks and auto-selection
  useEffect(() => {
    console.log('🔍 CRITICAL Stream Monitor:', {
      totalStreams: Object.keys(participantStreams).length,
      activeParticipants: participantList.filter(p => p.active).length,
      selectedParticipants: participantList.filter(p => p.selected).length,
      realParticipants: participantList.filter(p => !p.id.startsWith('placeholder-')).length
    });
    
    // Process streams when DOM is ready
    const processStreams = () => {
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        console.log(`📹 Processing stream for participant: ${participantId}`, {
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        const participant = participantList.find(p => p.id === participantId);
        if (participant) {
          console.log(`✅ Found participant ${participantId}, updating for transmission`);
          
          // Ensure participant is marked correctly AND selected for transmission
          setParticipantList(prev => prev.map(p => 
            p.id === participantId 
              ? { 
                  ...p, 
                  hasVideo: true, 
                  active: true, 
                  selected: true, // AUTO-SELECT for transmission
                  lastActive: Date.now() 
                }
              : p
          ));
          
          // Transfer stream to transmission and update video display
          setTimeout(() => {
            transferStreamToTransmission(participantId, stream);
            updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
          }, 150);
          
        } else {
          console.warn(`⚠️ Stream received for unknown participant: ${participantId}`);
          
          // Add new real participant for this stream and auto-select
          const newParticipant: Participant = {
            id: participantId,
            name: `Participante ${participantId.substring(0, 8)}`,
            joinedAt: Date.now(),
            lastActive: Date.now(),
            active: true,
            selected: true, // AUTO-SELECT new participants
            hasVideo: true
          };
          
          console.log(`➕ Adding new auto-selected participant: ${participantId}`);
          setParticipantList(prev => [...prev, newParticipant]);
          
          // Transfer stream and update display
          setTimeout(() => {
            transferStreamToTransmission(participantId, stream);
            updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
          }, 200);
        }
      });
    };

    // Process streams when DOM is ready
    if (document.readyState === 'complete') {
      processStreams();
    } else {
      window.addEventListener('load', processStreams);
      return () => window.removeEventListener('load', processStreams);
    }
  }, [participantList, participantStreams, transmissionWindowRef, updateVideoElementsImmediately, setParticipantList, sessionId]);

  const testConnection = () => {
    console.log('🧪 Testing WebRTC connection...');
    
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Participante Teste',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: true, // Auto-select test participant
      hasVideo: false
    };
    
    setParticipantList(prev => {
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        console.log('✅ Test stream obtained:', stream.getTracks().length, 'tracks');
        
        handleParticipantStream(testParticipant.id, stream);
        
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
          setParticipantStreams(prev => {
            const updated = { ...prev };
            delete updated[testParticipant.id];
            return updated;
          });
        }, 10000);
      })
      .catch(err => {
        console.error('❌ Test connection failed:', err);
      });
  };

  return {
    handleParticipantTrack,
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream,
    testConnection,
    transferStreamToTransmission
  };
};
