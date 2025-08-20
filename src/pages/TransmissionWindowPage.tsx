import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Participant } from '@/components/live/ParticipantGrid';
import ParticipantPreviewGrid from '@/components/live/ParticipantPreviewGrid';
import QRCodeOverlay from '@/components/live/QRCodeOverlay';
import LiveIndicator from '@/components/live/LiveIndicator';

const TransmissionWindowPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Inicializando janela de transmissão...');
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  
  // States para replicar a interface do LivePreview
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [participantCount, setParticipantCount] = useState(4);
  
  // States para QR Code
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [qrCodePosition, setQrCodePosition] = useState({ x: 20, y: 20, width: 150, height: 150 });
  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({ x: 20, y: 180, width: 200, height: 50 });
  const [qrCodeDescription, setQrCodeDescription] = useState('');
  const [selectedFont, setSelectedFont] = useState('Arial');
  const [selectedTextColor, setSelectedTextColor] = useState('#FFFFFF');
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(16);
  
  // States para background
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState('#000000');

  const updateDebug = (message: string) => {
    console.log(`[TransmissionWindow] ${message}`);
    setDebugMessages(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateStatus = (message: string) => {
    setStatus(message);
    updateDebug(message);
  };

  const getStreamFromHost = async (participantId: string): Promise<MediaStream | null> => {
    try {
      if (window.opener && typeof window.opener.getParticipantStream === 'function') {
        updateDebug(`Solicitando stream para participante: ${participantId}`);
        const stream = await window.opener.getParticipantStream(participantId);
        if (stream && stream.getTracks && stream.getTracks().length > 0) {
          updateDebug(`Stream recebido com ${stream.getTracks().length} tracks`);
          return stream;
        }
      }
      updateDebug(`Falha ao obter stream para participante: ${participantId}`);
      return null;
    } catch (error) {
      updateDebug(`Erro ao obter stream: ${error}`);
      return null;
    }
  };

  useEffect(() => {
    const initializePopup = () => {
      updateStatus('Janela de transmissão pronta');
      if (window.opener) {
        window.opener.postMessage({ type: 'transmission-ready' }, '*');
        updateDebug('Mensagem transmission-ready enviada para janela host');
      }
    };

  const handleMessage = async (event: MessageEvent) => {
      updateDebug(`Mensagem recebida: ${event.data.type}`);
      
      if (event.data.type === 'participant-stream-ready') {
        const { participantId } = event.data;
        updateDebug(`Processando stream para participante: ${participantId}`);
        
        const stream = await getStreamFromHost(participantId);
        if (stream) {
          // Atualizar o stream nos states
          setParticipantStreams(prev => ({
            ...prev,
            [participantId]: stream
          }));
          updateStatus(`Stream carregado para: ${participantId}`);
        } else {
          updateStatus(`Falha ao carregar stream para: ${participantId}`);
        }
      }
      
      // Novos handlers para replicar interface do LivePreview
      if (event.data.type === 'update-participants') {
        const { participants } = event.data;
        updateDebug(`Atualizando ${participants?.length || 0} participantes`);
        setParticipantList(participants || []);
      }
      
      if (event.data.type === 'update-qr-positions') {
        const { 
          qrCodeVisible: visible, 
          qrCodeSvg: svg, 
          qrCodePosition: pos, 
          qrDescriptionPosition: descPos,
          qrCodeDescription: desc,
          selectedFont: font,
          selectedTextColor: textColor,
          qrDescriptionFontSize: fontSize 
        } = event.data;
        
        updateDebug('Atualizando configurações de QR Code');
        setQrCodeVisible(visible);
        setQrCodeSvg(svg);
        setQrCodePosition(pos);
        setQrDescriptionPosition(descPos);
        setQrCodeDescription(desc);
        setSelectedFont(font);
        setSelectedTextColor(textColor);
        setQrDescriptionFontSize(fontSize);
      }
      
      if (event.data.type === 'transmission-ready') {
        updateStatus('Host confirmou - pronto para transmissão');
      }
    };

    window.addEventListener('message', handleMessage);
    initializePopup();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="min-h-screen h-screen bg-black overflow-hidden">
      {/* Interface principal - tela cheia idêntica à foto */}
      <div className="relative w-full h-full bg-black live-transmission-window">
        {/* Grid de participantes - 2x2 com 4 slots fixos */}
        <ParticipantPreviewGrid 
          participantList={participantList}
          participantCount={4}
          participantStreams={participantStreams}
        />
        
        {/* Indicador AO VIVO no canto superior direito */}
        <LiveIndicator />
        
        {/* Mensagem de QR Code no canto inferior direito */}
        <div className="absolute bottom-6 right-6 z-50">
          <p className="text-white/70 text-sm font-medium">
            QR Code gerado com sucesso. Compartilhe com os participantes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransmissionWindowPage;