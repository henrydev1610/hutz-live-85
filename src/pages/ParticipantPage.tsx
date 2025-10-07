import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import { useLiveKitRoom } from '@/hooks/live/useLiveKitRoom';
import { VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import StreamDebugPanel from '@/utils/debug/StreamDebugPanel';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Iniciando com LiveKit');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Mobile guard
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  
  // State management
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // LiveKit connection
  const {
    room,
    participants,
    isConnected,
    isConnecting,
    error,
    toggleVideo,
    toggleAudio,
    disconnect,
    localParticipant
  } = useLiveKitRoom({
    roomName: sessionId || '',
    userName: participantId,
    autoConnect: !isBlocked && isValidated
  });

  // Monitor connection status
  useEffect(() => {
    if (error) {
      setMediaError(error);
      toast.error(`Erro: ${error}`);
    }
  }, [error]);

  // Setup local video preview
  useEffect(() => {
    if (localVideoRef.current && localParticipant) {
      const videoPublication = Array.from(localParticipant.videoTrackPublications.values())[0];
      if (videoPublication && videoPublication.track) {
        const mediaStream = new MediaStream([videoPublication.track.mediaStreamTrack]);
        localVideoRef.current.srcObject = mediaStream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        localVideoRef.current.play().catch(err => {
          console.warn('⚠️ Erro ao reproduzir vídeo local:', err);
        });
      }
    }
  }, [localParticipant]);

  // Handler functions
  const handleRetryMedia = async () => {
    window.location.reload();
  };

  const handleStartCamera = async () => {
    window.location.reload();
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

  const connectionStatus = isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected';
  const hasVideo = localParticipant?.isCameraEnabled || false;
  const hasAudio = localParticipant?.isMicrophoneEnabled || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <ParticipantHeader
          sessionId={sessionId || ''}
          connectionStatus={connectionStatus}
          signalingStatus={isConnected ? 'connected' : 'disconnected'}
          onBack={() => navigate('/')}
        />

        {/* Error Display */}
        {mediaError && (
          <ParticipantErrorDisplay
            error={mediaError}
            isConnecting={isConnecting}
            onRetryConnect={handleRetryMedia}
          />
        )}

        {/* Connection Status */}
        <ParticipantConnectionStatus
          signalingStatus={isConnected ? 'connected' : 'disconnected'}
          connectionStatus={connectionStatus}
          hasVideo={hasVideo}
          hasAudio={hasAudio}
          onRetryMedia={handleRetryMedia}
        />

        {/* Video Preview - Local Stream */}
        <Card className="relative aspect-video bg-slate-800 overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
              <p className="text-white">📷 Câmera desativada</p>
            </div>
          )}
          
          {/* Status badges */}
          <div className="absolute top-2 right-2 flex gap-2">
            <span className={`px-2 py-1 rounded text-xs ${hasVideo ? 'bg-green-500' : 'bg-red-500'}`}>
              {hasVideo ? '📹 Vídeo' : '📹 Off'}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${hasAudio ? 'bg-green-500' : 'bg-red-500'}`}>
              {hasAudio ? '🎤 Áudio' : '🎤 Off'}
            </span>
          </div>
        </Card>

        {/* Controls */}
        <ParticipantControls
          hasVideo={hasVideo}
          hasAudio={hasAudio}
          hasScreenShare={false}
          isVideoEnabled={hasVideo}
          isAudioEnabled={hasAudio}
          isConnected={isConnected}
          isConnecting={isConnecting}
          connectionStatus={connectionStatus}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onToggleScreenShare={() => {}}
          onConnect={() => {}}
          onDisconnect={disconnect}
          mediaError={mediaError}
          onStartCamera={handleStartCamera}
          onRetryMedia={handleRetryMedia}
        />

        {/* Instructions */}
        <ParticipantInstructions />
        
        {/* LiveKit Status */}
        <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
          <p className="text-green-300 text-sm">
            ✅ Conectado via LiveKit SFU
          </p>
          <p className="text-green-200 text-xs mt-1">
            👥 Participantes na sala: {participants.length + 1}
          </p>
        </div>
        
        {/* Debug Info */}
        <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <p className="text-blue-300 text-xs">
            🌐 Backend: {import.meta.env.VITE_API_URL}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            🔧 Room: {sessionId}
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