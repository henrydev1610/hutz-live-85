
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Settings, Monitor, MonitorOff } from "lucide-react";

interface ParticipantControlsProps {
  hasVideo: boolean;
  hasAudio: boolean;
  hasScreenShare: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: string;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ParticipantControls: React.FC<ParticipantControlsProps> = ({
  hasVideo,
  hasAudio,
  hasScreenShare,
  isVideoEnabled,
  isAudioEnabled,
  isConnected,
  isConnecting,
  connectionStatus,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onConnect,
  onDisconnect
}) => {
  return (
    <Card className="bg-black/30 border-white/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Vídeo - sempre mostrar, mas desabilitar se não disponível */}
          <Button
            variant={hasVideo ? (isVideoEnabled ? "default" : "destructive") : "outline"}
            size="lg"
            onClick={onToggleVideo}
            className="h-12 w-12 rounded-full"
            disabled={isConnecting || !hasVideo}
            title={!hasVideo ? "Câmera não disponível" : "Alternar câmera"}
          >
            {hasVideo ? (isVideoEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />) : <CameraOff className="h-5 w-5 opacity-50" />}
          </Button>

          {/* Áudio - sempre mostrar, mas desabilitar se não disponível */}
          <Button
            variant={hasAudio ? (isAudioEnabled ? "default" : "destructive") : "outline"}
            size="lg"
            onClick={onToggleAudio}
            className="h-12 w-12 rounded-full"
            disabled={isConnecting || !hasAudio}
            title={!hasAudio ? "Microfone não disponível" : "Alternar microfone"}
          >
            {hasAudio ? (isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />) : <MicOff className="h-5 w-5 opacity-50" />}
          </Button>

          <Button
            variant={hasScreenShare ? "default" : "outline"}
            size="lg"
            onClick={onToggleScreenShare}
            className="h-12 w-12 rounded-full"
            disabled={isConnecting}
            title="Compartilhar tela"
          >
            {hasScreenShare ? <Monitor className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={isConnected ? "destructive" : "default"}
            size="lg"
            onClick={isConnected ? onDisconnect : onConnect}
            disabled={isConnecting}
            className="h-12 w-12 rounded-full"
            title={isConnected ? "Desconectar" : "Conectar"}
          >
            {isConnected ? <PhoneOff className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-12 w-12 rounded-full"
            disabled
            title="Configurações (em breve)"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <div className="text-center mt-4">
          <p className="text-white/70 text-sm">
            {isConnecting && 'Conectando à sessão...'}
            {isConnected && !isConnecting && (
              <>
                {hasVideo || hasAudio ? 'Conectado - transmitindo para o host' : 'Conectado em modo degradado'}
                {!hasVideo && !hasAudio && (
                  <span className="text-yellow-400 ml-1">(sem mídia local)</span>
                )}
              </>
            )}
            {!isConnected && !isConnecting && 'Desconectado da sessão'}
            {connectionStatus === 'failed' && ' - Clique no botão de telefone para reconectar'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantControls;
