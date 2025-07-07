
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseParticipantAutoSelectionProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantAutoSelection = ({
  participantList,
  setParticipantList,
  participantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantAutoSelectionProps) => {

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
      
      if (participant && stream.active) {
        console.log(`✅ FORCE AUTO-SELECTING participant ${participantId} for transmission`);
        
        // Always ensure the participant is selected and has video
        setParticipantList(prev => prev.map(p => 
          p.id === participantId 
            ? { ...p, selected: true, hasVideo: true, active: true }
            : p
        ));
        
        // Immediately send to transmission window multiple times to ensure delivery
        setTimeout(() => {
          transferStreamToTransmission(participantId, stream);
          updateTransmissionParticipants();
          
          // Force update again after a short delay
          setTimeout(() => {
            transferStreamToTransmission(participantId, stream);
            updateTransmissionParticipants();
          }, 500);
        }, 100);
      }
    });
  }, [participantStreams, participantList, setParticipantList, transmissionWindowRef, updateTransmissionParticipants]);

  // Function to transfer streams to transmission window
  const transferStreamToTransmission = (participantId: string, stream: MediaStream) => {
    if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) {
      console.warn('⚠️ Transmission window not available for stream transfer');
      return;
    }

    console.log('📤 CRITICAL: Transferring stream to transmission window:', participantId);
    
    try {
      // Send multiple types of messages to ensure compatibility
      const messages = [
        {
          type: 'participant-stream-ready',
          participantId: participantId,
          streamInfo: {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
          },
          timestamp: Date.now()
        },
        {
          type: 'video-stream',
          participantId: participantId,
          hasStream: true,
          streamActive: stream.active,
          trackCount: stream.getTracks().length,
          timestamp: Date.now()
        },
        {
          type: 'participant-auto-selected',
          participantId: participantId,
          selected: true,
          hasVideo: true,
          timestamp: Date.now()
        }
      ];

      // Send all messages to transmission window
      messages.forEach(message => {
        transmissionWindowRef.current?.postMessage(message, '*');
      });

      // Use BroadcastChannel for additional communication
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      messages.forEach(message => {
        channel.postMessage(message);
      });
      
      console.log('✅ Multiple stream transfer messages sent for:', participantId);
      
    } catch (error) {
      console.error('❌ Failed to transfer stream:', error);
    }
  };

  return { transferStreamToTransmission };
};
