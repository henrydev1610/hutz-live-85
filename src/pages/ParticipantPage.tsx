
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import signalingService from '@/services/WebSocketSignalingService';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting render');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

  // Monitor signaling service status
  useEffect(() => {
    const checkSignalingStatus = () => {
      const status = signalingService.getConnectionStatus();
      setSignalingStatus(status);
    };

    const interval = setInterval(checkSignalingStatus, 1000);
    checkSignalingStatus();

    return () => clearInterval(interval);
  }, []);

  // Auto-initialize media and connect on mount
  useEffect(() => {
    console.log('🚀 PARTICIPANT PAGE: Auto-initializing for session:', sessionId);
    
    if (sessionId) {
      autoConnectToSession().catch(error => {
        console.error('❌ PARTICIPANT: Failed to auto-connect:', error);
      });
    }
    
    return () => {
      try {
        media.cleanup();
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
      }
    };
  }, [sessionId]);

  const autoConnectToSession = async () => {
    try {
      const stream = await media.initializeMedia();
      if (stream) {
        await connection.connectToSession(stream);
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Auto-connection failed:', error);
    }
  };

  const handleConnect = async () => {
    try {
      let stream = media.localStreamRef.current;
      if (!stream) {
        stream = await media.initializeMedia();
      }
      if (stream) {
        await connection.connectToSession(stream);
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connection.connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connection.connectionStatus) {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
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
            onClick={() => navigate('/')}
            className="text-white border-white/30 hover:bg-white/10"
          >
            Voltar
          </Button>
        </div>

        {/* Error Display */}
        {connection.error && (
          <Card className="mb-6 border-red-500/50 bg-red-500/10">
            <CardContent className="p-4">
              <p className="text-red-400">{connection.error}</p>
              <Button 
                onClick={handleConnect}
                className="mt-2"
                disabled={connection.isConnecting}
              >
                Tentar Reconectar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connection Status Details */}
        <Card className="mb-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Status da Conexão:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-white/70">WebSocket:</span>
                <span className={`ml-2 ${getSignalingStatusColor()}`}>
                  {signalingStatus}
                </span>
              </div>
              <div>
                <span className="text-white/70">WebRTC:</span>
                <span className={`ml-2 ${connection.connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                  {connection.connectionStatus}
                </span>
              </div>
              <div>
                <span className="text-white/70">Vídeo:</span>
                <span className={`ml-2 ${media.hasVideo ? 'text-green-400' : 'text-red-400'}`}>
                  {media.hasVideo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
                <span className="text-white/70">Áudio:</span>
                <span className={`ml-2 ${media.hasAudio ? 'text-green-400' : 'text-red-400'}`}>
                  {media.hasAudio ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Preview */}
        <ParticipantVideoPreview
          localVideoRef={media.localVideoRef}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          hasScreenShare={media.hasScreenShare}
          isVideoEnabled={media.isVideoEnabled}
          isAudioEnabled={media.isAudioEnabled}
        />

        {/* Controls */}
        <ParticipantControls
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          hasScreenShare={media.hasScreenShare}
          isVideoEnabled={media.isVideoEnabled}
          isAudioEnabled={media.isAudioEnabled}
          isConnected={connection.isConnected}
          isConnecting={connection.isConnecting}
          connectionStatus={connection.connectionStatus}
          onToggleVideo={media.toggleVideo}
          onToggleAudio={media.toggleAudio}
          onToggleScreenShare={media.toggleScreenShare}
          onConnect={handleConnect}
          onDisconnect={connection.disconnectFromSession}
        />

        {/* Instructions */}
        <Card className="mt-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Instruções:</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• Verifique se o servidor de sinalização está rodando em localhost:3001</li>
              <li>• A câmera e microfone são inicializados automaticamente com fallback</li>
              <li>• Use os controles para ajustar vídeo, áudio e compartilhamento de tela</li>
              <li>• Se houver problemas de conexão, use o botão de reconexão</li>
              <li>• O status do WebSocket deve mostrar "connected" para funcionar corretamente</li>
              <li>• Permita acesso à câmera/microfone quando solicitado pelo navegador</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantPage;
