import { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  
  const [visibleParticipants, setVisibleParticipants] = useState<Set<string>>(new Set());
  
  const { 
    localStream,
    isConnected,
    initializeHostCamera
  } = useWebRTC({
    sessionId,
    onNewParticipant: (participant) => {
      console.log('New participant joined:', participant);
      handleNewParticipant(participant);
    },
    onParticipantLeft: (participantId) => {
      handleParticipantLeft(participantId);
    }
  });

  const handleNewParticipant = (newParticipant: Participant) => {
    setParticipants(prev => {
      const exists = prev.some(p => p.id === newParticipant.id);
      if (exists) {
        return prev.map(p => p.id === newParticipant.id ? newParticipant : p);
      } else {
        return [...prev, newParticipant];
      }
    });
  };

  const handleParticipantLeft = (participantId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    setSelectedParticipants(prev => prev.filter(p => p.id !== participantId));
    
    if (waitingList.length > 0) {
      const nextParticipant = waitingList[0];
      setWaitingList(prev => prev.slice(1));
      setParticipants(prev => [...prev, nextParticipant]);
    }
  };
  
  const generateSessionId = async () => {
    const newId = Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    
    try {
      const url = `${window.location.origin}/live/join/${newId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(url);
      setQrCodeImage(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o QR code",
        variant: "destructive"
      });
    }
  };
  
  const selectParticipant = (id: string) => {
    const participant = [...participants, ...waitingList].find(p => p.id === id);
    if (!participant) return;
    
    if (selectedParticipants.length < layout) {
      setSelectedParticipants(prev => [...prev, participant]);
      setVisibleParticipants(prev => new Set([...prev, id]));
      
      if (waitingList.some(p => p.id === id)) {
        setWaitingList(prev => prev.filter(p => p.id !== id));
        setParticipants(prev => [...prev, participant]);
      }
    } else {
      toast({
        description: `O layout atual suporta apenas ${layout} participantes`
      });
    }
  };
  
  const removeParticipant = (id: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== id));
    setVisibleParticipants(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    
    if (waitingList.length > 0) {
      const nextParticipant = waitingList[0];
      setWaitingList(prev => prev.slice(1));
      setParticipants(prev => [...prev, nextParticipant]);
    }
  };
  
  const toggleParticipantVisibility = (id: string) => {
    setVisibleParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const isParticipantVisible = (id: string) => {
    return visibleParticipants.has(id);
  };
  
  const showQRCode = () => setQrCodeVisible(true);
  const hideQRCode = () => setQrCodeVisible(false);
  
  const setQRCodeText = (text: string) => {
    setQrCodeTextState(text);
  };
  
  const startBroadcast = async () => {
    if (!sessionId) {
      toast({
        title: "Sessão não iniciada",
        description: "Gere um QR Code para iniciar a sessão",
        variant: "destructive"
      });
      return;
    }
    
    await initializeHostCamera();
    
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
        
        newWindow.postMessage({
          type: 'BROADCAST_DATA',
          payload: {
            participants: selectedParticipants,
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
  };
  
  const stopBroadcast = () => {
    if (broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.close();
    }
    setIsLive(false);
    setBroadcastWindow(null);
  };
  
  useEffect(() => {
    return () => {
      if (broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.close();
      }
    };
  }, [broadcastWindow]);
  
  useEffect(() => {
    const mockParticipants: Participant[] = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `user-${i + 1}`,
        name: `Usuário ${i + 1}`,
        stream: null
      }));
      
    setParticipants(mockParticipants.slice(0, 8));
    setWaitingList(mockParticipants.slice(8));
  }, []);
  
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PARTICIPANT_JOINED') {
        const { participantData, sessionId: incomingSessionId } = event.data;
        
        if (incomingSessionId === sessionId) {
          console.log('Participant joined:', participantData);
          
          const newParticipant: Participant = {
            id: participantData.id,
            name: participantData.name,
            stream: null
          };
          
          if (participants.length < maxParticipants) {
            setParticipants(prev => [...prev, newParticipant]);
          } else {
            setWaitingList(prev => [...prev, newParticipant]);
          }
        }
      } else if (event.data && event.data.type === 'PARTICIPANT_LEFT') {
        const { participantId, sessionId: incomingSessionId } = event.data;
        
        if (incomingSessionId === sessionId) {
          handleParticipantLeft(participantId);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [sessionId, participants, maxParticipants]);
  
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
