import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { VideoIcon, MicIcon, MicOffIcon, VideoOffIcon, Users, Smartphone, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';

const ParticipantPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [participantName, setParticipantName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  // Verificação de dispositivo móvel
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });

  // Hook do Twilio - só inicializa se tiver sessionId
  const roomName = sessionId || '';
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
  } = useTwilioRoom({ 
    roomName, 
    participantName: participantName || `Participant-${Date.now()}` 
  });

  // Auto-detectar nome do participante
  useEffect(() => {
    if (!participantName) {
      const urlParams = new URLSearchParams(window.location.search);
      const nameFromUrl = urlParams.get('name');
      if (nameFromUrl) {
        setParticipantName(nameFromUrl);
      } else {
        setParticipantName(`Participante-${Date.now()}`);
      }
    }
  }, [participantName]);

  // Auto-join se for acesso via QR
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isQRAccess = urlParams.has('qr') || urlParams.get('mobile') === 'true';
    
    if (isQRAccess && isValidated && !isBlocked && participantName && sessionId && !hasJoined) {
      console.log('📱 PARTICIPANT: Auto-joining via QR access');
      setHasJoined(true);
      handleJoinRoom();
    }
  }, [isValidated, isBlocked, participantName, sessionId, hasJoined]);

  const handleJoinRoom = async () => {
    if (!participantName.trim()) {
      toast.error('Por favor, digite seu nome');
      return;
    }

    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    console.log('🚀 PARTICIPANT: Joining Twilio room:', roomName);
    setHasJoined(true);
    
    try {
      await connectToRoom();
      toast.success(`Conectado à sala ${roomName}!`);
    } catch (error) {
      console.error('❌ PARTICIPANT: Failed to join room:', error);
      toast.error('Falha ao entrar na sala');
      setHasJoined(false);
    }
  };

  const handleLeaveRoom = () => {
    disconnectFromRoom();
    navigate('/');
    toast.info('Você saiu da sala');
  };

  // Loading screen durante validação
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>🔒 Validando acesso móvel...</p>
          <p className="text-sm opacity-75 mt-2">Verificando dispositivo</p>
        </div>
      </div>
    );
  }

  // Tela de bloqueio para dispositivos não móveis
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">📱🚫</div>
          <h1 className="text-2xl font-bold mb-4">Acesso Exclusivo Móvel</h1>
          <p className="text-lg mb-6">Esta página requer um dispositivo móvel para funcionar.</p>
          <p className="text-sm opacity-75 mb-4">
            Escaneie o QR Code com seu <strong>celular</strong> para acessar.
          </p>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-yellow-200 text-xs">
              💡 A câmera do PC não é compatível com esta funcionalidade
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Tela de entrada (nome do participante)
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white/10 border-white/20 text-white">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Smartphone className="w-12 h-12 text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Momento Live</CardTitle>
            <p className="text-blue-200">Sala: {roomName}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Seu nome:</label>
              <Input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Digite seu nome"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            </div>
            
            <div className="flex items-center gap-2 text-green-300 text-sm">
              <Wifi className="w-4 h-4" />
              <span>Dispositivo móvel detectado</span>
            </div>
            
            <Button 
              onClick={handleJoinRoom}
              className="w-full"
              size="lg"
              disabled={!participantName.trim() || isConnecting}
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Conectando...
                </>
              ) : (
                <>
                  <VideoIcon className="w-5 h-5 mr-2" />
                  Entrar na Sala
                </>
              )}
            </Button>

            {connectionError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-200 text-sm">❌ {connectionError}</p>
                <Button 
                  onClick={handleJoinRoom}
                  variant="outline" 
                  size="sm"
                  className="mt-2 bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20"
                >
                  Tentar Novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Interface principal da sala
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Momento Live</h1>
              <p className="text-blue-200">Sala: {roomName}</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"} className="text-sm">
                {isConnected ? "🟢 Conectado" : "🔴 Desconectado"}
              </Badge>
              
              <div className="flex items-center gap-2 text-white">
                <Users className="w-4 h-4" />
                <span>{participants.length + 1}</span>
              </div>
            </div>
          </div>

          {/* Connection Error */}
          {connectionError && (
            <Card className="bg-red-500/10 border-red-500/20 text-red-200 mb-4">
              <CardContent className="pt-4">
                <p className="text-sm">❌ Erro de conexão: {connectionError}</p>
                <Button 
                  onClick={handleJoinRoom}
                  variant="outline" 
                  size="sm"
                  className="mt-2 bg-red-500/10 border-red-500/20 text-red-200 hover:bg-red-500/20"
                >
                  Reconectar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Controls */}
        <div className="mb-6">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={toggleVideo}
                  variant={localVideoTrack && localVideoTrack.isEnabled ? "default" : "secondary"}
                  size="sm"
                  disabled={!isConnected}
                >
                  {localVideoTrack && localVideoTrack.isEnabled ? (
                    <VideoIcon className="w-4 h-4 mr-2" />
                  ) : (
                    <VideoOffIcon className="w-4 h-4 mr-2" />
                  )}
                  {localVideoTrack && localVideoTrack.isEnabled ? 'Vídeo' : 'Sem Vídeo'}
                </Button>

                <Button
                  onClick={toggleAudio}
                  variant={localAudioTrack && localAudioTrack.isEnabled ? "default" : "secondary"}
                  size="sm"
                  disabled={!isConnected}
                >
                  {localAudioTrack && localAudioTrack.isEnabled ? (
                    <MicIcon className="w-4 h-4 mr-2" />
                  ) : (
                    <MicOffIcon className="w-4 h-4 mr-2" />
                  )}
                  {localAudioTrack && localAudioTrack.isEnabled ? 'Áudio' : 'Mudo'}
                </Button>

                <Button
                  onClick={handleLeaveRoom}
                  variant="destructive"
                  size="sm"
                >
                  Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Video */}
          <div className="relative">
            <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs z-10">
              Você ({participantName})
            </div>
            <TwilioVideoContainer
              participant={{
                sid: 'local',
                identity: participantName,
                videoTracks: localVideoTrack ? new Map([['local', localVideoTrack as any]]) : new Map(),
                audioTracks: localAudioTrack ? new Map([['local', localAudioTrack as any]]) : new Map()
              }}
              isLocal={true}
              className="h-64 md:h-80"
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
                className="h-64 md:h-80"
              />
            </div>
          ))}

          {/* Host if no participants */}
          {participants.length === 0 && (
            <div className="h-64 md:h-80 bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Aguardando host...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParticipantPage;