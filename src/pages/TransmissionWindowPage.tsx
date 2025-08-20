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
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header fixo */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">
              Transmissão ao Vivo - Hutz Live
            </h1>
            <p className="text-sm text-white/70">Sessão: {searchParams.get('sessionId')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/90">{status}</p>
            <p className="text-xs text-white/60">
              {participantList.filter(p => p.selected).length} participantes selecionados
            </p>
          </div>
        </div>
      </div>

      {/* Interface principal - replicando LivePreview */}
      <div className="pt-24 h-screen">
        <div className="relative w-full h-full bg-black live-transmission-window">
          {/* Container com background */}
          <div className="absolute inset-0" style={{ backgroundColor: selectedBackgroundColor }}>
            {backgroundImage && (
              <img 
                src={backgroundImage} 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            )}
          </div>
          
          {/* Grid de participantes */}
          <ParticipantPreviewGrid 
            participantList={participantList}
            participantCount={participantCount}
            participantStreams={participantStreams}
          />
          
          {/* QR Code overlay */}
          <QRCodeOverlay
            qrCodeVisible={qrCodeVisible}
            qrCodeSvg={qrCodeSvg}
            qrCodePosition={qrCodePosition}
            setQrCodePosition={setQrCodePosition}
            qrDescriptionPosition={qrDescriptionPosition}
            setQrDescriptionPosition={setQrDescriptionPosition}
            qrCodeDescription={qrCodeDescription}
            selectedFont={selectedFont}
            selectedTextColor={selectedTextColor}
            qrDescriptionFontSize={qrDescriptionFontSize}
          />
          
          {/* Live indicator */}
          <LiveIndicator />
        </div>
      </div>

      {/* Debug Panel minimizado */}
      <div className="fixed bottom-4 right-4 z-50 max-w-xs">
        <div className="bg-black/80 backdrop-blur-sm border border-white/20 rounded-lg p-3">
          <div className="text-xs text-white/80 space-y-1 max-h-20 overflow-y-auto">
            {debugMessages.slice(-3).map((msg, index) => (
              <p key={index} className="font-mono break-all">
                {msg}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransmissionWindowPage;