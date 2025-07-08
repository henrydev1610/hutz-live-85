import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface ParticipantHeaderProps {
  sessionId: string | undefined;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  signalingStatus: string;
  onBack: () => void;
}

const ParticipantHeader: React.FC<ParticipantHeaderProps> = ({
  sessionId,
  connectionStatus,
  signalingStatus,
  onBack
}) => {
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'failed': return 'Falha na conexão';
      default: return 'Desconectado';
    }
  };

  const getSignalingStatusColor = () => {
    switch (signalingStatus) {
      case 'connected': return 'text-green-400';
      case 'reconnecting': return 'text-yellow-400';
      case 'fallback': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Participante da Sessão
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-white border-white/30">
            ID: {sessionId}
          </Badge>
          <Badge 
            variant="outline" 
            className={`text-white border-white/30 ${getConnectionStatusColor()}`}
          >
            {getConnectionStatusText()}
          </Badge>
          <Badge variant="outline" className="text-white border-white/30">
            <div className="flex items-center gap-1">
              {signalingStatus === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className={getSignalingStatusColor()}>
                {signalingStatus}
              </span>
            </div>
          </Badge>
        </div>
      </div>
      
      <Button
        variant="outline"
        onClick={onBack}
        className="text-white border-white/30 hover:bg-white/10"
      >
        Voltar
      </Button>
    </div>
  );
};

export default ParticipantHeader;