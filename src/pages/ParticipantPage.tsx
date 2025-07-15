
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

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting render');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  
  // Use consistent participant ID based on session
  const [participantId] = useState(() => {
    const sessionKey = `participant-${sessionId}`;
    const storedId = sessionStorage.getItem(sessionKey);
    if (storedId) {
      console.log('🔑 PARTICIPANT: Using stored ID:', storedId);
      return storedId;
    }
    const newId = `participant-${Date.now().toString(36)}`;
    sessionStorage.setItem(sessionKey, newId);
    console.log('🔑 PARTICIPANT: Created new ID:', newId);
    return newId;
  });
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

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

  // Initialize media on mount (but don't auto-connect)
  useEffect(() => {
    console.log('🚀 PARTICIPANT PAGE: Initializing media for session:', sessionId);
    
    if (sessionId) {
      // Only initialize media, don't auto-connect
      media.initializeMedia().catch(error => {
        console.error('❌ PARTICIPANT: Failed to initialize media:', error);
      });
    }
    
    return () => {
      try {
        if (media.cleanup) {
          media.cleanup();
        }
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
      }
    };
  }, [sessionId]);

  const autoConnectToSession = async () => {
    try {
      const stream = await media.initializeMedia();
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
        // Update WebRTC with new stream
        await media.updateWebRTCStream(stream);
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
