import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimplifiedParticipantConnection } from '@/hooks/participant/useSimplifiedParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import { Card, CardContent } from '@/components/ui/card';

// Components
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';
import ConnectivityTestPanel from '@/components/debug/ConnectivityTestPanel';

const ParticipantPageSimplified = () => {
  console.log('🎯 FASE 3: Starting simplified participant page');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Mobile guard check
  const { isMobile, isBlocked } = useMobileOnlyGuard();
  
  // Participant ID generation
  const participantId = useRef(
    sessionStorage.getItem(`participant-id-${sessionId}`) || 
    `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  ).current;

  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showConnectivityTest, setShowConnectivityTest] = useState(false);

  // Enhanced media management  
  const media = useParticipantMedia(participantId);
  
  // Simplified connection management
  const connection = useSimplifiedParticipantConnection({
    sessionId,
    participantId
  });

  // FASE 3: Connect handler
  const handleConnect = useCallback(async () => {
    console.log('🎯 FASE 3: Handling connect request');
    
    const stream = media.localStreamRef.current;
    if (!stream) {
      console.log('🎥 FASE 3: No stream available, initializing media first');
      try {
        const newStream = await media.initializeMedia();
        if (newStream) {
          await connection.connectToSession(newStream);
        } else {
          console.warn('⚠️ FASE 3: Failed to initialize media, connecting without stream');
          await connection.connectToSession();
        }
      } catch (error) {
        console.error('❌ FASE 3: Media initialization failed:', error);
        await connection.connectToSession(); // Try connecting anyway
      }
    } else {
      console.log('📹 FASE 3: Using existing stream for connection');
      await connection.connectToSession(stream);
    }
  }, [connection, media]);

  // FASE 3: Retry handlers
  const handleRetryConnect = useCallback(async () => {
    console.log('🔄 FASE 3: Retry connect requested');
    const stream = media.localStreamRef.current;
    await connection.retryConnection(stream);
  }, [connection, media]);

  const handleRetryMedia = useCallback(async () => {
    console.log('🔄 FASE 3: Retry media requested');
    try {
      const newStream = await media.initializeMedia();
      if (newStream && !connection.isConnected) {
        await connection.connectToSession(newStream);
      }
    } catch (error) {
      console.error('❌ FASE 3: Media retry failed:', error);
    }
  }, [media, connection]);

  // FASE 3: Auto-initialization on mount
  useEffect(() => {
    if (sessionId && !isBlocked) {
      console.log('🚀 FASE 3: Auto-initializing media on mount');
      media.initializeMedia().catch(error => {
        console.warn('⚠️ FASE 3: Auto media initialization failed:', error);
      });
    }
  }, [sessionId, isBlocked, media]);

  // FASE 3: Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 FASE 3: Component cleanup');
      connection.disconnectFromSession();
      media.cleanup();
    };
  }, []);

  // Early returns for loading states
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-black/30 border-white/10">
          <CardContent className="p-8 text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-white/20 rounded mb-4"></div>
              <div className="h-4 bg-white/20 rounded mb-2"></div>
              <div className="h-4 bg-white/20 rounded w-3/4 mx-auto"></div>
            </div>
            <p className="text-white/70 mt-4">Verificando compatibilidade...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isBlocked && isMobile === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-black/30 border-white/10">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-bold text-white mb-4">
              Acesso Apenas no Desktop
            </h1>
            <p className="text-white/70 mb-6">
              Esta página é otimizada para uso em computadores desktop. 
              Por favor, acesse de um computador.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              Voltar ao Início
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-red-500/20 border-red-500/50">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-bold text-white mb-4">
              ID da Sessão Inválido
            </h1>
            <p className="text-white/70 mb-6">
              Não foi possível encontrar uma sessão válida.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              Voltar ao Início
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <ParticipantHeader 
          sessionId={sessionId || ''} 
          connectionStatus={connection.connectionStatus}
          signalingStatus={connection.signalingStatus}
          onBack={() => navigate('/')}
        />
        
        <ParticipantErrorDisplay
          error={connection.error}
          isConnecting={connection.isConnecting}
          onRetryConnect={handleRetryConnect}
          onRetryMedia={handleRetryMedia}
        />
        
        <ParticipantConnectionStatus
          signalingStatus={connection.signalingStatus}
          connectionStatus={connection.connectionStatus}
          hasVideo={media.hasVideo}
          hasAudio={media.hasAudio}
          onRetryMedia={handleRetryMedia}
        />
        
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
        
        <ParticipantInstructions />
        
        {/* FASE 5: Debug panel toggle */}
        <Card className="bg-black/20 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Debug Panels</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="px-3 py-1 bg-white/20 text-white text-xs rounded hover:bg-white/30 transition-colors"
                >
                  {showDebugPanel ? 'Ocultar' : 'Mostrar'} Debug
                </button>
                <button
                  onClick={() => setShowConnectivityTest(!showConnectivityTest)}
                  className="px-3 py-1 bg-white/20 text-white text-xs rounded hover:bg-white/30 transition-colors"
                >
                  {showConnectivityTest ? 'Ocultar' : 'Mostrar'} Conectividade
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FASE 5: Debug information */}
        {showDebugPanel && (
          <Card className="bg-black/30 border-green-500/50">
            <CardContent className="p-4">
              <h3 className="text-green-400 font-semibold mb-3">Debug Information</h3>
              <div className="space-y-2 text-sm font-mono">
                <p className="text-green-200">
                  🎯 SessionId: {sessionId?.substring(0, 20)}...
                </p>
                <p className="text-green-200">
                  👤 ParticipantId: {participantId.substring(0, 20)}...
                </p>
                <p className="text-green-200">
                  🔌 Connection: {connection.connectionStatus} ({connection.connectionAttempts}/{connection.maxAttempts})
                </p>
                <p className="text-green-200">
                  📡 Signaling: {connection.signalingStatus}
                </p>
                <p className="text-green-200">
                  📹 Video: {media.hasVideo ? '✅' : '❌'} ({media.isVideoEnabled ? 'ON' : 'OFF'})
                </p>
                <p className="text-green-200">
                  🎤 Audio: {media.hasAudio ? '✅' : '❌'} ({media.isAudioEnabled ? 'ON' : 'OFF'})
                </p>
                <p className="text-green-200">
                  📺 Stream: {media.localStreamRef.current ? 
                    `✅ ${media.localStreamRef.current.getVideoTracks().length}V/${media.localStreamRef.current.getAudioTracks().length}A` : 
                    '❌ No stream'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connectivity Test Panel */}
        {showConnectivityTest && (
          <div className="mt-6">
            <ConnectivityTestPanel 
              sessionId={sessionId || undefined} 
              participantId={participantId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantPageSimplified;