import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWebRTCDiagnostics } from '@/hooks/live/useWebRTCDiagnostics';
import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

interface WebRTCDiagnosticsPanelProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: any[];
  isHost: boolean;
  className?: string;
}

const WebRTCDiagnosticsPanel: React.FC<WebRTCDiagnosticsPanelProps> = ({
  participantStreams,
  participantList,
  isHost,
  className = ""
}) => {
  const {
    diagnostics,
    autoRecoveryEnabled,
    recoveryAttempts,
    forceReconnection,
    resetDiagnostics,
    performHealthCheck
  } = useWebRTCDiagnostics({
    participantStreams,
    participantList,
    isHost
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wifi className="w-5 h-5" />
          Diagnóstico WebRTC
          {isHost && <Badge variant="secondary" className="text-xs">HOST</Badge>}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebSocket</span>
              {getStatusIcon(diagnostics.websocketStatus)}
            </div>
            <Badge className={getStatusColor(diagnostics.websocketStatus)}>
              {diagnostics.websocketStatus}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">WebRTC</span>
              {getStatusIcon(diagnostics.webrtcStatus)}
            </div>
            <Badge className={getStatusColor(diagnostics.webrtcStatus)}>
              {diagnostics.webrtcStatus}
            </Badge>
          </div>
        </div>

        {/* Stream Statistics */}
        <div className="pt-2 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Streams Ativos:</span>
              <span className="ml-2 font-medium">{diagnostics.activeStreams}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Conexões:</span>
              <span className="ml-2 font-medium">{diagnostics.activeConnections}</span>
            </div>
          </div>
        </div>

        {/* Recovery Information */}
        {isHost && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Auto-Recovery:</span>
              <Badge variant={autoRecoveryEnabled ? "default" : "secondary"}>
                {autoRecoveryEnabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            {recoveryAttempts > 0 && (
              <div className="text-xs text-muted-foreground">
                Tentativas de recuperação: {recoveryAttempts}/3
              </div>
            )}
          </div>
        )}

        {/* Last Health Check */}
        {diagnostics.lastHealthCheck && (
          <div className="text-xs text-muted-foreground">
            Última verificação: {new Date(diagnostics.lastHealthCheck).toLocaleTimeString()}
          </div>
        )}

        {/* Error Messages */}
        {diagnostics.errors.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-sm font-medium text-red-600 mb-2">Erros Recentes:</div>
            <div className="space-y-1">
              {diagnostics.errors.slice(-2).map((error, index) => (
                <div key={index} className="text-xs text-red-500 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={performHealthCheck}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Verificar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={forceReconnection}
            className="flex-1"
          >
            <Wifi className="w-4 h-4 mr-1" />
            Reconectar
          </Button>
        </div>

        {diagnostics.errors.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDiagnostics}
            className="w-full text-xs"
          >
            Limpar Diagnósticos
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default WebRTCDiagnosticsPanel;