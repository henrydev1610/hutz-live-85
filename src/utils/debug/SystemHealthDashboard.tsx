/**
 * FASE 5: System Health Dashboard Component
 * Provides real-time system status monitoring for production deployment
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { backendHealthChecker, BackendHealthStatus } from './BackendHealthChecker';
import { getEnvironmentInfo } from '@/utils/connectionUtils';
import { useUnifiedWebRTCStability } from '@/hooks/live/useUnifiedWebRTCStability';

interface SystemHealthDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({
  isVisible,
  onClose
}) => {
  const [backendStatus, setBackendStatus] = useState<BackendHealthStatus | null>(null);
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null);
  const { connectionState, forceReset } = useUnifiedWebRTCStability();

  useEffect(() => {
    if (isVisible) {
      // Get initial environment info
      setEnvironmentInfo(getEnvironmentInfo());
      
      // Get initial backend status
      backendHealthChecker.checkBackendHealth().then(setBackendStatus);
      
      // Listen for backend status updates
      const handleStatusUpdate = (status: BackendHealthStatus) => {
        setBackendStatus(status);
      };
      
      backendHealthChecker.onStatusChange(handleStatusUpdate);
      
      return () => {
        backendHealthChecker.offStatusChange(handleStatusUpdate);
      };
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'online':
        return 'bg-green-500';
      case 'connecting':
      case 'checking':
        return 'bg-yellow-500';
      case 'failed':
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando';
      case 'disconnected':
        return 'Desconectado';
      case 'failed':
        return 'Falhou';
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'checking':
        return 'Verificando';
      default:
        return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>🔍 System Health Dashboard</CardTitle>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">WebSocket</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(connectionState.websocket)}>
                  {getStatusText(connectionState.websocket)}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">WebRTC</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(connectionState.webrtc)}>
                  {getStatusText(connectionState.webrtc)}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {connectionState.participantCount} participantes
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Backend</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getStatusColor(backendStatus?.isOnline ? 'online' : 'offline')}>
                  {backendStatus?.isOnline ? 'Online' : 'Offline'}
                </Badge>
                {backendStatus && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {backendStatus.responseTime}ms
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Backend Details */}
          {backendStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Backend Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>URL:</span>
                  <span className="text-sm font-mono">{backendStatus.url}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Response Time:</span>
                  <span>{backendStatus.responseTime}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Last Check:</span>
                  <span>{new Date(backendStatus.lastCheck).toLocaleTimeString()}</span>
                </div>
                
                {/* Endpoint Status */}
                <div className="space-y-2">
                  <h4 className="font-medium">Endpoints:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Badge className={backendStatus.endpoints.health ? 'bg-green-500' : 'bg-red-500'}>
                      /health
                    </Badge>
                    <Badge className={backendStatus.endpoints.socket ? 'bg-green-500' : 'bg-red-500'}>
                      /socket.io/
                    </Badge>
                    <Badge className={backendStatus.endpoints.api ? 'bg-green-500' : 'bg-red-500'}>
                      /api
                    </Badge>
                  </div>
                </div>
                
                {backendStatus.error && (
                  <div className="text-red-500 text-sm">
                    <strong>Error:</strong> {backendStatus.error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Environment Info */}
          {environmentInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Environment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between">
                      <span>Host:</span>
                      <span className="text-sm font-mono">{environmentInfo.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span>{environmentInfo.protocol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Environment:</span>
                      <Badge variant="outline">
                        {environmentInfo.isLocalhost ? 'Local' : 
                         environmentInfo.isLovable ? 'Lovable' :
                         environmentInfo.isRender ? 'Render' : 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between">
                      <span>WebSocket URL:</span>
                      <span className="text-sm font-mono break-all">{environmentInfo.wsUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>API URL:</span>
                      <span className="text-sm font-mono break-all">{environmentInfo.apiBaseUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Secure:</span>
                      <Badge variant={environmentInfo.isSecure ? 'default' : 'destructive'}>
                        {environmentInfo.isSecure ? 'HTTPS' : 'HTTP'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {/* URL Mapping */}
                {environmentInfo.urlMapping && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <h4 className="font-medium mb-2">URL Mapping:</h4>
                    <div className="space-y-1 text-sm">
                      <div>Frontend: {environmentInfo.urlMapping.frontend}</div>
                      <div>Backend: {environmentInfo.urlMapping.backend}</div>
                      <div>WebSocket: {environmentInfo.urlMapping.websocket}</div>
                      <Badge className={environmentInfo.urlMapping.isURLSynced ? 'bg-green-500' : 'bg-red-500'}>
                        {environmentInfo.urlMapping.isURLSynced ? 'SYNCED' : 'NOT_SYNCED'}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => backendHealthChecker.checkBackendHealth()}
              variant="outline"
              size="sm"
            >
              🔄 Check Backend
            </Button>
            
            <Button 
              onClick={() => backendHealthChecker.testWithFallback()}
              variant="outline"
              size="sm"
            >
              🔄 Test Fallback
            </Button>
            
            <Button 
              onClick={forceReset}
              variant="outline"
              size="sm"
            >
              🔄 Reset WebRTC
            </Button>
            
            <Button 
              onClick={() => {
                window.location.reload();
              }}
              variant="destructive"
              size="sm"
            >
              🔄 Full Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};