
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { CameraSwitcher } from '@/components/participant/CameraSwitcher';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting render');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  console.log('🌐 PARTICIPANT PAGE: Current URL:', window.location.href);
  console.log('🔗 PARTICIPANT PAGE: Access method:', 
    new URLSearchParams(window.location.search).has('qr') ? 'QR Code' : 'Direct URL');
  
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionProgress, setConnectionProgress] = useState<string>('Iniciando...');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

  // Enhanced monitoring for connection progress
  useEffect(() => {
    const updateStatus = () => {
      const status = unifiedWebSocketService.getConnectionStatus();
      setSignalingStatus(status);
      
      // Update connection progress based on status
      if (status === 'connecting') {
        setConnectionProgress(`Conectando... (tentativa ${connectionAttempts + 1})`);
      } else if (status === 'connected') {
        setConnectionProgress('Conectado ao servidor');
      } else if (status === 'failed') {
        setConnectionProgress(`Falha de conexão (tentativa ${connectionAttempts})`);
      } else {
        setConnectionProgress('Desconectado');
      }
    };

    const interval = setInterval(updateStatus, 1000);
    updateStatus();

    return () => clearInterval(interval);
  }, [connectionAttempts]);

  // Enhanced auto-connect with better error handling
  useEffect(() => {
    if (sessionId) {
      autoConnectToSession().catch(error => {
        console.error('❌ PARTICIPANT: Failed to auto-connect:', error);
        setConnectionAttempts(prev => prev + 1);
        setConnectionProgress(`Erro de conexão: ${error.message}`);
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
      console.log('🔄 AUTO-CONNECT: Initializing media and connecting to session...');
      setConnectionProgress('Inicializando câmera...');
      
      const stream = await media.initializeMedia();
      if (stream) {
        console.log('✅ AUTO-CONNECT: Media initialized, connecting to session...');
        setConnectionProgress('Conectando à sessão...');
        await connection.connectToSession(stream);
        setConnectionProgress('Conectado com sucesso!');
      } else {
        console.warn('⚠️ AUTO-CONNECT: No media stream available, connecting without media');
        setConnectionProgress('Conectando sem câmera...');
        await connection.connectToSession();
      }
    } catch (error) {
      console.error('❌ AUTO-CONNECT: Failed:', error);
      setConnectionAttempts(prev => prev + 1);
      setConnectionProgress(`Erro de conexão: ${error.message}`);
      
      // Retry after delay for mobile devices
      if (connectionAttempts < 5) {
        setTimeout(() => {
          autoConnectToSession();
        }, 5000 + (connectionAttempts * 2000)); // Progressive delay
      }
      throw error;
    }
  };

  const handleConnect = async () => {
    try {
      setConnectionAttempts(prev => prev + 1);
      setConnectionProgress('Reconectando...');
      
      let stream = media.localStreamRef.current;
      if (!stream) {
        setConnectionProgress('Reinicializando câmera...');
        stream = await media.initializeMedia();
      }
      
      setConnectionProgress('Conectando à sessão...');
      await connection.connectToSession(stream);
      setConnectionProgress('Conectado com sucesso!');
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
      setConnectionProgress(`Erro: ${error.message}`);
    }
  };

  const handleSwitchCamera = async (facing: 'user' | 'environment') => {
    try {
      console.log(`📱 Switching camera to ${facing}...`);
      
      const newStream = await media.switchCamera(facing);
      
      if (newStream && connection.isConnected) {
        console.log('🔄 Reconnecting with new camera stream...');
        // Reconectar com a nova stream
        await connection.disconnectFromSession();
        await connection.connectToSession(newStream);
        console.log('✅ Reconnected with new camera successfully');
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Failed to switch camera:', error);
    }
  };

  const handleRetryMedia = async () => {
    try {
      const stream = await media.retryMediaInitialization();
      if (stream && connection.isConnected) {
        // Se já conectado, pode tentar reconectar com nova mídia
        await connection.disconnectFromSession();
        await connection.connectToSession(stream);
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Media retry failed:', error);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto p-4 max-w-lg md:max-w-2xl lg:max-w-4xl">
        {/* Header */}
        <ParticipantHeader
          sessionId={sessionId}
          connectionStatus={connection.connectionStatus}
          signalingStatus={signalingStatus}
          onBack={() => navigate('/')}
        />

        {/* Error Display */}
        <ParticipantErrorDisplay
          error={connection.error}
          isConnecting={connection.isConnecting}
          onRetryConnect={handleConnect}
        />

        {/* Enhanced connection status with progress */}
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Status da Conexão:</span>
            <span className={`text-sm px-2 py-1 rounded ${
              connection.isConnected ? 'bg-green-100 text-green-800' : 
              signalingStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-red-100 text-red-800'
            }`}>
              {connection.isConnected ? 'Conectado' : signalingStatus}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">{connectionProgress}</div>
          <div className="text-xs text-muted-foreground">
            Tentativas: {connectionAttempts} | Sinal: {signalingStatus}
          </div>
        </div>

        {/* Connection Status Details */}
        <ParticipantConnectionStatus
          signalingStatus={signalingStatus}
          connectionStatus={connection.connectionStatus}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          onRetryMedia={handleRetryMedia}
        />

        {/* Camera Switcher - Mobile Only */}
        <div className="mb-4 flex justify-center">
          <CameraSwitcher
            onSwitchCamera={handleSwitchCamera}
            isLoading={connection.isConnecting}
            hasVideo={media.hasVideo}
          />
        </div>

        {/* Video Preview */}
        <ParticipantVideoPreview
          localVideoRef={media.localVideoRef}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          hasScreenShare={media.hasScreenShare}
          isVideoEnabled={media.isVideoEnabled}
          isAudioEnabled={media.isAudioEnabled}
          localStream={media.localStreamRef.current}
          onRetryMedia={handleRetryMedia}
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
        <ParticipantInstructions />
      </div>
    </div>
  );
};

export default ParticipantPage;
