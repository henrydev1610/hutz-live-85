import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getWebRTCManager } from '@/utils/webrtc';
import { Wifi, WifiOff, Users, Activity } from 'lucide-react';

interface ConnectionHealthMonitorProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ConnectionState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

const ConnectionHealthMonitor: React.FC<ConnectionHealthMonitorProps> = ({ isVisible, onClose }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  });
  const [metrics, setMetrics] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const webrtcManager = getWebRTCManager();
      if (webrtcManager) {
        setConnectionState(webrtcManager.getConnectionState());
        setMetrics(webrtcManager.getConnectionMetrics());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'failed': return 'Falhou';
      default: return 'Desconectado';
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="fixed top-4 right-4 w-80 z-50 bg-background/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Monitor de Conexão
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status Geral</span>
          <Badge variant="secondary" className={getStatusColor(connectionState.overall)}>
            {connectionState.overall === 'connected' ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {getStatusText(connectionState.overall)}
          </Badge>
        </div>

        {/* WebSocket Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">WebSocket</span>
          <Badge variant="outline" className={getStatusColor(connectionState.websocket)}>
            {getStatusText(connectionState.websocket)}
          </Badge>
        </div>

        {/* WebRTC Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">WebRTC</span>
          <Badge variant="outline" className={getStatusColor(connectionState.webrtc)}>
            {getStatusText(connectionState.webrtc)}
          </Badge>
        </div>

        {/* Participants */}
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Participantes ({metrics.size})</span>
          </div>
          
          {metrics.size === 0 ? (
            <div className="text-xs text-muted-foreground">
              Nenhum participante conectado
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from(metrics.entries()).map(([participantId, data]) => (
                <div key={participantId} className="text-xs flex items-center justify-between">
                  <span className="truncate">{participantId}</span>
                  <div className="flex gap-1">
                    {data.joined && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Ativo
                      </Badge>
                    )}
                    {data.streamReceived && (
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Stream
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Update */}
        <div className="text-xs text-muted-foreground border-t pt-2">
          Última atualização: {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionHealthMonitor;