import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWebRTCManager, getWebRTCConnectionState } from '@/utils/webrtc';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface WebRTCEmergencyDebuggerProps {
  isHost?: boolean;
}

const WebRTCEmergencyDebugger: React.FC<WebRTCEmergencyDebuggerProps> = ({ isHost = false }) => {
  const [connectionState, setConnectionState] = useState<any>(null);
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugResults, setDebugResults] = useState<string[]>([]);

  useEffect(() => {
    const checkStatus = () => {
      const state = getWebRTCConnectionState();
      setConnectionState(state);
      
      const manager = getWebRTCManager();
      if (manager) {
        const connections = manager.getPeerConnections();
        setPeerConnections(connections);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const addDebugResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const forceWebRTCConnection = async () => {
    setIsDebugging(true);
    addDebugResult('🚨 EMERGENCY: Starting WebRTC force connection...');
    
    try {
      const manager = getWebRTCManager();
      if (!manager) {
        addDebugResult('❌ ERROR: No WebRTC manager found');
        toast.error('No WebRTC manager found');
        return;
      }

      // Force WebRTC connection state
      const result = manager.forceWebRTCConnection();
      addDebugResult(`✅ SUCCESS: WebRTC connection forced. State: ${JSON.stringify(result)}`);
      
      // Force mobile participant visible (if participant)
      if (!isHost) {
        manager.forceMobileParticipantVisible();
        addDebugResult('🚨 EMERGENCY: Forced mobile participant visibility');
      }

      toast.success('WebRTC connection forced successfully!');
      
    } catch (error) {
      addDebugResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to force WebRTC connection');
    } finally {
      setIsDebugging(false);
    }
  };

  const clearDebugResults = () => {
    setDebugResults([]);
  };

  const getConnectionStateColor = (state: string) => {
    switch (state) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStateText = (state: string) => {
    switch (state) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      case 'failed': return 'Failed';
      default: return 'Disconnected';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚨 WebRTC Emergency Debugger
          <Badge variant="outline">{isHost ? 'Host' : 'Participant'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">WebSocket</div>
            <Badge className={getConnectionStateColor(connectionState?.websocket || 'disconnected')}>
              {getConnectionStateText(connectionState?.websocket || 'disconnected')}
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">WebRTC</div>
            <Badge className={getConnectionStateColor(connectionState?.webrtc || 'disconnected')}>
              {getConnectionStateText(connectionState?.webrtc || 'disconnected')}
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Overall</div>
            <Badge className={getConnectionStateColor(connectionState?.overall || 'disconnected')}>
              {getConnectionStateText(connectionState?.overall || 'disconnected')}
            </Badge>
          </div>
        </div>

        {/* Peer Connections */}
        <div>
          <div className="text-sm font-medium mb-2">Peer Connections: {peerConnections.size}</div>
          {peerConnections.size > 0 ? (
            <div className="space-y-1">
              {Array.from(peerConnections.entries()).map(([id, pc]) => (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{id}</span>
                  <Badge variant="outline" className={getConnectionStateColor(pc.connectionState)}>
                    {pc.connectionState}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No peer connections</div>
          )}
        </div>

        {/* Emergency Actions */}
        <div className="flex gap-2">
          <Button
            onClick={forceWebRTCConnection}
            disabled={isDebugging}
            variant="destructive"
            size="sm"
          >
            {isDebugging ? 'Forcing...' : '🚨 Force WebRTC Connection'}
          </Button>
          <Button
            onClick={clearDebugResults}
            variant="outline"
            size="sm"
          >
            Clear Log
          </Button>
        </div>

        {/* Debug Results */}
        {debugResults.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Debug Log:</div>
            <div className="bg-black text-green-400 p-3 rounded-md text-xs font-mono max-h-40 overflow-y-auto">
              {debugResults.map((result, index) => (
                <div key={index}>{result}</div>
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        <Alert>
          <AlertDescription>
            <strong>Emergency Tool:</strong> Use this only when WebRTC is not connecting properly. 
            This will force connection states and may cause unexpected behavior.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default WebRTCEmergencyDebugger;