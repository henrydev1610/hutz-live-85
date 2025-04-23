
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import StreamPreview from '@/components/live/StreamPreview';
import { Participant } from '@/types/live';
import { useWebRTC } from '@/hooks/useWebRTC';

const LiveBroadcastPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  const [broadcastData, setBroadcastData] = useState({
    participants: [] as Participant[],
    layout: 4,
    backgroundColor: '#000000',
    backgroundImage: null as string | null,
    qrCode: {
      visible: false,
      image: '',
      position: { x: 30, y: 30 },
      size: 150
    },
    qrCodeText: {
      text: '',
      position: { x: 30, y: 200 }
    },
    qrCodeFont: 'Arial',
    qrCodeColor: '#FFFFFF'
  });
  
  const { 
    isConnected,
    connections
  } = useWebRTC({
    sessionId: sessionId || null,
    onNewParticipant: (participant) => {
      console.log('New participant joined:', participant);
      setBroadcastData(prev => ({
        ...prev,
        participants: [...prev.participants.filter(p => p.id !== participant.id), participant]
      }));
    },
    onParticipantLeft: (participantId) => {
      console.log('Participant left:', participantId);
      setBroadcastData(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== participantId)
      }));
    }
  });
  
  // Handle incoming messages from parent window
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data && event.data.type === 'BROADCAST_DATA') {
      console.log('Received broadcast data:', event.data.payload);
      setBroadcastData(prev => ({
        ...prev,
        layout: event.data.payload.layout,
        backgroundColor: event.data.payload.backgroundColor,
        backgroundImage: event.data.payload.backgroundImage,
        qrCode: event.data.payload.qrCode,
        qrCodeText: event.data.payload.qrCodeText,
        qrCodeFont: event.data.payload.qrCodeFont,
        qrCodeColor: event.data.payload.qrCodeColor
      }));
    } else if (event.data && event.data.type === 'PARTICIPANT_JOINED') {
      console.log('Participant joined via postMessage:', event.data);
      
      const { participantData } = event.data;
      const { id, name, stream } = participantData;
      
      setBroadcastData(prev => {
        // Check if participant already exists
        const existingParticipantIndex = prev.participants.findIndex(p => p.id === id);
        
        if (existingParticipantIndex >= 0) {
          // Update existing participant
          const updatedParticipants = [...prev.participants];
          updatedParticipants[existingParticipantIndex] = {
            ...updatedParticipants[existingParticipantIndex],
            name,
            stream: stream || updatedParticipants[existingParticipantIndex].stream
          };
          return { ...prev, participants: updatedParticipants };
        } else {
          // Add new participant
          return {
            ...prev,
            participants: [...prev.participants, {
              id,
              name,
              stream: stream || null,
              isVisible: true
            }]
          };
        }
      });
    } else if (event.data && event.data.type === 'PARTICIPANT_LEFT') {
      // Handle participant leaving
      const { participantId } = event.data;
      setBroadcastData(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== participantId)
      }));
    }
  }, []);
  
  useEffect(() => {
    document.title = `Transmissão - ${sessionId}`;
    
    window.addEventListener('message', handleMessage);
    
    if (window.opener) {
      window.opener.postMessage({ type: 'BROADCAST_READY', sessionId }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, handleMessage]);
  
  return (
    <div className="min-h-screen bg-black">
      <div className="fixed inset-0">
        <StreamPreview 
          participants={broadcastData.participants}
          layout={broadcastData.layout}
          backgroundColor={broadcastData.backgroundColor}
          backgroundImage={broadcastData.backgroundImage}
          qrCode={broadcastData.qrCode}
          qrCodeText={broadcastData.qrCodeText}
          qrCodeFont={broadcastData.qrCodeFont}
          qrCodeColor={broadcastData.qrCodeColor}
        />
      </div>
    </div>
  );
};

export default LiveBroadcastPage;
