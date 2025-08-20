
// FASE 1: Integrar hooks no LivePage
import { useState, useRef, useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { generateSessionId } from '@/utils/sessionUtils';
import { useWebRTCInitialization } from './useWebRTCInitialization';

export const useLivePageState = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState("#000000");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [finalAction, setFinalAction] = useState<'none' | 'image' | 'coupon'>('none');
  const [finalActionLink, setFinalActionLink] = useState("");
  const [finalActionImage, setFinalActionImage] = useState<string | null>(null);
  const [finalActionCoupon, setFinalActionCouponCode] = useState("");
  
  const [selectedFont, setSelectedFont] = useState("sans-serif");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(16);
  const [qrCodeDescription, setQrCodeDescription] = useState("Escaneie o QR Code para participar");
  
  const [transmissionOpen, setTransmissionOpen] = useState(false);
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const [finalActionTimerId, setFinalActionTimerId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Debug para monitorar mudanças no estado transmissionOpen
  useEffect(() => {
    console.log('🎯 ESTADO TRANSMISSÃO MUDOU:', { transmissionOpen, timestamp: new Date().toISOString() });
  }, [transmissionOpen]);

  // FASE 1: Usar hook de inicialização WebRTC com diagnóstico TURN
  const webrtcInit = useWebRTCInitialization({
    sessionId: sessionId || '',
    isHost: true,
    autoInit: !!sessionId
  });

  // 🚀 CORREÇÃO CRÍTICA: Gerar sessionId automaticamente na inicialização
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = generateSessionId();
      console.log('🚀 Gerando novo sessionId:', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  // Remover inicialização manual do WebRTC - agora é automática via hook
  // useEffect(() => {
  //   if (sessionId) {
  //     console.log('🚀 Iniciando WebRTC com sessionId:', sessionId);
  //     initHostWebRTC(sessionId);
  //   }
  // }, [sessionId]);

  
  const [qrCodePosition, setQrCodePosition] = useState({ 
    x: 20, 
    y: 20, 
    width: 80, 
    height: 80 
  });

  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({
    x: 20,
    y: 110,
    width: 200,
    height: 60
  });
  
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [localStream, setLocalMediaStream] = useState<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  return {
    participantCount, setParticipantCount,
    qrCodeURL, setQrCodeURL,
    qrCodeVisible, setQrCodeVisible,
    qrCodeSvg, setQrCodeSvg,
    participantList, setParticipantList,
    selectedBackgroundColor, setSelectedBackgroundColor,
    backgroundImage, setBackgroundImage,
    finalAction, setFinalAction,
    finalActionLink, setFinalActionLink,
    finalActionImage, setFinalActionImage,
    finalActionCoupon, setFinalActionCouponCode,
    selectedFont, setSelectedFont,
    selectedTextColor, setSelectedTextColor,
    qrDescriptionFontSize, setQrDescriptionFontSize,
    qrCodeDescription, setQrCodeDescription,
    transmissionOpen, setTransmissionOpen,
    finalActionOpen, setFinalActionOpen,
    finalActionTimeLeft, setFinalActionTimeLeft,
    finalActionTimerId, setFinalActionTimerId,
    sessionId, setSessionId,
    qrCodePosition, setQrCodePosition,
    qrDescriptionPosition, setQrDescriptionPosition,
    participantStreams, setParticipantStreams,
    localStream, setLocalMediaStream,
    fileInputRef,
    // FASE 1: Expor estado da inicialização WebRTC
    webrtcInit
  };
};
