import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoIcon, MicIcon, MicOffIcon, VideoOffIcon, Users, QrCode, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateRoomCode } from '@/utils/sessionUtils';

const LivePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Gerar ID único da sala
  const [roomName] = useState(() => generateRoomCode());
  const [hostName] = useState(() => `Host-${Date.now()}`);
  
  // Hook do Twilio
  const {
    isConnected,
    isConnecting,
    participants,
    localVideoTrack,
    localAudioTrack,
    connectionError,
    connectToRoom,
    disconnectFromRoom,
    toggleVideo,
    toggleAudio
  } = useTwilioRoom({ roomName, participantName: hostName });

  const [transmissionWindow, setTransmissionWindow] = useState<Window | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);

  // URLs para participantes
  const participantUrl = `${window.location.origin}/participant/${roomName}`;
  const qrCodeUrl = `${participantUrl}?qr=true&mobile=true`;

  // Conectar automaticamente quando o componente é montado
  useEffect(() => {
    if (!isConnected && !isConnecting && !connectionError) {
      console.log('🚀 HOST: Auto-connecting to Twilio room:', roomName);
      connectToRoom();
    }
  }, []);

  // Abrir janela de transmissão
  const openTransmissionWindow = () => {
    const newWindow = window.open(
      '/transmission',
      'transmission',
      'width=1920,height=1080,resizable=yes,scrollbars=no'
    );
    
    if (newWindow) {
      setTransmissionWindow(newWindow);
      
      // Aguardar janela carregar e enviar dados
      setTimeout(() => {
        if (newWindow && !newWindow.closed) {
          newWindow.postMessage({
            type: 'setup-transmission',
            roomName,
            participants: participants.map(p => ({
              id: p.sid,
              identity: p.identity,
              hasVideo: p.videoTracks.size > 0,
              hasAudio: p.audioTracks.size > 0,
              selected: true
            }))
          }, '*');
        }
      }, 2000);
      
      toast({
        title: "Transmissão iniciada",
        description: "Janela de transmissão aberta com sucesso."
      });
    }
  };

  // Copiar link para participantes
  const copyParticipantLink = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeUrl);
      toast({
        title: "Link copiado!",
        description: "Link para participantes copiado para a área de transferência."
      });
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      });
    }
  };

  // Encerrar transmissão
  const finishTransmission = () => {
    if (transmissionWindow && !transmissionWindow.closed) {
      transmissionWindow.close();
      setTransmissionWindow(null);
    }
    
    disconnectFromRoom();
    navigate('/dashboard');
    
    toast({
      title: "Transmissão encerrada",
      description: "Voltando ao dashboard."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Momento Live</h1>
              <p className="text-blue-200">Powered by Twilio Video</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"} className="text-sm">
                {isConnected ? "🟢 Conectado" : isConnecting ? "🟡 Conectando..." : "🔴 Desconectado"}
              </Badge>
              
              <div className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5" />
                <span>{participants.length} participantes</span>
              </div>
            </div>
          </div>

          {/* Room Info */}
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Sala: {roomName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={copyParticipantLink}
                    variant="outline" 
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Link para Participantes
                  </Button>
                  
                  <Button 
                    onClick={() => setShowQRCode(!showQRCode)}
                    variant="outline" 
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {showQRCode ? 'Ocultar' : 'Mostrar'} QR Code
                  </Button>
                </div>
                
                {showQRCode && (
                  <div className="bg-white p-4 rounded-lg">
                    <div className="text-center text-black text-sm mb-2">
                      Escaneie com o celular para participar
                    </div>
                    <div className="text-center text-xs text-gray-600 break-all">
                      {qrCodeUrl}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Display */}
        {connectionError && (
          <Card className="bg-red-500/10 border-red-500/20 text-red-200 mb-6">
            <CardContent className="pt-6">
              <p className="text-sm">❌ Erro: {connectionError}</p>
              <Button 
                onClick={connectToRoom}
                variant="outline" 
                size="sm"
                className="mt-2 bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20"
              >
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <div className="mb-8">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={toggleVideo}
                  variant={localVideoTrack && localVideoTrack.isEnabled ? "default" : "secondary"}
                  size="lg"
                  disabled={!isConnected}
                >
                  {localVideoTrack && localVideoTrack.isEnabled ? (
                    <VideoIcon className="w-5 h-5 mr-2" />
                  ) : (
                    <VideoOffIcon className="w-5 h-5 mr-2" />
                  )}
                  {localVideoTrack && localVideoTrack.isEnabled ? 'Vídeo Ativo' : 'Vídeo Desligado'}
                </Button>

                <Button
                  onClick={toggleAudio}
                  variant={localAudioTrack && localAudioTrack.isEnabled ? "default" : "secondary"}
                  size="lg"
                  disabled={!isConnected}
                >
                  {localAudioTrack && localAudioTrack.isEnabled ? (
                    <MicIcon className="w-5 h-5 mr-2" />
                  ) : (
                    <MicOffIcon className="w-5 h-5 mr-2" />
                  )}
                  {localAudioTrack && localAudioTrack.isEnabled ? 'Áudio Ativo' : 'Áudio Desligado'}
                </Button>

                <Button
                  onClick={openTransmissionWindow}
                  variant="default"
                  size="lg"
                  disabled={!isConnected}
                >
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Abrir Transmissão
                </Button>

                <Button
                  onClick={finishTransmission}
                  variant="destructive"
                  size="lg"
                >
                  Encerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Local Video */}
          <div className="relative">
            <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs z-10">
              Você (Host)
            </div>
            <TwilioVideoContainer
              participant={{
                sid: 'local',
                identity: hostName,
                videoTracks: localVideoTrack ? new Map([['local', localVideoTrack as any]]) : new Map(),
                audioTracks: localAudioTrack ? new Map([['local', localAudioTrack as any]]) : new Map()
              }}
              isLocal={true}
              className="h-64"
            />
          </div>

          {/* Remote Participants */}
          {participants.map((participant) => (
            <div key={participant.sid} className="relative">
              <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs z-10">
                {participant.identity}
              </div>
              <TwilioVideoContainer
                participant={participant}
                isLocal={false}
                className="h-64"
              />
            </div>
          ))}

          {/* Empty Slots */}
          {Array.from({ length: Math.max(0, 8 - participants.length - 1) }).map((_, index) => (
            <div key={`empty-${index}`} className="h-64 bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Aguardando participante</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LivePage;