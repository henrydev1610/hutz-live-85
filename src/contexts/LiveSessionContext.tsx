
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import { Participant } from '@/types/live';
import { useWebRTC } from '@/hooks/useWebRTC';

interface LiveSessionContextProps {
  // Session management
  sessionId: string | null;
  generateSessionId: () => void;
  
  // Participants management
  participants: Participant[];
  waitingList: Participant[];
  selectedParticipants: Participant[];
  selectParticipant: (id: string) => void;
  removeParticipant: (id: string) => void;
  maxParticipants: number;
  toggleParticipantVisibility: (id: string) => void;
  isParticipantVisible: (id: string) => boolean;
  refreshParticipants: () => void;
  
  // Layout management
  layout: number;
  setLayout: (count: number) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  backgroundImage: string | null;
  setBackgroundImage: (image: string | null) => void;
  
  // QR Code management
  qrCode: {
    image: string;
    visible: boolean;
    position: { x: number; y: number };
    size: number;
  };
  showQRCode: () => void;
  hideQRCode: () => void;
  qrCodeText: {
    text: string;
    position: { x: number; y: number };
  };
  setQRCodeText: (text: string) => void;
  qrCodeFont: string;
  setQrCodeFont: (font: string) => void;
  qrCodeColor: string;
  setQrCodeColor: (color: string) => void;
  
  // Call to Action
  callToAction: {
    type: 'image' | 'coupon';
    image: string | null;
    text: string | null;
    link: string | null;
  };
  setCallToActionType: (type: 'image' | 'coupon') => void;
  setCallToActionImage: (image: string | null) => void;
  setCallToActionText: (text: string | null) => void;
  setCallToActionLink: (link: string | null) => void;
  
  // Broadcast
  isLive: boolean;
  startBroadcast: () => void;
  stopBroadcast: () => void;
  broadcastWindow: Window | null;
}

const LiveSessionContext = createContext<LiveSessionContextProps | undefined>(undefined);

export const LiveSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitingList, setWaitingList] = useState<Participant[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);
  const [layout, setLayout] = useState(4);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [broadcastWindow, setBroadcastWindow] = useState<Window | null>(null);
  const maxParticipants = 50;
  
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodePosition, setQrCodePosition] = useState({ x: 30, y: 30 });
  const [qrCodeSize, setQrCodeSize] = useState(150);
  const [qrCodeText, setQrCodeTextState] = useState('Escaneie para participar!');
  const [qrCodeTextPosition, setQrCodeTextPosition] = useState({ x: 30, y: 200 });
  const [qrCodeFont, setQrCodeFont] = useState('Arial');
  const [qrCodeColor, setQrCodeColor] = useState('#FFFFFF');
  
  const [callToActionType, setCallToActionType] = useState<'image' | 'coupon'>('image');
  const [callToActionImage, setCallToActionImage] = useState<string | null>(null);
  const [callToActionText, setCallToActionText] = useState<string | null>(null);
  const [callToActionLink, setCallToActionLink] = useState<string | null>(null);
  
  // Use a set for tracking participant visibility
  const [visibleParticipants, setVisibleParticipants] = useState<Set<string>>(new Set());
  
  const messageReceivedRef = useRef<boolean>(false);
  
  const { 
    localStream,
    isConnected,
    initializeHostCamera
  } = useWebRTC({
    sessionId,
    onNewParticipant: (participant) => {
      console.log('[LiveSessionContext] New participant joined via WebRTC:', participant);
      handleNewParticipant(participant);
    },
    onParticipantLeft: (participantId) => {
      handleParticipantLeft(participantId);
    }
  });

  const handleNewParticipant = useCallback((newParticipant: Participant) => {
    console.log('[LiveSessionContext] Adding new participant:', newParticipant);
    messageReceivedRef.current = true;
    
    // Always set new participants to be visible by default
    setVisibleParticipants(prev => new Set([...prev, newParticipant.id]));
    
    setParticipants(prev => {
      const exists = prev.some(p => p.id === newParticipant.id);
      if (exists) {
        return prev.map(p => p.id === newParticipant.id 
          ? { ...p, stream: newParticipant.stream || p.stream, name: newParticipant.name || p.name } 
          : p);
      } else {
        return [...prev, newParticipant];
      }
    });
    
    if (selectedParticipants.length < maxParticipants) {
      setSelectedParticipants(prev => {
        const exists = prev.some(p => p.id === newParticipant.id);
        if (exists) {
          return prev.map(p => p.id === newParticipant.id 
            ? { ...p, stream: newParticipant.stream || p.stream, name: newParticipant.name || p.name } 
            : p);
        } else {
          return [...prev, newParticipant];
        }
      });
    } else {
      setWaitingList(prev => {
        const exists = prev.some(p => p.id === newParticipant.id);
        if (exists) return prev;
        return [...prev, newParticipant];
      });
    }
    
    if (isLive && broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.postMessage({
        type: 'PARTICIPANT_JOINED',
        participantData: {
          ...newParticipant,
          isVisible: true
        }
      }, '*');
    }
  }, [isLive, broadcastWindow, selectedParticipants.length, maxParticipants]);

  const handleParticipantLeft = useCallback((participantId: string) => {
    console.log('[LiveSessionContext] Participant left:', participantId);
    
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    setSelectedParticipants(prev => prev.filter(p => p.id !== participantId));
    setVisibleParticipants(prev => {
      const newSet = new Set(prev);
      newSet.delete(participantId);
      return newSet;
    });
    
    if (waitingList.length > 0) {
      const nextParticipant = waitingList[0];
      setWaitingList(prev => prev.slice(1));
      setParticipants(prev => [...prev, nextParticipant]);
      setSelectedParticipants(prev => [...prev, nextParticipant]);
      setVisibleParticipants(prev => new Set([...prev, nextParticipant.id]));
    }
    
    if (isLive && broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.postMessage({
        type: 'PARTICIPANT_LEFT',
        participantId
      }, '*');
    }
  }, [isLive, broadcastWindow, waitingList]);
  
  const generateSessionId = useCallback(async () => {
    const newId = Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    
    try {
      const url = `${window.location.origin}/live/join/${newId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(url);
      setQrCodeImage(qrCodeDataUrl);
      toast({
        description: "QR Code gerado com sucesso!",
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o QR code",
        variant: "destructive"
      });
    }
  }, [toast]);
  
  const selectParticipant = useCallback((id: string) => {
    const participant = participants.find(p => p.id === id) || waitingList.find(p => p.id === id);
    if (!participant) return;
    
    console.log('[LiveSessionContext] Selecting participant:', participant);
    
    if (selectedParticipants.length < maxParticipants) {
      setSelectedParticipants(prev => {
        if (prev.some(p => p.id === id)) return prev;
        return [...prev, participant];
      });
      
      // Make sure the participant is marked as visible
      setVisibleParticipants(prev => new Set([...prev, id]));
      
      if (waitingList.some(p => p.id === id)) {
        setWaitingList(prev => prev.filter(p => p.id !== id));
        setParticipants(prev => [...prev, participant]);
      }
      
      if (isLive && broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.postMessage({
          type: 'PARTICIPANT_JOINED',
          participantData: {
            ...participant,
            isVisible: true
          }
        }, '*');
      }
    } else {
      toast({
        description: `O layout atual suporta apenas ${maxParticipants} participantes`
      });
    }
  }, [participants, waitingList, selectedParticipants.length, maxParticipants, isLive, broadcastWindow, toast]);
  
  const removeParticipant = useCallback((id: string) => {
    console.log('[LiveSessionContext] Removing participant from selection:', id);
    
    setSelectedParticipants(prev => prev.filter(p => p.id !== id));
    setVisibleParticipants(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    if (isLive && broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.postMessage({
        type: 'PARTICIPANT_VISIBILITY_CHANGED',
        participantId: id,
        isVisible: false
      }, '*');
    }
  }, [isLive, broadcastWindow]);
  
  const toggleParticipantVisibility = useCallback((id: string) => {
    console.log('[LiveSessionContext] Toggling participant visibility:', id);
    
    const isCurrentlyVisible = visibleParticipants.has(id);
    console.log(`[LiveSessionContext] Participant ${id} is currently ${isCurrentlyVisible ? 'visible' : 'hidden'}`);
    
    setVisibleParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    
    if (isLive && broadcastWindow && !broadcastWindow.closed) {
      const willBeVisible = !isCurrentlyVisible;
      console.log(`[LiveSessionContext] Setting participant ${id} visibility to ${willBeVisible}`);
      
      broadcastWindow.postMessage({
        type: 'PARTICIPANT_VISIBILITY_CHANGED',
        participantId: id,
        isVisible: willBeVisible
      }, '*');
    }
  }, [isLive, broadcastWindow, visibleParticipants]);
  
  const isParticipantVisible = useCallback((id: string) => {
    return visibleParticipants.has(id);
  }, [visibleParticipants]);
  
  const refreshParticipants = useCallback(() => {
    console.log('[LiveSessionContext] Manually refreshing participants list');
    toast({
      description: "Atualizando lista de participantes...",
    });
    
    if (!messageReceivedRef.current) {
      toast({
        title: "Nenhum participante detectado",
        description: "Verifique se o QR Code foi compartilhado e os participantes estão tentando se conectar.",
      });
    } else {
      // Debug output of current participants state
      console.log('[LiveSessionContext] Current participants:', participants);
      console.log('[LiveSessionContext] Selected participants:', selectedParticipants);
      console.log('[LiveSessionContext] Visible participants:', [...visibleParticipants]);
      
      // Force update the broadcast window with current state
      if (isLive && broadcastWindow && !broadcastWindow.closed) {
        const visibleSelectedParticipants = selectedParticipants.map(p => ({
          ...p,
          isVisible: visibleParticipants.has(p.id)
        }));
        
        console.log('[LiveSessionContext] Refreshing participants in broadcast window');
        
        broadcastWindow.postMessage({
          type: 'BROADCAST_DATA',
          payload: {
            participants: visibleSelectedParticipants,
            layout,
            backgroundColor,
            backgroundImage,
            qrCode: {
              visible: qrCodeVisible,
              image: qrCodeImage,
              position: qrCodePosition,
              size: qrCodeSize
            },
            qrCodeText: {
              text: qrCodeText,
              position: qrCodeTextPosition
            },
            qrCodeFont,
            qrCodeColor
          }
        }, '*');
      }
    }
  }, [
    toast, 
    participants, 
    selectedParticipants, 
    visibleParticipants, 
    isLive, 
    broadcastWindow, 
    layout, 
    backgroundColor, 
    backgroundImage, 
    qrCodeVisible, 
    qrCodeImage, 
    qrCodePosition, 
    qrCodeSize, 
    qrCodeText, 
    qrCodeTextPosition, 
    qrCodeFont, 
    qrCodeColor
  ]);
  
  const showQRCode = useCallback(() => setQrCodeVisible(true), []);
  const hideQRCode = useCallback(() => setQrCodeVisible(false), []);
  
  const setQRCodeText = useCallback((text: string) => {
    setQrCodeTextState(text);
  }, []);
  
  const startBroadcast = useCallback(async () => {
    if (!sessionId) {
      toast({
        title: "Sessão não iniciada",
        description: "Gere um QR Code para iniciar a sessão",
        variant: "destructive"
      });
      return;
    }
    
    const newWindow = window.open(
      `/live/broadcast/${sessionId}`,
      'LiveBroadcast',
      'width=1280,height=720'
    );
    
    if (newWindow) {
      setBroadcastWindow(newWindow);
      setIsLive(true);
      
      const checkWindowClosed = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(checkWindowClosed);
          setIsLive(false);
          setBroadcastWindow(null);
        }
      }, 1000);
      
      const sendBroadcastData = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(sendBroadcastData);
          return;
        }
        
        const visibleSelectedParticipants = selectedParticipants.map(p => ({
          ...p,
          isVisible: visibleParticipants.has(p.id)
        }));
        
        // Convert Set to Array for debugging
        console.log('[LiveSessionContext] Current visible participants IDs:', [...visibleParticipants]);
        console.log('[LiveSessionContext] Sending broadcast data with participants:', visibleSelectedParticipants);
        
        newWindow.postMessage({
          type: 'BROADCAST_DATA',
          payload: {
            participants: visibleSelectedParticipants,
            layout,
            backgroundColor,
            backgroundImage,
            qrCode: {
              visible: qrCodeVisible,
              image: qrCodeImage,
              position: qrCodePosition,
              size: qrCodeSize
            },
            qrCodeText: {
              text: qrCodeText,
              position: qrCodeTextPosition
            },
            qrCodeFont,
            qrCodeColor
          }
        }, '*');
      }, 1000);
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível abrir a janela de transmissão. Verifique se o bloqueador de pop-ups está desativado.",
        variant: "destructive"
      });
    }
  }, [
    sessionId, 
    toast, 
    selectedParticipants, 
    visibleParticipants, 
    layout, 
    backgroundColor, 
    backgroundImage, 
    qrCodeVisible, 
    qrCodeImage, 
    qrCodePosition, 
    qrCodeSize, 
    qrCodeText, 
    qrCodeTextPosition, 
    qrCodeFont, 
    qrCodeColor
  ]);
  
  const stopBroadcast = useCallback(() => {
    if (broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.close();
    }
    setIsLive(false);
    setBroadcastWindow(null);
  }, [broadcastWindow]);
  
  // Clean up broadcast window on unmount
  useEffect(() => {
    return () => {
      if (broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.close();
      }
    };
  }, [broadcastWindow]);
  
  // Handler for incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data) return;
    
    if (event.data.type === 'PARTICIPANT_JOINED') {
      const { participantData, sessionId: incomingSessionId } = event.data;
      
      if (incomingSessionId === sessionId) {
        console.log('[LiveSessionContext] Participant joined from QR code:', participantData);
        messageReceivedRef.current = true;
        
        // Make sure the new participant has isVisible set to true
        const newParticipant: Participant = {
          id: participantData.id,
          name: participantData.name,
          stream: null,
          isVisible: true
        };
        
        handleNewParticipant(newParticipant);
      }
    } else if (event.data.type === 'PARTICIPANT_STREAM') {
      const { participantId, hasStream, sessionId: incomingSessionId } = event.data;
      
      if (incomingSessionId === sessionId && hasStream) {
        console.log('[LiveSessionContext] Participant stream available:', participantId);
        
        // When a stream becomes available, update the participant
        // Note: We're not creating a dummy MediaStream anymore as it was causing issues
        setParticipants(prev => 
          prev.map(p => p.id === participantId ? { ...p, stream: p.stream } : p)
        );
        
        setSelectedParticipants(prev => 
          prev.map(p => p.id === participantId ? { ...p, stream: p.stream } : p)
        );
      }
    } else if (event.data.type === 'PARTICIPANT_LEFT') {
      const { participantId, sessionId: incomingSessionId } = event.data;
      
      if (incomingSessionId === sessionId) {
        console.log('[LiveSessionContext] Participant left:', participantId);
        handleParticipantLeft(participantId);
      }
    } else if (event.data.type === 'PARTICIPANT_NAME_CHANGED') {
      const { participantId, name, sessionId: incomingSessionId } = event.data;
      
      if (incomingSessionId === sessionId) {
        console.log('[LiveSessionContext] Participant name changed:', participantId, name);
        
        // Update participant name in all relevant arrays
        setParticipants(prev => 
          prev.map(p => p.id === participantId ? { ...p, name } : p)
        );
        
        setSelectedParticipants(prev => 
          prev.map(p => p.id === participantId ? { ...p, name } : p)
        );
        
        setWaitingList(prev => 
          prev.map(p => p.id === participantId ? { ...p, name } : p)
        );
        
        // Notify broadcast window of name change
        if (isLive && broadcastWindow && !broadcastWindow.closed) {
          broadcastWindow.postMessage({
            type: 'PARTICIPANT_NAME_CHANGED',
            participantId,
            name
          }, '*');
        }
      }
    } else if (event.data.type === 'BROADCAST_READY') {
      // When broadcast window is ready, send it the current data
      console.log('[LiveSessionContext] Broadcast window is ready');
      
      // Force a refresh of participants to the broadcast window
      refreshParticipants();
    }
  }, [
    sessionId, 
    handleNewParticipant, 
    handleParticipantLeft, 
    isLive, 
    broadcastWindow, 
    refreshParticipants
  ]);
  
  // Set up message event listener
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);
  
  // Create context value object
  const value = {
    sessionId,
    generateSessionId,
    
    participants,
    waitingList,
    selectedParticipants,
    selectParticipant,
    removeParticipant,
    maxParticipants,
    toggleParticipantVisibility,
    isParticipantVisible,
    refreshParticipants,
    
    layout,
    setLayout,
    backgroundColor,
    setBackgroundColor,
    backgroundImage,
    setBackgroundImage,
    
    qrCode: {
      image: qrCodeImage,
      visible: qrCodeVisible,
      position: qrCodePosition,
      size: qrCodeSize
    },
    showQRCode,
    hideQRCode,
    qrCodeText: {
      text: qrCodeText,
      position: qrCodeTextPosition
    },
    setQRCodeText,
    qrCodeFont,
    setQrCodeFont,
    qrCodeColor,
    setQrCodeColor,
    
    callToAction: {
      type: callToActionType,
      image: callToActionImage,
      text: callToActionText,
      link: callToActionLink
    },
    setCallToActionType,
    setCallToActionImage,
    setCallToActionText,
    setCallToActionLink,
    
    isLive,
    startBroadcast,
    stopBroadcast,
    broadcastWindow
  };
  
  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
};

export const useLiveSession = () => {
  const context = useContext(LiveSessionContext);
  if (context === undefined) {
    throw new Error('useLiveSession must be used within a LiveSessionProvider');
  }
  return context;
};
