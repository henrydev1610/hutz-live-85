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

    console.log('🔍 FASE 4: Connection Health Monitor starting...');
    
    const updateStatus = () => {
      const webrtcManager = getWebRTCManager();
      console.log('🔍 FASE 4: Monitor update - manager exists:', !!webrtcManager);
      
      if (webrtcManager) {
        try {
          const state = webrtcManager.getConnectionState();
          const metrics = webrtcManager.getConnectionMetrics();
          
          console.log('🔍 FASE 4: Connection state:', state);
          console.log('🔍 FASE 4: Connection metrics:', Array.from(metrics.entries()));
          
          setConnectionState(state);
          setMetrics(metrics);
        } catch (error) {
          console.error('❌ FASE 4: Error getting manager state:', error);
          // Fallback para estado desconectado se manager está corrompido
          setConnectionState({
            websocket: 'disconnected',
            webrtc: 'disconnected',
            overall: 'disconnected'
          });
          setMetrics(new Map());
        }
      } else {
        console.warn('⚠️ FASE 4: No WebRTC manager available for monitoring');
        
        // FASE 4: Fallback - tentar reconectar ou verificar estado externo
        try {
          // Importar dinâmicamente o serviço WebSocket para verificar estado
          import('@/services/UnifiedWebSocketService').then(({ unifiedWebSocketService: wsService }) => {
            const wsState = { websocket: wsService.getConnectionStatus(), connected: wsService.isConnected() };
            console.log('🔍 FASE 4: WebSocket fallback state:', wsState);
            
            setConnectionState({
              websocket: wsState.websocket as any,
              webrtc: 'disconnected',
              overall: wsState.connected ? 'connecting' : 'disconnected'
            });
          }).catch(err => {
            console.error('❌ FASE 4: Fallback failed:', err);
          });
        } catch (error) {
          console.error('❌ FASE 4: Fallback state check failed:', error);
        }
        
        setConnectionState({
          websocket: 'disconnected',
          webrtc: 'disconnected',
          overall: 'disconnected'
        });
        setMetrics(new Map());
      }
    };

    // Update immediately
    updateStatus();
    
    const interval = setInterval(updateStatus, 2000); // Update every 2 seconds

    return () => {
      console.log('🔍 FASE 4: Connection Health Monitor stopping...');
      clearInterval(interval);
    };
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
        {/* Desktop Connection Controls */}
        {(connectionState.webrtc === 'connecting' || connectionState.overall === 'failed') && (
          <div className="border-t pt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              onClick={() => {
                console.log('🖥️ MONITOR: Desktop immediate reset requested');
                window.dispatchEvent(new CustomEvent('desktop-force-reset'));
              }}
            >
              🔥 Reset (5s Max)
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              onClick={() => {
                console.log('🚫 MONITOR: Desktop loop break requested');
                window.dispatchEvent(new CustomEvent('desktop-break-loops'));
              }}
            >
              ⚡ Break Loops (4s)
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-2">
          Última atualização: {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionHealthMonitor;