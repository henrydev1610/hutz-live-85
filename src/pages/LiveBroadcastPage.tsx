
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import StreamPreview from '@/components/live/StreamPreview';
import { Participant } from '@/types/live';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useToast } from '@/hooks/use-toast';
import { mergeParticipantsWithStreams } from '@/utils/participantUtils';

const LiveBroadcastPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const isInitializedRef = useRef(false);
  const messageProcessingRef = useRef(false);
  
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
      console.log('[LiveBroadcastPage] New participant joined via WebRTC:', participant);
      
      setBroadcastData(prev => {
        // First remove any existing participant with the same ID
        const filteredParticipants = prev.participants.filter(p => p.id !== participant.id);
        
        // Then add the new participant with the stream
        return {
          ...prev,
          participants: [...filteredParticipants, {
            ...participant,
            isVisible: true // Always make new WebRTC participants visible
          }]
        };
      });
    },
    onParticipantLeft: (participantId) => {
      console.log('[LiveBroadcastPage] Participant left:', participantId);
      
      setBroadcastData(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== participantId)
      }));
    }
  });
  
  // Handle incoming messages from parent window with improved state management
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data || messageProcessingRef.current) return;
    
    // Set processing flag to prevent concurrent updates
    messageProcessingRef.current = true;
    
    try {
      console.log('[LiveBroadcastPage] Received message:', event.data.type);
      
      if (event.data.type === 'BROADCAST_DATA') {
        console.log('[LiveBroadcastPage] Received broadcast data:', event.data.payload);
        
        // Ensure we have the latest participant state
        const incomingParticipants = event.data.payload.participants || [];
        console.log('[LiveBroadcastPage] Processing incoming participants:', incomingParticipants);
        
        setBroadcastData(prev => {
          // Use utility to merge participants while preserving streams
          const mergedParticipants = mergeParticipantsWithStreams(incomingParticipants, prev.participants);
          
          console.log('[LiveBroadcastPage] Merged participants with streams:', 
            mergedParticipants.map(p => ({ 
              id: p.id, 
              name: p.name,
              hasStream: !!p.stream, 
              streamId: p.stream?.id,
              isVisible: p.isVisible
            })));
          
          return {
            ...prev,
            layout: event.data.payload.layout || prev.layout,
            backgroundColor: event.data.payload.backgroundColor || prev.backgroundColor,
            backgroundImage: event.data.payload.backgroundImage || prev.backgroundImage,
            qrCode: event.data.payload.qrCode || prev.qrCode,
            qrCodeText: event.data.payload.qrCodeText || prev.qrCodeText,
            qrCodeFont: event.data.payload.qrCodeFont || prev.qrCodeFont,
            qrCodeColor: event.data.payload.qrCodeColor || prev.qrCodeColor,
            participants: mergedParticipants
          };
        });
      } 
      else if (event.data.type === 'PARTICIPANT_JOINED') {
        console.log('[LiveBroadcastPage] Participant joined via postMessage:', event.data);
        
        const { participantData } = event.data;
        
        if (!participantData) {
          console.warn('[LiveBroadcastPage] Received PARTICIPANT_JOINED without participant data');
          return;
        }
        
        setBroadcastData(prev => {
          // Check if participant already exists
          const existingParticipantIndex = prev.participants.findIndex(p => p.id === participantData.id);
          
          if (existingParticipantIndex >= 0) {
            // Update existing participant but preserve stream if it exists
            const updatedParticipants = [...prev.participants];
            const existingStream = updatedParticipants[existingParticipantIndex].stream;
            
            updatedParticipants[existingParticipantIndex] = {
              ...updatedParticipants[existingParticipantIndex],
              name: participantData.name,
              stream: participantData.stream || existingStream,
              isVisible: participantData.isVisible !== undefined ? 
                participantData.isVisible : 
                updatedParticipants[existingParticipantIndex].isVisible
            };
            
            console.log('[LiveBroadcastPage] Updated existing participant:', updatedParticipants[existingParticipantIndex]);
            return { ...prev, participants: updatedParticipants };
          } else {
            // Add new participant
            const newParticipant = {
              id: participantData.id,
              name: participantData.name,
              stream: participantData.stream || null,
              isVisible: participantData.isVisible !== undefined ? participantData.isVisible : true
            };
            
            console.log('[LiveBroadcastPage] Added new participant:', newParticipant);
            return {
              ...prev,
              participants: [...prev.participants, newParticipant]
            };
          }
        });
      } 
      else if (event.data.type === 'PARTICIPANT_LEFT') {
        // Handle participant leaving
        const { participantId } = event.data;
        console.log('[LiveBroadcastPage] Participant left:', participantId);
        
        setBroadcastData(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.id !== participantId)
        }));
      }
      else if (event.data.type === 'PARTICIPANT_VISIBILITY_CHANGED') {
        // Handle participant visibility change
        const { participantId, isVisible } = event.data;
        console.log('[LiveBroadcastPage] Participant visibility changed:', participantId, isVisible);
        
        setBroadcastData(prev => ({
          ...prev,
          participants: prev.participants.map(p => 
            p.id === participantId ? { ...p, isVisible } : p
          )
        }));
      }
      else if (event.data.type === 'PARTICIPANT_NAME_CHANGED') {
        // Handle participant name change
        const { participantId, name } = event.data;
        console.log('[LiveBroadcastPage] Participant name changed:', participantId, name);
        
        setBroadcastData(prev => ({
          ...prev,
          participants: prev.participants.map(p => 
            p.id === participantId ? { ...p, name } : p
          )
        }));
      }
    } finally {
      // Reset processing flag when done
      messageProcessingRef.current = false;
    }
  }, []);
  
  useEffect(() => {
    document.title = `Transmissão - ${sessionId}`;
    
    window.addEventListener('message', handleMessage);
    
    if (window.opener && !isInitializedRef.current) {
      isInitializedRef.current = true;
      window.opener.postMessage({ type: 'BROADCAST_READY', sessionId }, '*');
      
      console.log('[LiveBroadcastPage] Sent BROADCAST_READY message to opener');
      
      // Request initial data with a slight delay to ensure parent window is ready
      setTimeout(() => {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'REQUEST_BROADCAST_DATA', sessionId }, '*');
          console.log('[LiveBroadcastPage] Sent REQUEST_BROADCAST_DATA message to opener');
        }
      }, 1000);
      
      // Set up a periodic request for fresh data
      const refreshInterval = setInterval(() => {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'REQUEST_BROADCAST_DATA', sessionId }, '*');
        } else {
          clearInterval(refreshInterval);
        }
      }, 5000);
      
      return () => clearInterval(refreshInterval);
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, handleMessage]);
  
  // Log active participants to help debug
  useEffect(() => {
    console.log('[LiveBroadcastPage] Current participants:', 
      broadcastData.participants.map(p => ({
        id: p.id, 
        name: p.name, 
        hasStream: !!p.stream,
        streamId: p.stream?.id,
        isVisible: p.isVisible
      }))
    );
    console.log('[LiveBroadcastPage] Visible participants:', 
      broadcastData.participants.filter(p => p.isVisible !== false).map(p => ({
        id: p.id, 
        name: p.name, 
        hasStream: !!p.stream,
        streamId: p.stream?.id
      }))
    );
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
