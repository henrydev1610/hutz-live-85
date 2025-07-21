
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { clearConnectionCache, validateURLConsistency } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting render with mobile-only validation');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // CRITICAL: Mobile-only guard - blocks desktop access
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true
  });
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  console.log('🎯 PARTICIPANT PAGE: Mobile guard:', { isMobile, isValidated, isBlocked });
  
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

  // URL consistency validation on mount
  useEffect(() => {
    console.log('🔍 PARTICIPANT PAGE: Validating URL consistency');
    clearConnectionCache();
    clearDeviceCache();
    
    const isConsistent = validateURLConsistency();
    if (!isConsistent) {
      console.warn('⚠️ PARTICIPANT PAGE: URL inconsistency detected');
    }
    
    // Mark as accessed via QR for mobile detection
    sessionStorage.setItem('accessedViaQR', 'true');
  }, []);

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

  // Auto-initialize media and connect ONLY for validated mobile devices
  useEffect(() => {
    if (!isValidated || isBlocked || !sessionId) {
      console.log('🚫 PARTICIPANT PAGE: Skipping auto-connect - not validated or blocked');
      return;
    }
    
    console.log('🚀 PARTICIPANT PAGE: Auto-initializing for MOBILE session:', sessionId);
    
    autoConnectToSession().catch(error => {
      console.error('❌ PARTICIPANT: Failed to auto-connect:', error);
    });
    
    return () => {
      try {
        media.cleanup();
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
      }
    };
  }, [sessionId, isValidated, isBlocked]);

  const autoConnectToSession = async () => {
    try {
      console.log('📱 PARTICIPANT: Starting mobile auto-connection with rear camera priority');
      const stream = await media.initializeMedia();
      
      // Log stream details for debugging
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          console.log('📱 PARTICIPANT: Stream settings:', {
            facingMode: settings.facingMode,
            width: settings.width,
            height: settings.height,
            deviceId: settings.deviceId
          });
        }
      }
      
      // Connect sempre, mesmo que stream seja null (modo degradado)
      await connection.connectToSession(stream);
    } catch (error) {
      console.error('❌ PARTICIPANT: Auto-connection failed:', error);
    }
  };

  const handleConnect = async () => {
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Connection blocked - not a mobile device');
      return;
    }
    
    try {
      let stream = media.localStreamRef.current;
      if (!stream) {
        console.log('📱 PARTICIPANT: Initializing mobile stream for manual connection');
        stream = await media.initializeMedia();
      }
      // Conectar sempre, mesmo que stream seja null (modo degradado)
      await connection.connectToSession(stream);
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connection failed:', error);
    }
  };

  const handleRetryMedia = async () => {
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Media retry blocked - not a mobile device');
      return;
    }
    
    try {
      console.log('🔄 PARTICIPANT: Retrying mobile media with rear camera priority');
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

  // Show loading screen while validating mobile access
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>🔒 Validando acesso móvel...</p>
        </div>
      </div>
    );
  }

  // Show blocked screen for desktop users (shouldn't reach here due to redirect, but safety net)
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
          <p className="text-lg mb-6">Esta página é exclusiva para dispositivos móveis.</p>
          <p className="text-sm opacity-75">Escaneie o QR Code com seu celular para participar.</p>
        </div>
      </div>
    );
  }

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
        
        {/* Mobile Debug Info */}
        {isMobile && (
          <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
            <p className="text-green-300 text-sm">
              ✅ Dispositivo móvel validado | Câmera traseira priorizada
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantPage;
