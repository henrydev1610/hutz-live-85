/**
 * FASE 5: Indicador de debug para WebRTC em tempo real
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getWebRTCManager } from '@/utils/webrtc';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { Wifi, Video, Mic, Users, Activity } from 'lucide-react';

export const WebRTCDebugIndicator = () => {
  const [connectionState, setConnectionState] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateState = () => {
      const manager = getWebRTCManager();
      if (manager) {
        const state = manager.getConnectionState();
        const metricsData = manager.getConnectionMetrics();
        setConnectionState(state);
        setMetrics(metricsData);
      }
    };

    // Update inicial
    updateState();

    // Update periódico
    const interval = setInterval(updateState, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'connected': return 'default';
      case 'connecting': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="rounded-full w-12 h-12 p-0"
        >
          <Activity className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Card className="w-80 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">WebRTC Debug</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <CardDescription className="text-xs">Estado das conexões em tempo real</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {/* Status geral */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Status Geral:</span>
            <Badge variant={getStatusVariant(connectionState?.overall || 'disconnected')}>
              {connectionState?.overall || 'unknown'}
            </Badge>
          </div>

          {/* WebSocket */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Wifi className="w-3 h-3" />
              <span className="text-xs">WebSocket:</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionState?.websocket || 'disconnected')}`} />
              <span className="text-xs">{connectionState?.websocket || 'disconnected'}</span>
            </div>
          </div>

          {/* WebRTC */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Video className="w-3 h-3" />
              <span className="text-xs">WebRTC:</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionState?.webrtc || 'disconnected')}`} />
              <span className="text-xs">{connectionState?.webrtc || 'disconnected'}</span>
            </div>
          </div>

          {/* WebSocket Info */}
          {unifiedWebSocketService.isConnected() && (
            <div className="bg-green-50 p-2 rounded text-xs">
              <div className="flex items-center space-x-1">
                <Wifi className="w-3 h-3 text-green-600" />
                <span className="text-green-700 font-medium">WebSocket Ativo</span>
              </div>
              <div className="text-green-600 mt-1">
                Ready: {unifiedWebSocketService.isReady() ? '✅' : '❌'}
              </div>
            </div>
          )}

          {/* Peer Connections */}
          {metrics && metrics.size > 0 && (
            <div className="bg-blue-50 p-2 rounded text-xs">
              <div className="flex items-center space-x-1">
                <Users className="w-3 h-3 text-blue-600" />
                <span className="text-blue-700 font-medium">Conexões P2P: {metrics.size}</span>
              </div>
            </div>
          )}

          {/* Status offline */}
          {connectionState?.overall === 'failed' && (
            <div className="bg-red-50 p-2 rounded text-xs text-red-700">
              ❌ Conexão falhou - Verifique servidor
            </div>
          )}

          {/* Debug actions */}
          <div className="flex space-x-1 pt-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => console.log('🔍 DEBUG STATE:', { connectionState, metrics })}
              className="text-xs h-6"
            >
              Log State
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="text-xs h-6"
            >
              Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};