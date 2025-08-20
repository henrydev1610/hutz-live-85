import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Participant } from '@/components/live/ParticipantGrid';
import ParticipantPreviewGrid from '@/components/live/ParticipantPreviewGrid';
import QRCodeOverlay from '@/components/live/QRCodeOverlay';
import LiveIndicator from '@/components/live/LiveIndicator';
import { useTransmissionVideoManager } from '@/hooks/live/useTransmissionVideoManager';

const TransmissionWindowPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Inicializando janela de transmissão...');
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  
  // States para replicar a interface do LivePreview
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [participantCount, setParticipantCount] = useState(2); // Valor dinâmico baseado no host
  
  // Hook para gerenciar vídeos na transmissão
  const { createVideoForStream } = useTransmissionVideoManager({ 
    participantStreams, 
    setParticipantStreams 
  });
  
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

  const getStreamFromHost = async (participantId: string, retryCount = 0): Promise<MediaStream | null> => {
    const maxRetries = 3;
    
    try {
      updateDebug(`🎯 TRANSMISSION: Solicitando stream para participante: ${participantId} (tentativa ${retryCount + 1}/${maxRetries + 1})`);
      
      if (!window.opener) {
        updateDebug(`❌ TRANSMISSION: window.opener não disponível`);
        return null;
      }

      // Verificar se a função existe no host com retry
      if (typeof window.opener.getParticipantStream !== 'function') {
        updateDebug(`❌ TRANSMISSION: window.opener.getParticipantStream não é função - tipo: ${typeof window.opener.getParticipantStream}`);
        
        // Se é a primeira tentativa, aguardar um pouco e tentar novamente
        if (retryCount < maxRetries) {
          updateDebug(`🔄 TRANSMISSION: Aguardando host estar pronto... retry ${retryCount + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return getStreamFromHost(participantId, retryCount + 1);
        }
        return null;
      }

      updateDebug(`✅ TRANSMISSION: Chamando window.opener.getParticipantStream('${participantId}')`);
      const stream = await window.opener.getParticipantStream(participantId);
      
      if (!stream) {
        updateDebug(`⚠️ TRANSMISSION: Stream null/undefined retornado para ${participantId}`);
        
        // Tentar fallback direto no global map
        if (window.opener.__mlStreams__) {
          const fallbackStream = window.opener.__mlStreams__.get(participantId);
          if (fallbackStream) {
            updateDebug(`🔄 TRANSMISSION: Fallback - encontrado stream no global map para ${participantId}`);
            return fallbackStream;
          }
        }
        
        // Se não encontrou e ainda há tentativas, retry
        if (retryCount < maxRetries) {
          updateDebug(`🔄 TRANSMISSION: Stream não encontrado, retry em 800ms... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 800));
          return getStreamFromHost(participantId, retryCount + 1);
        }
        
        return null;
      }

      if (!stream.getTracks) {
        updateDebug(`❌ TRANSMISSION: Stream inválido (sem getTracks) para ${participantId}`);
        return null;
      }

      const tracks = stream.getTracks();
      if (tracks.length === 0) {
        updateDebug(`⚠️ TRANSMISSION: Stream sem tracks para ${participantId}`);
        
        // Retry se ainda há tentativas
        if (retryCount < maxRetries) {
          updateDebug(`🔄 TRANSMISSION: Stream sem tracks, retry em 500ms...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return getStreamFromHost(participantId, retryCount + 1);
        }
        return null;
      }

      // Validar se as tracks estão ativas
      const activeTracks = tracks.filter(track => track.readyState === 'live');
      if (activeTracks.length === 0) {
        updateDebug(`⚠️ TRANSMISSION: Todas as tracks estão inativas para ${participantId}`);
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return getStreamFromHost(participantId, retryCount + 1);
        }
        return null;
      }

      updateDebug(`✅ TRANSMISSION: Stream válido recebido para ${participantId} - ${tracks.length} tracks (${activeTracks.length} ativas), active: ${stream.active}`);
      return stream;
      
    } catch (error) {
      updateDebug(`❌ TRANSMISSION: Erro ao obter stream para ${participantId}: ${error}`);
      console.error('TRANSMISSION ERROR:', error);
      
      // Retry em caso de erro
      if (retryCount < maxRetries) {
        updateDebug(`🔄 TRANSMISSION: Erro - retry em 1000ms... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getStreamFromHost(participantId, retryCount + 1);
      }
      
      return null;
    }
  };

  const createVideoInTransmission = async (participantId: string, stream: MediaStream) => {
    try {
      updateDebug(`🎯 TRANSMISSION: Iniciando criação de vídeo para ${participantId}`);
      await createVideoForStream(participantId, stream);
      updateDebug(`✅ TRANSMISSION: Processamento concluído para ${participantId}`);
    } catch (error) {
      updateDebug(`❌ TRANSMISSION: Erro ao processar ${participantId}: ${error}`);
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
        const { participantId, streamInfo } = event.data;
        updateDebug(`🎯 TRANSMISSION: Processando stream para participante: ${participantId}`);
        updateDebug(`🎯 TRANSMISSION: Stream info recebida: ${JSON.stringify(streamInfo)}`);
        
        // Aguardar um pouco mais para garantir que o stream está disponível no host
        setTimeout(async () => {
          const stream = await getStreamFromHost(participantId);
          if (stream) {
            updateDebug(`✅ TRANSMISSION: Stream obtido com sucesso para ${participantId}`);
            
            // Atualizar o stream nos states
            setParticipantStreams(prev => ({
              ...prev,
              [participantId]: stream
            }));
            
            // Criar elementos de vídeo na transmissão
            await createVideoInTransmission(participantId, stream);
            
            updateStatus(`✅ Stream e vídeo criados para: ${participantId}`);
            
            // Confirmar sucesso para o host
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'transmission-stream-success', 
                participantId 
              }, '*');
            }
          } else {
            updateStatus(`❌ Falha ao carregar stream para: ${participantId}`);
            updateDebug(`❌ TRANSMISSION: Stream não disponível para ${participantId} após todas as tentativas`);
            
            // Notificar host sobre falha
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'transmission-stream-failed', 
                participantId 
              }, '*');
            }
          }
        }, 500); // Dar mais tempo para o stream estar disponível no host
      }
      
      // Novos handlers para replicar interface do LivePreview
      if (event.data.type === 'update-participants') {
        const { participants } = event.data;
        updateDebug(`Atualizando ${participants?.length || 0} participantes`);
        setParticipantList(participants || []);
      }
      
      if (event.data.type === 'update-qr-positions') {
        updateDebug(`Recebendo configurações QR: visible=${event.data.qrCodeVisible}, svg=${!!event.data.qrCodeSvg}, bg=${event.data.selectedBackgroundColor}`);
        
        const { 
          qrCodeVisible: visible, 
          qrCodeSvg: svg, 
          qrCodePosition: pos, 
          qrDescriptionPosition: descPos,
          qrCodeDescription: desc,
          selectedFont: font,
          selectedTextColor: textColor,
          qrDescriptionFontSize: fontSize,
          backgroundImage: bgImage,
          selectedBackgroundColor: bgColor,
          participantCount: newParticipantCount
        } = event.data;
        
        updateDebug('Aplicando configurações de QR Code e background');
        console.log('🎨 QR CONFIG:', { visible, svg: !!svg, bgColor, bgImage: !!bgImage, desc, participantCount: newParticipantCount });
        
        setQrCodeVisible(visible || false);
        setQrCodeSvg(svg || null);
        if (pos) setQrCodePosition(pos);
        if (descPos) setQrDescriptionPosition(descPos);
        setQrCodeDescription(desc || '');
        setSelectedFont(font || 'Arial');
        setSelectedTextColor(textColor || '#FFFFFF');
        setQrDescriptionFontSize(fontSize || 16);
        
        // Aplicar participantCount se fornecido
        if (newParticipantCount !== undefined) {
          setParticipantCount(newParticipantCount);
          updateDebug(`Participant count atualizado: ${newParticipantCount}`);
        }
        
        // Aplicar configurações de background
        if (bgImage !== undefined) {
          setBackgroundImage(bgImage);
          updateDebug(`Background image ${bgImage ? 'aplicada' : 'removida'}`);
        }
        if (bgColor) {
          setSelectedBackgroundColor(bgColor);
          updateDebug(`Background color aplicada: ${bgColor}`);
        }
      }
      
      if (event.data.type === 'transmission-ready') {
        updateStatus('Host confirmou - pronto para transmissão');
      }
    };

    window.addEventListener('message', handleMessage);
    initializePopup();
    
    // Solicitar configurações iniciais do host imediatamente
    const requestInitialConfig = () => {
      if (window.opener) {
        updateDebug('Solicitando configurações QR do host');
        window.opener.postMessage({ type: 'request-initial-config' }, '*');
      }
    };
    
    // Solicitar múltiplas vezes para garantir que chegue
    setTimeout(requestInitialConfig, 500);
    setTimeout(requestInitialConfig, 1500);
    setTimeout(requestInitialConfig, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="min-h-screen h-screen bg-black overflow-hidden">
      {/* Interface principal - tela cheia idêntica à foto */}
      <div className="relative w-full h-full bg-black live-transmission-window">
        {/* Container com background color ou imagem */}
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundColor: selectedBackgroundColor || '#000000'
          }}
        >
          {backgroundImage && (
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Grid de participantes - quantidade dinâmica baseada na configuração */}
        <ParticipantPreviewGrid 
          participantList={participantList}
          participantCount={participantCount}
          participantStreams={participantStreams}
        />
        
        {/* QR Code overlay - sempre renderizar para debug */}
        <div className="absolute inset-0 pointer-events-none z-40">
          <QRCodeOverlay
            qrCodeVisible={true} // Forçar visível para debug
            qrCodeSvg={qrCodeSvg}
            qrCodePosition={qrCodePosition}
            setQrCodePosition={setQrCodePosition}
            qrDescriptionPosition={qrDescriptionPosition}
            setQrDescriptionPosition={setQrDescriptionPosition}
            qrCodeDescription={qrCodeDescription || "Escaneie o QR Code para participar"}
            selectedFont={selectedFont}
            selectedTextColor={selectedTextColor}
            qrDescriptionFontSize={qrDescriptionFontSize}
          />
        </div>
        
        {/* Indicador AO VIVO no canto superior direito */}
        <LiveIndicator />
        
        
        {/* Mensagem de QR Code no canto inferior direito - sempre visível */}
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