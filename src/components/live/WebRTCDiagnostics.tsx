import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWebRTCManager, getWebRTCPeerConnections, getWebRTCConnectionState } from '@/utils/webrtc';
import { Activity, Wifi, Users, Video, AlertTriangle, CheckCircle } from 'lucide-react';

interface WebRTCDiagnosticsProps {
  isVisible: boolean;
  onClose: () => void;
}

const WebRTCDiagnostics: React.FC<WebRTCDiagnosticsProps> = ({ isVisible, onClose }) => {
  const [diagnostics, setDiagnostics] = useState({
    connectionState: { websocket: 'disconnected', webrtc: 'disconnected', overall: 'disconnected' },
    peerConnections: new Map(),
    participants: [],
    streams: 0,
    errors: []
  });

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const manager = getWebRTCManager();
      const connections = getWebRTCPeerConnections();
      const connectionState = getWebRTCConnectionState();

      const peerDetails = new Map();
      connections.forEach((pc, participantId) => {
        peerDetails.set(participantId, {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState,
          iceGatheringState: pc.iceGatheringState,
          localDescription: pc.localDescription ? 'Set' : 'Not Set',
          remoteDescription: pc.remoteDescription ? 'Set' : 'Not Set'
        });
      });

      setDiagnostics(prev => ({
        ...prev,
        connectionState,
        peerConnections: peerDetails,
        participants: manager?.getParticipants() || [],
        streams: connections.size
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4" />;
      case 'connecting': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const forcePeerConnection = async (participantId: string) => {
    console.log(`🔧 DIAGNOSTICS: Force creating peer connection for ${participantId}`);
    
    const { forceParticipantReconnection } = await import('@/utils/webrtc');
    
    try {
      await forceParticipantReconnection(participantId);
      console.log(`✅ DIAGNOSTICS: Force reconnection successful for ${participantId}`);
    } catch (error) {
      console.error(`❌ DIAGNOSTICS: Force reconnection failed for ${participantId}:`, error);
    }
  };

  const testConnection = async () => {
    console.log('🧪 DIAGNOSTICS: Testing WebRTC connection');
    
    const { testWebRTCConnection } = await import('@/utils/webrtc');
    
    try {
      const result = await testWebRTCConnection();
      console.log('🧪 DIAGNOSTICS: Connection test result:', result);
      
      if (result) {
        alert('✅ Teste de conexão passou! WebRTC está funcionando corretamente.');
      } else {
        alert('❌ Teste de conexão falhou. Verifique a conexão de internet e tente novamente.');
      }
    } catch (error) {
      console.error('❌ DIAGNOSTICS: Connection test failed:', error);
      alert('❌ Erro durante o teste de conexão.');
    }
  };

  const forceReconnectAll = async () => {
    console.log('🔧 DIAGNOSTICS: Force reconnecting all participants');
    
    const { forceReconnectAll } = await import('@/utils/webrtc');
    
    try {
      await forceReconnectAll();
      console.log('✅ DIAGNOSTICS: Force reconnect all successful');
      alert('✅ Tentativa de reconexão iniciada para todos os participantes.');
    } catch (error) {
      console.error('❌ DIAGNOSTICS: Force reconnect all failed:', error);
      alert('❌ Erro durante a reconexão.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              WebRTC Diagnostics
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              <span className="text-sm">WebSocket:</span>
              <Badge className={getStatusColor(diagnostics.connectionState.websocket)}>
                {diagnostics.connectionState.websocket}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              <span className="text-sm">WebRTC:</span>
              <Badge className={getStatusColor(diagnostics.connectionState.webrtc)}>
                {diagnostics.connectionState.webrtc}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">Overall:</span>
              <Badge className={getStatusColor(diagnostics.connectionState.overall)}>
                {diagnostics.connectionState.overall}
              </Badge>
            </div>
          </div>

          {/* Peer Connections */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Peer Connections ({diagnostics.peerConnections.size})</h3>
            {diagnostics.peerConnections.size === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p>Nenhuma conexão peer-to-peer ativa</p>
                <p className="text-sm">Verifique se o celular está conectado e transmitindo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(diagnostics.peerConnections.entries()).map(([participantId, details]) => (
                  <Card key={participantId} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{participantId}</h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => forcePeerConnection(participantId)}
                      >
                        Force Reconnect
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(details.connectionState)}
                          <span>Connection: {details.connectionState}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(details.iceConnectionState)}
                          <span>ICE: {details.iceConnectionState}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(details.signalingState)}
                          <span>Signaling: {details.signalingState}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(details.iceGatheringState)}
                          <span>ICE Gathering: {details.iceGatheringState}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {details.localDescription === 'Set' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          <span>Local SDP: {details.localDescription}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {details.remoteDescription === 'Set' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          <span>Remote SDP: {details.remoteDescription}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Stream Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Stream Information</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Active Streams:</strong> {diagnostics.streams}
                </div>
                <div>
                  <strong>Participants:</strong> {diagnostics.participants.length}
                </div>
              </div>
            </div>
          </div>

          {/* Critical Actions */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">Critical Actions</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testConnection}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Testar Conexão
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={forceReconnectAll}
                  className="w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Reconectar Tudo
                </Button>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Troubleshooting Steps:</p>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      <li>1. Verifique se o celular está conectado à internet</li>
                      <li>2. Confirme que a câmera do celular está funcionando</li>
                      <li>3. Verifique se o WebSocket está conectado (deve estar verde)</li>
                      <li>4. Se WebRTC está vermelho, pode ser problema de firewall/NAT</li>
                      <li>5. Verifique se há peers connections ativas acima</li>
                      <li>6. Use "Testar Conexão" para diagnóstico automático</li>
                      <li>7. Use "Reconectar Tudo" se houver problemas persistentes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebRTCDiagnostics;