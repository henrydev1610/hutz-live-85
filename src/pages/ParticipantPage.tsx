
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
  
  // FASE 2: FORÇAR MOBILE ID
  const [participantId] = useState(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     'ontouchstart' in window ||
                     sessionStorage.getItem('accessedViaQR') === 'true';
    
    const baseId = `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const finalId = isMobile ? `mobile-${baseId}` : baseId;
    
    // Store mobile status
    if (isMobile) {
      sessionStorage.setItem('isMobile', 'true');
    }
    
    console.log(`📱 PARTICIPANT-MOBILE: Generated ID: ${finalId} (mobile: ${isMobile})`);
    return finalId;
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

  // FASE 1: FORÇAR SEQUÊNCIA CORRETA - Força câmera ativa ANTES da conexão WebRTC
  useEffect(() => {
    console.log('🚀 PARTICIPANT PAGE: Starting MOBILE-OPTIMIZED initialization for session:', sessionId);
    
    if (sessionId) {
      prepareStreamAndJoin().catch(error => {
        console.error('❌ PARTICIPANT: Failed to prepare and join:', error);
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

  const prepareStreamAndJoin = async () => {
    try {
      console.log('📱 MOBILE-CRITICAL: Preparing stream and joining session...');
      
      // PHASE 1: Force camera activation BEFORE any WebRTC connection
      console.log('🎥 MOBILE-CRITICAL: Initializing camera with mobile optimizations...');
      const stream = await media.initializeMedia();
      
      if (!stream) {
        console.warn('⚠️ MOBILE: No stream obtained, trying degraded connection...');
        await connection.connectToSession(null);
        return;
      }
      
      // PHASE 2: Validate stream is ready and stable
      console.log('🔍 MOBILE-CRITICAL: Validating stream stability...');
      const isStreamReady = await validateStreamReady(stream);
      
      if (!isStreamReady) {
        console.warn('⚠️ MOBILE: Stream not stable, retrying...');
        // Stop tracks and try again
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Stream not stable after validation');
      }
      
      // PHASE 3: Wait for mobile camera to stabilize (CRITICAL for mobile)
      console.log('⏳ MOBILE-CRITICAL: Waiting for camera stabilization...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // PHASE 4: Final validation before WebRTC
      const finalValidation = stream.active && 
                             stream.getTracks().length > 0 && 
                             stream.getTracks().every(track => track.readyState === 'live');
      
      if (!finalValidation) {
        throw new Error('Final stream validation failed');
      }
      
      console.log('✅ MOBILE-CRITICAL: Stream validated and ready, connecting WebRTC...');
      
      // PHASE 5: Connect to WebRTC ONLY after stream is 100% ready
      await connection.connectToSession(stream);
      
    } catch (error) {
      console.error('❌ MOBILE-CRITICAL: prepareStreamAndJoin failed:', error);
      
      // Retry once with clean slate
      setTimeout(async () => {
        console.log('🔄 MOBILE: Retrying with clean slate...');
        try {
          const retryStream = await media.retryMediaInitialization();
          if (retryStream) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for retry
            await connection.connectToSession(retryStream);
          }
        } catch (retryError) {
          console.error('❌ MOBILE: Retry also failed:', retryError);
        }
      }, 3000);
    }
  };

  const validateStreamReady = async (stream: MediaStream): Promise<boolean> => {
    console.log('🔍 MOBILE: Validating stream readiness...');
    
    if (!stream || !stream.active) {
      console.log('❌ MOBILE: Stream not active');
      return false;
    }
    
    const tracks = stream.getTracks();
    if (tracks.length === 0) {
      console.log('❌ MOBILE: No tracks in stream');
      return false;
    }
    
    // Check all tracks are live
    const allTracksLive = tracks.every(track => track.readyState === 'live');
    if (!allTracksLive) {
      console.log('❌ MOBILE: Not all tracks are live');
      return false;
    }
    
    // Additional validation: wait and check stability
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const stillActive = stream.active && tracks.every(track => track.readyState === 'live');
    console.log('✅ MOBILE: Stream validation result:', stillActive);
    
    return stillActive;
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
