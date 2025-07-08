import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ParticipantConnectionStatusProps {
  signalingStatus: string;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  hasVideo: boolean;
  hasAudio: boolean;
  onRetryMedia: () => void;
}

const ParticipantConnectionStatus: React.FC<ParticipantConnectionStatusProps> = ({
  signalingStatus,
  connectionStatus,
  hasVideo,
  hasAudio,
  onRetryMedia
}) => {
  const getSignalingStatusColor = () => {
    switch (signalingStatus) {
      case 'connected': return 'text-green-400';
      case 'reconnecting': return 'text-yellow-400';
      case 'fallback': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  return (
    <Card className="mb-6 bg-black/20 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">Status da Conexão:</h3>
          {(!hasVideo && !hasAudio) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryMedia}
              className="text-white border-white/30 hover:bg-white/10"
            >
              Tentar Reconectar Mídia
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-white/70">WebSocket:</span>
            <span className={`ml-2 ${getSignalingStatusColor()}`}>
              {signalingStatus}
            </span>
          </div>
          <div>
            <span className="text-white/70">WebRTC:</span>
            <span className={`ml-2 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {connectionStatus}
            </span>
          </div>
          <div>
            <span className="text-white/70">Vídeo:</span>
            <span className={`ml-2 ${hasVideo ? 'text-green-400' : 'text-red-400'}`}>
              {hasVideo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div>
            <span className="text-white/70">Áudio:</span>
            <span className={`ml-2 ${hasAudio ? 'text-green-400' : 'text-red-400'}`}>
              {hasAudio ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
        {(!hasVideo && !hasAudio) && (
          <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-md">
            <p className="text-yellow-400 text-sm">
              ⚠️ Conectado em modo degradado (sem câmera/microfone). Use o botão acima para tentar reconectar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParticipantConnectionStatus;