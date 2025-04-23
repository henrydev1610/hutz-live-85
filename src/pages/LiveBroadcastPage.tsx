
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
      console.log('[LiveBroadcastPage] New participant joined:', participant);
      setBroadcastData(prev => ({
        ...prev,
        participants: [...prev.participants.filter(p => p.id !== participant.id), participant]
      }));
    },
    onParticipantLeft: (participantId) => {
      console.log('[LiveBroadcastPage] Participant left:', participantId);
      setBroadcastData(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== participantId)
      }));
    }
  });
  
  // Handle incoming messages from parent window
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data) return;
    
    if (event.data.type === 'BROADCAST_DATA') {
      console.log('[LiveBroadcastPage] Received broadcast data:', event.data.payload);
      setBroadcastData(prev => ({
        ...prev,
        layout: event.data.payload.layout,
        backgroundColor: event.data.payload.backgroundColor,
        backgroundImage: event.data.payload.backgroundImage,
        qrCode: event.data.payload.qrCode,
        qrCodeText: event.data.payload.qrCodeText,
        qrCodeFont: event.data.payload.qrCodeFont,
        qrCodeColor: event.data.payload.qrCodeColor,
        participants: [
          ...event.data.payload.participants,
          ...prev.participants.filter(p => !event.data.payload.participants.some((ep: Participant) => ep.id === p.id))
        ]
      }));
    } 
    else if (event.data.type === 'PARTICIPANT_JOINED') {
      console.log('[LiveBroadcastPage] Participant joined via postMessage:', event.data);
      
      const { participantData } = event.data;
      
      if (!participantData) return;
      
      setBroadcastData(prev => {
        // Check if participant already exists
        const existingParticipantIndex = prev.participants.findIndex(p => p.id === participantData.id);
        
        if (existingParticipantIndex >= 0) {
          // Update existing participant
          const updatedParticipants = [...prev.participants];
          updatedParticipants[existingParticipantIndex] = {
            ...updatedParticipants[existingParticipantIndex],
            name: participantData.name,
            stream: participantData.stream || updatedParticipants[existingParticipantIndex].stream,
            isVisible: participantData.isVisible
          };
          return { ...prev, participants: updatedParticipants };
        } else {
          // Add new participant
          return {
            ...prev,
            participants: [...prev.participants, {
              id: participantData.id,
              name: participantData.name,
              stream: participantData.stream || null,
              isVisible: participantData.isVisible !== undefined ? participantData.isVisible : true
            }]
          };
        }
      });
    } 
    else if (event.data.type === 'PARTICIPANT_LEFT') {
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
  
  // Log active participants to help debug
  useEffect(() => {
    console.log('[LiveBroadcastPage] Current participants:', broadcastData.participants);
  }, [broadcastData.participants]);
  
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
