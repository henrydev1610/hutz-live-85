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
  mediaError?: string | null;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartCamera?: () => void;
  onRetryMedia?: () => void;
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
  mediaError,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onConnect,
  onDisconnect,
  onStartCamera,
  onRetryMedia
}) => {
  // Show "Enable Camera" button if there's a media error
  if (mediaError && onStartCamera) {
    return (
      <Card className="bg-black/30 border-white/10">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="text-white/70">
              <p className="text-lg font-medium">Camera Permission Required</p>
              <p className="text-sm mt-2">
                {mediaError === 'NotAllowedError' && 'Please enable camera/microphone access in your browser settings.'}
                {mediaError === 'NotFoundError' && 'No camera or microphone found on this device.'}
                {mediaError && !['NotAllowedError', 'NotFoundError'].includes(mediaError) && 'Error accessing camera/microphone.'}
              </p>
            </div>
            
            <Button 
              onClick={onStartCamera}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              size="lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Enable Camera
            </Button>
            
            {onRetryMedia && (
              <Button 
                onClick={onRetryMedia}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

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