import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useParticipantConnection } from '@/hooks/participant/useParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';

// Importar handshake do participante para registrar listeners
import { participantHandshakeManager } from '@/webrtc/handshake/ParticipantHandshake';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import StreamDebugPanel from '@/utils/debug/StreamDebugPanel';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting with automatic media initialization (Teams/Meet style)');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // ENHANCED: Mobile-only guard with FORCE OVERRIDE support
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  console.log('🎯 PARTICIPANT PAGE: Enhanced mobile guard:', { isMobile, isValidated, isBlocked });
  
  // State management
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // PROPAGAÇÃO: participantId único passado para todos os hooks
  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia(participantId);

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

  // AUTOMATIC MEDIA INITIALIZATION (Teams/Meet style)
  const initParticipantMedia = async () => {
    try {
      // Check permissions proactively
      if (navigator.permissions) {
        try {
          const cameraStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
          const micStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
          console.log("📋 Permissions:", { camera: cameraStatus.state, mic: micStatus.state });
        } catch (permError) {
          console.log("⚠️ Could not check permissions:", permError);
        }
      }

      // List available devices for diagnostic
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("🎥 Devices available:", devices.map(d => ({ kind: d.kind, label: d.label.substring(0, 50) })));
      } catch (devError) {
        console.log("⚠️ Could not enumerate devices:", devError);
      }

      // Request media immediately (Teams/Meet style)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });

      if (!stream) {
        throw new Error("No stream obtained from getUserMedia");
      }

      // Connect to local preview
      if (media.localVideoRef.current) {
        media.localVideoRef.current.srcObject = stream;
        media.localVideoRef.current.muted = true;
        media.localVideoRef.current.playsInline = true;
        
        try {
          await media.localVideoRef.current.play();
          console.log("📹 Stream connected to local preview");
        } catch (playError) {
          console.warn("⚠️ Video play warning:", playError);
        }
      }

      // Update media state
      media.localStreamRef.current = stream;
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      // Adicionar validação de tracks de áudio
      console.log(`🎤 Audio tracks: ${audioTracks.length}, Video tracks: ${videoTracks.length}`);
      
      if (audioTracks.length === 0) {
        console.warn('⚠️ No audio tracks found in stream');
      }
      
      if (videoTracks.length === 0) {
        console.warn('⚠️ No video tracks found in stream');
      }

      // Verificar stream compartilhado globalmente
      const sharedStream = (window as any).__participantSharedStream;
      if (sharedStream) {
        const sharedAudioTracks = sharedStream.getAudioTracks();
        console.log(`🌐 Shared stream audio tracks: ${sharedAudioTracks.length}`);
      }
      
      // Share globally for WebRTC
      (window as any).__participantSharedStream = stream;
      
      // CORREÇÃO: Criar PeerConnection early para evitar race condition com ICE candidates
      console.log('🚀 [SYNC] Creating early PeerConnection before room join');
      participantHandshakeManager.createPeerConnectionEarly(stream, participantId);
      
      // Send tracks to WebRTC if connection exists
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            console.log(`✅ Track ready for WebRTC: ${track.kind}`);
          } catch (trackError) {
            console.warn(`⚠️ Could not prepare track:`, trackError);
          }
        });
      }

      // Connect to session
      await connection.connectToSession(stream);
      
      // CORREÇÃO: Enviar participant-ready após conexão estabelecida
      console.log('📢 [SYNC] Sending participant-ready after room join');
      participantHandshakeManager.sendParticipantReady();

      console.log("✅ Camera and microphone connected automatically");
      toast.success(`📱 Camera connected! Video: ${videoTracks.length > 0 ? '✅' : '❌'}, Audio: ${audioTracks.length > 0 ? '✅' : '❌'}`);

    } catch (err: any) {
      console.error("❌ Error initializing media:", err.name, err.message);

      if (err.name === "NotAllowedError") {
        console.log("❌ Permission denied. Camera/microphone access blocked.");
        toast.error("Permission denied. Please enable camera/microphone in your browser settings.");
      } else if (err.name === "NotFoundError") {
        console.log("❌ No camera/microphone devices found.");
        toast.error("No camera/microphone devices found on this device.");
      } else {
        console.log("❌ Error accessing camera/microphone:", err.message);
        toast.error("Error accessing camera/microphone. Please try again.");
      }
      
      // Set error state to show retry button
      setMediaError(err.name || 'UnknownError');
    }
  };

  // Manual retry function for error cases
  const handleStartCamera = async () => {
    setMediaError(null);
    await initParticipantMedia();
  };

  const handleRetryCamera = async () => {
    setMediaError(null);
    await initParticipantMedia();
  };

  // AUTO MEDIA INITIALIZATION: Start media immediately on page load (Teams/Meet style)
  useEffect(() => {
    if (!sessionId || isBlocked) {
      console.log('🚫 PARTICIPANT: Skipping auto-initialization - blocked or no session');
      return;
    }
    
    console.log('🚀 PARTICIPANT: Auto-initializing media (Teams/Meet style)');
    
    // Call automatic media initialization
    initParticipantMedia();
    
    return () => {
      try {
        media.cleanup();
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
      }
    };
  }, [sessionId, isBlocked, participantId]);

  // Handler functions
  const handleConnect = async () => {
    try {
      console.log('🔌 PARTICIPANT: Manual connect requested');
      
      // If no media, try to get it first
      if (!media.hasVideo && !media.hasAudio) {
        await media.initializeMediaAutomatically();
      }
      
      await connection.connectToSession(media.localStreamRef.current);
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual connect failed:', error);
      toast.error('Connection failed');
    }
  };

  const handleRetryMedia = async () => {
    try {
      console.log('🔄 PARTICIPANT: Media retry requested');
      await media.initializeMediaAutomatically();
    } catch (error) {
      console.error('❌ PARTICIPANT: Media retry failed:', error);
      toast.error('Media retry failed');
    }
  };

  const handleSwitchCamera = async () => {
    toast.info('Camera switching not available in automatic mode');
  };

  // Loading states
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-xl font-bold mb-4">Access Blocked</h2>
          <p className="text-white/80 mb-4">
            This page is only accessible from mobile devices via QR code.
          </p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary rounded-lg hover:bg-primary/80 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-xl font-bold mb-4">Validating...</h2>
          <p className="text-white/80">Checking device compatibility...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <ParticipantHeader
          sessionId={sessionId || ''}
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
          mediaError={mediaError}
          onStartCamera={handleStartCamera}
          onRetryMedia={handleRetryCamera}
        />

        {/* Instructions */}
        <ParticipantInstructions />
        
        {/* Enhanced Mobile Debug Info */}
        {isMobile && (
          <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
            <p className="text-green-300 text-sm">
              ✅ Automatic media initialization enabled (Teams/Meet style)
            </p>
            <p className="text-green-200 text-xs mt-1">
              📱 Mode: {sessionStorage.getItem('confirmedMobileCamera') || 
                        media.localStreamRef.current?.getVideoTracks()[0]?.getSettings()?.facingMode || 
                        'Detecting...'}
            </p>
          </div>
        )}
        
        {/* Enhanced URL Debug Info */}
        <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <p className="text-blue-300 text-xs">
            🌐 URL: {window.location.href.includes('hutz-live-85.onrender.com') ? '✅ Production' : '⚠️ Development'}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            🔧 Parameters: {new URLSearchParams(window.location.search).toString() || 'None'}
          </p>
          <p className="text-blue-100 text-xs mt-1">
            🐛 Debug: 
            <button 
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="ml-1 text-blue-400 hover:text-blue-300 underline"
            >
              {showDebugPanel ? 'Close' : 'Open'} Panel
            </button>
          </p>
        </div>
      </div>
      
      {/* Debug Panel */}
      <StreamDebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </div>
  );
};

export default ParticipantPage;