import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const TransmissionWindowPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('Inicializando janela de transmissão...');
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const assignStreamToVideo = (participantId: string, stream: MediaStream) => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    updateDebug(`Atribuindo stream ao elemento de vídeo para: ${participantId}`);
    
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;
    
    videoElement.onloadedmetadata = () => {
      updateDebug(`Metadata do vídeo carregada para: ${participantId}`);
      videoElement.play().catch(e => updateDebug(`Erro ao reproduzir vídeo: ${e.message}`));
    };
    
    videoElement.onplay = () => updateStatus(`Transmitindo: ${participantId}`);
    videoElement.onerror = (e) => updateDebug(`Erro no elemento de vídeo: ${e}`);
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
          assignStreamToVideo(participantId, stream);
        } else {
          updateStatus(`Falha ao carregar stream para: ${participantId}`);
        }
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Janela de Transmissão - Hutz Live
          </h1>
          <p className="text-muted-foreground">Sessão: {searchParams.get('sessionId')}</p>
        </div>

        {/* Status */}
        <div className="bg-card p-4 rounded-lg border text-center">
          <p className="text-lg font-medium text-foreground">{status}</p>
        </div>

        {/* Video Container */}
        <div className="bg-muted rounded-lg p-8 flex items-center justify-center" style={{ minHeight: '400px' }}>
          <video
            ref={videoRef}
            className="max-w-full max-h-full rounded-lg shadow-lg"
            style={{ maxHeight: '400px', width: 'auto' }}
            playsInline
            muted
            autoPlay
          />
        </div>

        {/* Debug Panel */}
        <div className="bg-card p-4 rounded-lg border">
          <h3 className="font-medium text-foreground mb-2">Debug Log</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {debugMessages.map((msg, index) => (
              <p key={index} className="text-xs text-muted-foreground font-mono">
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