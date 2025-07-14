
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileCameraForcer } from '@/hooks/participant/useMobileCameraForcer';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting render');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();
  
  // 🚨 CRÍTICO: Forçar câmera mobile imediatamente
  const mobileCamera = useMobileCameraForcer();

  // Monitor signaling service status
  useEffect(() => {
    const checkSignalingStatus = () => {
      const status = unifiedWebSocketService.getConnectionStatus();
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
      // 4. Usar stream da câmera mobile se disponível, senão usar media padrão
      let stream = mobileCamera.stream;
      
      if (!stream) {
        console.log('📱 MOBILE CAMERA: No mobile stream, using default media');
        stream = await media.initializeMedia();
      } else {
        console.log('📱 MOBILE CAMERA: Using forced mobile stream for WebRTC');
      }
      
      // Conectar sempre, mesmo que stream seja null (modo degradado)
      await connection.connectToSession(stream);
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
      // Conectar sempre, mesmo que stream seja null (modo degradado)
      await connection.connectToSession(stream);
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
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

        {/* Connection Status Details */}
        <ParticipantConnectionStatus
          signalingStatus={signalingStatus}
          connectionStatus={connection.connectionStatus}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          onRetryMedia={handleRetryMedia}
        />

        {/* Mobile Camera Preview - Prioridade para mobile */}
        {mobileCamera.isMobile && (
          <div className="mb-6">
            <div className="bg-black/30 border border-white/10 rounded-lg p-4">
              <h3 className="text-white text-lg font-semibold mb-3">📱 Câmera Móvel (Forçada)</h3>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={mobileCamera.videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: 'black' }}
                />
                {!mobileCamera.hasStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-center text-white">
                      <p className="text-sm">Ativando câmera móvel...</p>
                      {mobileCamera.error && (
                        <p className="text-xs text-red-400 mt-1">{mobileCamera.error}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {mobileCamera.error && (
                <button 
                  onClick={mobileCamera.retryCamera}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  🔄 Tentar Novamente
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video Preview - Fallback para desktop ou debug */}
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
