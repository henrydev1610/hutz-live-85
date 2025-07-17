import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useWebRTCContinuousConnection } from '@/hooks/participant/useWebRTCContinuousConnection';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { CameraSwitcher } from '@/components/participant/CameraSwitcher';
import { getWebRTCConnectionState } from '@/utils/webrtc';

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
  const [webrtcState, setWebrtcState] = useState<any>({ overall: 'disconnected' });

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

  // ENHANCED: Conexão contínua melhorada - APENAS se não houver conexão em progresso
  const continuousConnection = useWebRTCContinuousConnection({
    sessionId: connection.connectionInProgress ? null : sessionId, // FASE 2: Desabilitar se conexão em progresso
    participantId,
    isConnected: connection.isConnected,
    connectionStatus: connection.connectionStatus,
    stream: media.localStreamRef.current,
    connectToSession: connection.connectToSession,
    isMobile: connection.isMobile
  });

  // ENHANCED: Monitoramento melhorado com WebRTC state
  useEffect(() => {
    const updateStatus = () => {
      const wsStatus = unifiedWebSocketService.getConnectionStatus();
      const webrtcConnectionState = getWebRTCConnectionState();
      
      setSignalingStatus(wsStatus);
      setWebrtcState(webrtcConnectionState);
      
      // ENHANCED: Update connection progress with detailed status
      if (wsStatus === 'connecting') {
        setConnectionProgress(`Conectando ao servidor... (tentativa ${connectionAttempts + 1})`);
      } else if (wsStatus === 'connected') {
        if (webrtcConnectionState.webrtc === 'connected') {
          setConnectionProgress('✅ Conectado e transmitindo');
        } else if (webrtcConnectionState.webrtc === 'connecting') {
          setConnectionProgress('🔄 Conectado ao servidor, iniciando WebRTC...');
        } else if (webrtcConnectionState.webrtc === 'failed') {
          setConnectionProgress('⚠️ Servidor conectado, WebRTC com falha');
        } else {
          setConnectionProgress('📡 Conectado ao servidor, aguardando WebRTC...');
        }
      } else if (wsStatus === 'failed') {
        setConnectionProgress(`❌ Falha de conexão (tentativa ${connectionAttempts})`);
      } else {
        setConnectionProgress('⚪ Desconectado');
      }
    };

    const interval = setInterval(updateStatus, 1000);
    updateStatus();

    return () => clearInterval(interval);
  }, [connectionAttempts]);

  // ENHANCED: Auto-connect com retry melhorado
  useEffect(() => {
    if (sessionId) {
      autoConnectToSession().catch(error => {
        console.error('❌ PARTICIPANT: Failed to auto-connect:', error);
        setConnectionAttempts(prev => prev + 1);
        setConnectionProgress(`❌ Erro de conexão: ${error.message}`);
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
      console.log('🔄 AUTO-CONNECT: Enhanced initialization starting...');
      setConnectionProgress('📹 Inicializando câmera...');
      
      const stream = await media.initializeMedia();
      if (stream) {
        console.log('✅ AUTO-CONNECT: Media initialized, connecting to session...');
        setConnectionProgress('🔗 Conectando à sessão...');
        await connection.connectToSession(stream);
        setConnectionProgress('✅ Conectado com sucesso!');
      } else {
        console.warn('⚠️ AUTO-CONNECT: No media stream available, connecting without media');
        setConnectionProgress('🔗 Conectando sem câmera...');
        await connection.connectToSession();
      }
    } catch (error) {
      console.error('❌ AUTO-CONNECT: Failed:', error);
      setConnectionAttempts(prev => prev + 1);
      setConnectionProgress(`❌ Erro de conexão: ${error.message}`);
      
      // ENHANCED: Retry strategy with progressive delay
      if (connectionAttempts < 7) {
        const delay = 3000 + (connectionAttempts * 2000); // 3s, 5s, 7s, etc.
        console.log(`🔄 AUTO-CONNECT: Retrying in ${delay}ms...`);
        setTimeout(() => {
          autoConnectToSession();
        }, delay);
      }
      throw error;
    }
  };

  const handleConnect = async () => {
    try {
      setConnectionAttempts(prev => prev + 1);
      setConnectionProgress('🔄 Reconectando...');
      
      let stream = media.localStreamRef.current;
      if (!stream) {
        setConnectionProgress('📹 Reinicializando câmera...');
        stream = await media.initializeMedia();
      }
      
      setConnectionProgress('🔗 Conectando à sessão...');
      await connection.connectToSession(stream);
      setConnectionProgress('✅ Conectado com sucesso!');
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
      setConnectionProgress(`❌ Erro: ${error.message}`);
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

  // ENHANCED: Status display logic
  const getConnectionStatusColor = () => {
    if (connection.isConnected && webrtcState.webrtc === 'connected') return 'bg-green-100 text-green-800';
    if (signalingStatus === 'connecting' || webrtcState.webrtc === 'connecting') return 'bg-yellow-100 text-yellow-800';
    if (signalingStatus === 'connected' && webrtcState.webrtc === 'disconnected') return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getConnectionStatusText = () => {
    if (connection.isConnected && webrtcState.webrtc === 'connected') return 'Transmitindo';
    if (signalingStatus === 'connecting') return 'Conectando';
    if (signalingStatus === 'connected' && webrtcState.webrtc === 'connecting') return 'Conectando WebRTC';
    if (signalingStatus === 'connected') return 'WebRTC Pendente';
    return 'Desconectado';
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

        {/* ENHANCED: Connection status with WebRTC details */}
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Status da Conexão:</span>
            <span className={`text-sm px-2 py-1 rounded ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">{connectionProgress}</div>
          <div className="text-xs text-muted-foreground">
            WebSocket: {signalingStatus} | WebRTC: {webrtcState.webrtc} | Tentativas: {connectionAttempts}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Overall: {webrtcState.overall} | Stream: {media.localStreamRef.current ? 'Ativo' : 'Inativo'}
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

        {/* ENHANCED: Continuous connection status with detailed feedback */}
        {continuousConnection.isReconnecting && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-md">
            <p className="text-yellow-400 text-sm">
              🔄 Reconectando automaticamente... (tentativa {continuousConnection.reconnectAttempts})
            </p>
            <p className="text-yellow-300 text-xs mt-1">
              Sistema de conexão contínua ativo
            </p>
          </div>
        )}

        {/* ENHANCED: WebRTC Status Indicator */}
        {signalingStatus === 'connected' && webrtcState.webrtc === 'disconnected' && (
          <div className="mb-4 p-3 bg-orange-500/20 border border-orange-500/50 rounded-md">
            <p className="text-orange-400 text-sm">
              ⚠️ WebSocket conectado, mas WebRTC desconectado
            </p>
            <p className="text-orange-300 text-xs mt-1">
              Reconexão automática em andamento...
            </p>
          </div>
        )}

        {(connection.connectionStatus === 'failed' || connection.connectionStatus === 'disconnected') && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={continuousConnection.forceReconnect}
              disabled={continuousConnection.isReconnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {continuousConnection.isReconnecting ? 'Reconectando...' : 'Forçar Reconexão'}
            </button>
          </div>
        )}

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