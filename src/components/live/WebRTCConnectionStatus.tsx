// WebRTC Connection Status Component
import React, { useEffect, useState } from 'react';
import { consolidatedWebRTCManager } from '@/utils/webrtc/ConsolidatedWebRTCManager';
import { testServerConnectivity } from '@/utils/connectionUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConnectionInfo {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
  connectionsCount: number;
  serverReachable: boolean;
}

export const WebRTCConnectionStatus: React.FC = () => {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    websocket: 'disconnected',
    webrtc: 'disconnected', 
    overall: 'disconnected',
    connectionsCount: 0,
    serverReachable: false
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateConnectionInfo = () => {
      const state = consolidatedWebRTCManager.getConnectionState();
      const debugInfo = consolidatedWebRTCManager.getDebugInfo();
      
      setConnectionInfo({
        websocket: state.websocket,
        webrtc: state.webrtc,
        overall: state.overall,
        connectionsCount: debugInfo.connectionsCount,
        serverReachable: true // Will be updated by server test
      });
    };

    const testServer = async () => {
      const isReachable = await testServerConnectivity('https://server-hutz-live.onrender.com');
      setConnectionInfo(prev => ({ ...prev, serverReachable: isReachable }));
    };

    // Update every 2 seconds
    const interval = setInterval(() => {
      updateConnectionInfo();
      testServer();
    }, 2000);

    updateConnectionInfo();
    testServer();

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

  const handleRestart = () => {
    console.log('🔄 STATUS: Restarting WebRTC system');
    consolidatedWebRTCManager.cleanup();
    
    // Auto-reinitialize after cleanup
    setTimeout(() => {
      const sessionId = sessionStorage.getItem('currentSessionId');
      if (sessionId) {
        consolidatedWebRTCManager.initializeAsHost(sessionId);
      }
    }, 1000);
  };

  if (!isVisible) {
    return (
      <Button 
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600"
        size="sm"
      >
        📊 Status
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between items-center">
          WebRTC Status
          <Button 
            onClick={() => setIsVisible(false)}
            variant="ghost" 
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs">WebSocket:</span>
          <Badge className={`${getStatusColor(connectionInfo.websocket)} text-white text-xs`}>
            {connectionInfo.websocket}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">WebRTC:</span>
          <Badge className={`${getStatusColor(connectionInfo.webrtc)} text-white text-xs`}>
            {connectionInfo.webrtc}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">Overall:</span>
          <Badge className={`${getStatusColor(connectionInfo.overall)} text-white text-xs`}>
            {connectionInfo.overall}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">Connections:</span>
          <Badge variant="outline" className="text-xs">
            {connectionInfo.connectionsCount}
          </Badge>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs">Server:</span>
          <Badge className={`${connectionInfo.serverReachable ? 'bg-green-500' : 'bg-red-500'} text-white text-xs`}>
            {connectionInfo.serverReachable ? 'Reachable' : 'Unreachable'}
          </Badge>
        </div>
        
        <div className="pt-2 border-t">
          <Button 
            onClick={handleRestart}
            className="w-full bg-red-500 hover:bg-red-600 text-white"
            size="sm"
          >
            🔄 Restart WebRTC
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};