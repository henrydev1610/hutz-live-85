import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/components/ui/use-toast";
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Phone, PhoneOff, Camera, Loader2 } from 'lucide-react';

const TwilioParticipantPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [participantId] = useState(() => 
    `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const localVideoRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isConnecting,
    participants,
    localVideoTrack,
    error,
    joinRoom,
    leaveRoom,
    attachVideoToElement,
    detachVideoFromElement
  } = useTwilioRoom({
    roomId: sessionId || '',
    participantId: participantId,
    isHost: false
  });

  // Redirect if no session ID
  useEffect(() => {
    if (!sessionId) {
      toast({
        title: "Erro",
        description: "ID da sessão não encontrado",
        variant: "destructive"
      });
      navigate('/');
    }
  }, [sessionId, navigate, toast]);

  // Auto-join room on load
  useEffect(() => {
    if (sessionId && !isConnected && !isConnecting) {
      handleJoinRoom();
    }
  }, [sessionId]);

  // Attach local video to preview
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      attachVideoToElement(localVideoTrack, localVideoRef.current);
      
      return () => {
        if (localVideoTrack) {
          detachVideoFromElement(localVideoTrack);
        }
      };
    }
  }, [localVideoTrack, attachVideoToElement, detachVideoFromElement]);

  const handleJoinRoom = async () => {
    try {
      await joinRoom();
      toast({
        title: "Conectado",
        description: "Você foi conectado à sessão de vídeo"
      });
    } catch (err) {
      toast({
        title: "Erro de conexão",
        description: "Falha ao conectar à sessão",
        variant: "destructive"
      });
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
      toast({
        title: "Desconectado",
        description: "Você foi desconectado da sessão"
      });
      navigate('/');
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao desconectar",
        variant: "destructive"
      });
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      if (videoEnabled) {
        localVideoTrack.disable();
      } else {
        localVideoTrack.enable();
      }
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = () => {
    // Note: This would need audio track implementation
    setAudioEnabled(!audioEnabled);
    toast({
      title: audioEnabled ? "Microfone desligado" : "Microfone ligado",
      description: `Áudio ${audioEnabled ? 'desabilitado' : 'habilitado'}`
    });
  };

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro",
        description: error,
        variant: "destructive"
      });
    }
  }, [error, toast]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-destructive mb-2">Erro</h1>
            <p>Sessão não encontrada</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Participante - Twilio Live
          </h1>
          <div className="flex items-center justify-center gap-4">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              Sala: {sessionId}
            </Badge>
          </div>
        </div>

        {/* Connection Status */}
        {isConnecting && (
          <Card className="mb-6">
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Conectando à sessão de vídeo...</p>
            </CardContent>
          </Card>
        )}

        {/* Local Video Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Sua Câmera</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
              {localVideoTrack ? (
                <div ref={localVideoRef} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Inicializando câmera...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleVideo}
                variant={videoEnabled ? "default" : "destructive"}
                disabled={!localVideoTrack}
              >
                {videoEnabled ? <Video className="w-4 h-4 mr-2" /> : <VideoOff className="w-4 h-4 mr-2" />}
                {videoEnabled ? "Desligar Vídeo" : "Ligar Vídeo"}
              </Button>

              <Button
                onClick={toggleAudio}
                variant={audioEnabled ? "default" : "destructive"}
              >
                {audioEnabled ? <Phone className="w-4 h-4 mr-2" /> : <PhoneOff className="w-4 h-4 mr-2" />}
                {audioEnabled ? "Desligar Áudio" : "Ligar Áudio"}
              </Button>

              <Button
                onClick={handleLeaveRoom}
                variant="outline"
                disabled={!isConnected}
              >
                Sair da Sessão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status and Info */}
        <Card>
          <CardHeader>
            <CardTitle>Status da Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Participantes conectados:</span>
                <Badge>{participants.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Status da câmera:</span>
                <Badge variant={localVideoTrack ? "default" : "secondary"}>
                  {localVideoTrack ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Vídeo transmitindo:</span>
                <Badge variant={videoEnabled ? "default" : "secondary"}>
                  {videoEnabled ? "Sim" : "Não"}
                </Badge>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive font-medium">Erro:</p>
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Instruções</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Sua câmera será iniciada automaticamente</li>
              <li>O vídeo será transmitido para a sessão principal</li>
              <li>Use os controles para ligar/desligar vídeo e áudio</li>
              <li>Sua transmissão aparecerá na tela do host</li>
              <li>Clique em "Sair da Sessão" quando terminar</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TwilioParticipantPage;