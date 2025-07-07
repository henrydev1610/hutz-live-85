
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
    
    // Set callbacks immediately
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

  // Monitor stream changes and update videos immediately
  useEffect(() => {
    console.log('🔍 CRITICAL Stream Monitor:', {
      totalStreams: Object.keys(participantStreams).length,
      activeParticipants: participantList.filter(p => p.active).length,
      realParticipants: participantList.filter(p => !p.id.startsWith('placeholder-')).length
    });
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      console.log(`📹 Processing stream for participant: ${participantId}`, {
        streamActive: stream.active,
        trackCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        console.log(`✅ Found participant ${participantId}, updating video display`);
        updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Ensure participant is marked as having video
        setParticipantList(prev => prev.map(p => 
          p.id === participantId 
            ? { ...p, hasVideo: true, active: true, lastActive: Date.now() }
            : p
        ));
      } else {
        console.warn(`⚠️ Stream received for unknown participant: ${participantId}`);
        
        // Add new real participant for this stream
        const newParticipant: Participant = {
          id: participantId,
          name: `Participante ${participantId.substring(0, 8)}`,
          joinedAt: Date.now(),
          lastActive: Date.now(),
          active: true,
          selected: false,
          hasVideo: true
        };
        
        console.log(`➕ Adding new real participant: ${participantId}`);
        setParticipantList(prev => [...prev, newParticipant]);
        
        // Update video display
        setTimeout(() => {
          updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        }, 100);
      }
    });
  }, [participantList, participantStreams, transmissionWindowRef, updateVideoElementsImmediately, setParticipantList]);

  // Add test connection function
  const testConnection = () => {
    console.log('🧪 Testing WebRTC connection...');
    
    // Create a test participant
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Participante Teste',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: false,
      hasVideo: false
    };
    
    setParticipantList(prev => {
      // Remove any existing test participants
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    // Try to get user media for testing
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        console.log('✅ Test stream obtained:', stream.getTracks().length, 'tracks');
        
        // Simulate receiving this stream
        handleParticipantStream(testParticipant.id, stream);
        
        // Clean up test after 10 seconds
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
    testConnection
  };
};
