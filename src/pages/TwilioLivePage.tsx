import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useTwilioRoom } from '@/hooks/live/useTwilioRoom';
import { TwilioVideoContainer } from '@/components/live/TwilioVideoContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, Users, Video, VideoOff } from 'lucide-react';

const TwilioLivePage: React.FC = () => {
  const { toast } = useToast();
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [hostId] = useState(() => `host-${Date.now()}`);
  
  const {
    isConnected,
    isConnecting,
    participants,
    localVideoTrack,
    error,
    joinRoom,
    leaveRoom,
    getParticipantVideoTrack
  } = useTwilioRoom({
    roomId: sessionId,
    participantId: hostId,
    isHost: true
  });

  const handleStartSession = async () => {
    try {
      await joinRoom();
      toast({
        title: "Sessão iniciada",
        description: "Sessão de vídeo criada com sucesso. Aguardando participantes..."
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao iniciar sessão de vídeo",
        variant: "destructive"
      });
    }
  };

  const handleEndSession = async () => {
    try {
      await leaveRoom();
      toast({
        title: "Sessão encerrada",
        description: "A sessão de vídeo foi encerrada"
      });
    } catch (err) {
      toast({
        title: "Erro", 
        description: "Falha ao encerrar sessão",
        variant: "destructive"
      });
    }
  };

  const generateParticipantLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/twilio-participant/${sessionId}`;
  };

  const copyParticipantLink = () => {
    const link = generateParticipantLink();
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado",
      description: "Link do participante copiado para área de transferência"
    });
  };

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro de conexão",
        description: error,
        variant: "destructive"
      });
    }
  }, [error, toast]);

  const remoteParticipants = participants.filter(p => !p.isLocal);
  const localParticipant = participants.find(p => p.isLocal);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Hutz Live - Twilio Edition
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Conectado" : "Desconectado"}
            </Badge>
            <Badge variant="outline">
              <Users className="w-4 h-4 mr-1" />
              {participants.length} participante(s)
            </Badge>
            {sessionId && (
              <Badge variant="outline" className="font-mono text-xs">
                Sala: {sessionId}
              </Badge>
            )}
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Controles da Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              {!isConnected ? (
                <Button 
                  onClick={handleStartSession} 
                  disabled={isConnecting}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Video className="w-4 h-4 mr-2" />
                  {isConnecting ? "Conectando..." : "Iniciar Sessão"}
                </Button>
              ) : (
                <Button 
                  onClick={handleEndSession}
                  variant="destructive"
                >
                  <VideoOff className="w-4 h-4 mr-2" />
                  Encerrar Sessão
                </Button>
              )}
              
              {isConnected && (
                <Button onClick={copyParticipantLink} variant="outline">
                  <QrCode className="w-4 h-4 mr-2" />
                  Copiar Link do Participante
                </Button>
              )}
            </div>
            
            {isConnected && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Link para participantes:
                </p>
                <code className="text-xs bg-background p-2 rounded block break-all">
                  {generateParticipantLink()}
                </code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Grid */}
        {isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Local Video (Host) */}
            {localParticipant && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Host (Você)</CardTitle>
                </CardHeader>
                <CardContent>
                  <TwilioVideoContainer
                    track={localVideoTrack}
                    participantName="Host"
                    isLocal={true}
                    className="aspect-video"
                  />
                </CardContent>
              </Card>
            )}

            {/* Remote Participants */}
            {remoteParticipants.map((participant) => {
              const videoTrack = getParticipantVideoTrack(participant.sid);
              
              return (
                <Card key={participant.sid}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{participant.identity}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TwilioVideoContainer
                      track={videoTrack}
                      participantName={participant.identity}
                      isLocal={false}
                      className="aspect-video"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Status */}
        {error && (
          <Card className="mt-6 border-destructive">
            <CardContent className="pt-6">
              <div className="text-destructive">
                <strong>Erro:</strong> {error}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!isConnected && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Como usar o Twilio Live</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Clique em "Iniciar Sessão" para criar uma sala de vídeo</li>
                <li>Copie o link do participante e envie para outros usuários</li>
                <li>Os participantes podem acessar via celular para transmitir vídeo</li>
                <li>O vídeo será exibido automaticamente nesta tela</li>
                <li>Use "Encerrar Sessão" quando terminar</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TwilioLivePage;