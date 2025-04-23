import { createContext, useContext, useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useToast } from '@/hooks/use-toast';
import { Participant } from '@/types/live';

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
  setQRCodeFont: (font: string) => void;
  qrCodeColor: string;
  setQRCodeColor: (color: string) => void;
  
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
  
  // QR Code state
  const [qrCodeImage, setQrCodeImage] = useState<string>('');
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodePosition, setQrCodePosition] = useState({ x: 30, y: 30 });
  const [qrCodeSize, setQrCodeSize] = useState(150);
  const [qrCodeText, setQrCodeTextState] = useState('Escaneie para participar!');
  const [qrCodeTextPosition, setQrCodeTextPosition] = useState({ x: 30, y: 200 });
  const [qrCodeFont, setQrCodeFont] = useState('Arial');
  const [qrCodeColor, setQrCodeColor] = useState('#FFFFFF');
  
  // Call to Action state
  const [callToActionType, setCallToActionType] = useState<'image' | 'coupon'>('image');
  const [callToActionImage, setCallToActionImage] = useState<string | null>(null);
  const [callToActionText, setCallToActionText] = useState<string | null>(null);
  const [callToActionLink, setCallToActionLink] = useState<string | null>(null);
  
  // Generate a unique session ID and QR code
  const generateSessionId = async () => {
    const newId = Math.random().toString(36).substring(2, 15);
    setSessionId(newId);
    
    try {
      // Generate QR code for the session
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
  
  // Participant selection
  const selectParticipant = (id: string) => {
    const participant = [...participants, ...waitingList].find(p => p.id === id);
    if (!participant) return;
    
    if (selectedParticipants.length < layout) {
      setSelectedParticipants(prev => [...prev, participant]);
      
      // If participant is in waiting list, move to participants
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
    
    // If there are participants in the waiting list, move one to the participants list
    if (waitingList.length > 0) {
      const nextParticipant = waitingList[0];
      setWaitingList(prev => prev.slice(1));
      setParticipants(prev => [...prev, nextParticipant]);
    }
  };
  
  // QR Code management
  const showQRCode = () => setQrCodeVisible(true);
  const hideQRCode = () => setQrCodeVisible(false);
  
  const setQRCodeText = (text: string) => {
    setQrCodeTextState(text);
  };
  
  // Broadcast management
  const startBroadcast = () => {
    if (!sessionId) {
      toast({
        title: "Sessão não iniciada",
        description: "Gere um QR Code para iniciar a sessão",
        variant: "destructive"
      });
      return;
    }
    
    // Open a new window for the broadcast
    const newWindow = window.open(
      `/live/broadcast/${sessionId}`,
      'LiveBroadcast',
      'width=1280,height=720'
    );
    
    if (newWindow) {
      setBroadcastWindow(newWindow);
      setIsLive(true);
      
      // Monitor if window is closed
      const checkWindowClosed = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(checkWindowClosed);
          setIsLive(false);
          setBroadcastWindow(null);
        }
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
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.close();
      }
    };
  }, [broadcastWindow]);
  
  // Initialize mock data for demonstration
  useEffect(() => {
    // This would be replaced with actual WebRTC connections in a real implementation
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
  
  const value = {
    // Session
    sessionId,
    generateSessionId,
    
    // Participants
    participants,
    waitingList,
    selectedParticipants,
    selectParticipant,
    removeParticipant,
    maxParticipants,
    
    // Layout
    layout,
    setLayout,
    backgroundColor,
    setBackgroundColor,
    backgroundImage,
    setBackgroundImage,
    
    // QR Code
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
    
    // Call to Action
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
    
    // Broadcast
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
