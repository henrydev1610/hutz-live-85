import React from 'react';
import { AlertCircle, CheckCircle, Wifi, WifiOff, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConnectionStatus } from '@/hooks/live/useConnectionStatus';
import { useConnectionDiagnostics } from '@/hooks/live/useConnectionDiagnostics';

interface ConnectionDiagnosticsProps {
  sessionId: string | null;
  participantCount: number;
  activeStreams: number;
  onTestConnection: () => void;
  webrtcConnected?: boolean;
  websocketConnected?: boolean;
}

const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  sessionId,
  participantCount,
  activeStreams,
  onTestConnection,
  webrtcConnected = false,
  websocketConnected = false
}) => {
  // Using diagnostics hook for real-time status
  
  const {
    metrics,
    performance,
    diagnosticLogs,
    runDiagnosticCheck,
    forceReconnect,
    clearLogs,
    exportDiagnostics
  } = useConnectionDiagnostics();

  const getOverallStatus = () => {
    const status = metrics.overall.status;
    const healthScore = metrics.overall.healthScore;
    
    if (status === 'connected' && healthScore >= 80) {
      return { status: 'connected', color: 'text-green-500', icon: CheckCircle, label: 'Conectado' };
    } else if (status === 'connected' && healthScore >= 50) {
      return { status: 'partial', color: 'text-yellow-500', icon: AlertCircle, label: 'Parcial' };
    } else if (status === 'connecting') {
      return { status: 'connecting', color: 'text-blue-500', icon: RefreshCw, label: 'Conectando' };
    } else {
      return { status: 'disconnected', color: 'text-red-500', icon: WifiOff, label: 'Desconectado' };
    }
  };

  const overall = getOverallStatus();
  const OverallIcon = overall.icon;

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Header with overall status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OverallIcon className={`h-5 w-5 ${overall.color} ${overall.status === 'connecting' ? 'animate-spin' : ''}`} />
            <span className="font-medium">Status da Conexão</span>
            <span className={`text-sm ${overall.color}`}>({overall.label})</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={runDiagnosticCheck}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Verificar
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={exportDiagnostics}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Detailed status */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            {/* WebSocket Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className={`h-4 w-4 ${metrics.websocket.status === 'connected' ? 'text-green-500' : 'text-red-500'}`} />
                <span>WebSocket</span>
              </div>
              <span className={`text-xs font-medium ${
                metrics.websocket.status === 'connected' ? 'text-green-500' : 
                metrics.websocket.status === 'connecting' ? 'text-blue-500' : 'text-red-500'
              }`}>
                {metrics.websocket.status === 'connected' ? 'Conectado' :
                 metrics.websocket.status === 'connecting' ? 'Conectando' : 'Desconectado'}
              </span>
            </div>
            
            {/* WebRTC Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  metrics.webrtc.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span>WebRTC</span>
              </div>
              <span className={`text-xs font-medium ${
                metrics.webrtc.status === 'connected' ? 'text-green-500' : 
                metrics.webrtc.status === 'connecting' ? 'text-blue-500' : 'text-red-500'
              }`}>
                {metrics.webrtc.status === 'connected' ? 'Conectado' :
                 metrics.webrtc.status === 'connecting' ? 'Conectando' : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Health Score */}
            <div className="flex items-center justify-between">
              <span>Saúde da Conexão</span>
              <span className={`text-xs font-medium ${
                metrics.overall.healthScore >= 80 ? 'text-green-500' :
                metrics.overall.healthScore >= 50 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {metrics.overall.healthScore}%
              </span>
            </div>
            
            {/* Participants */}
            <div className="flex items-center justify-between">
              <span>Participantes</span>
              <span className="text-xs font-medium">
                {metrics.webrtc.peerCount} conectado{metrics.webrtc.peerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Session info */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <div className="flex items-center justify-between">
            <span>Sessão: {sessionId ? sessionId.substring(0, 12) + '...' : 'Nenhuma'}</span>
            <span>Streams: {activeStreams}</span>
          </div>
        </div>

        {/* Performance metrics */}
        {performance.networkQuality !== 'poor' && (
          <div className="text-xs text-gray-500 border-t pt-2">
            <div className="flex items-center justify-between">
              <span>Qualidade da Rede: <span className="font-medium">{performance.networkQuality}</span></span>
              {performance.memoryUsage > 0 && (
                <span>Memória: <span className="font-medium">{performance.memoryUsage}%</span></span>
              )}
            </div>
          </div>
        )}

        {/* Connection issues */}
        {(metrics.websocket.lastError || metrics.webrtc.lastError) && (
          <div className="text-xs text-red-500 border-t pt-2">
            {metrics.websocket.lastError && (
              <div>WebSocket: {metrics.websocket.lastError}</div>
            )}
            {metrics.webrtc.lastError && (
              <div>WebRTC: {metrics.webrtc.lastError}</div>
            )}
          </div>
        )}

        {/* Recovery options */}
        {metrics.overall.healthScore < 50 && (
          <div className="border-t pt-2">
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={forceReconnect}
              className="w-full text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Forçar Reconexão
            </Button>
          </div>
        )}
        
        {/* Diagnostic info */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <div>Última verificação: {new Date(metrics.overall.lastCheck).toLocaleTimeString()}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostics;