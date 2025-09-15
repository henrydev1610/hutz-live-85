import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimplifiedParticipantConnection } from '@/hooks/participant/useSimplifiedParticipantConnection';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useMobileOnlyGuard } from '@/hooks/useMobileOnlyGuard';
import { Card, CardContent } from '@/components/ui/card';
import { extractSessionId, getSessionIdErrorMessage, getSessionIdDebugInfo } from '@/utils/sessionIdParser';

// Components
import ParticipantHeader from '@/components/participant/ParticipantHeader';
import ParticipantErrorDisplay from '@/components/participant/ParticipantErrorDisplay';
import ParticipantConnectionStatus from '@/components/participant/ParticipantConnectionStatus';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import ParticipantControls from '@/components/participant/ParticipantControls';
import ParticipantInstructions from '@/components/participant/ParticipantInstructions';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting participant page');
  
  const { sessionId: rawSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // Validar e extrair sessionId limpo
  const sessionValidation = extractSessionId(rawSessionId);
  const sessionId = sessionValidation.sessionId;
  
  console.log('🔍 SESSION VALIDATION:', getSessionIdDebugInfo(sessionValidation));
  
  // Mobile guard check - permitir acesso de desktop também
  const { isMobile, isBlocked } = useMobileOnlyGuard({ allowDesktop: true });
  
  // Participant ID generation
  const participantId = useRef(
    sessionStorage.getItem(`participant-id-${sessionId}`) || 
    `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  ).current;

  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Enhanced media management  
  const media = useParticipantMedia(participantId);
  
  // Simplified connection management
  const connection = useSimplifiedParticipantConnection({
    sessionId,
    participantId
  });

  // Connect handler
  const handleConnect = useCallback(async () => {
    console.log('🎯 Handling connect request');
    
    const stream = media.localStreamRef.current;
    if (!stream) {
      console.log('🎥 No stream available, initializing media first');
      try {
        const newStream = await media.initializeMedia();
        if (newStream) {
          await connection.connectToSession(newStream);
        } else {
          console.warn('⚠️ Failed to initialize media, connecting without stream');
          await connection.connectToSession();
        }
      } catch (error) {
        console.error('❌ Media initialization failed:', error);
        await connection.connectToSession(); // Try connecting anyway
      }
    } else {
      console.log('📹 Using existing stream for connection');
      await connection.connectToSession(stream);
    }
  }, [connection, media]);

  // Retry handlers
  const handleRetryConnect = useCallback(async () => {
    console.log('🔄 Retry connect requested');
    const stream = media.localStreamRef.current;
    await connection.retryConnection(stream);
  }, [connection, media]);

  const handleRetryMedia = useCallback(async () => {
    console.log('🔄 Retry media requested');
    try {
      const newStream = await media.initializeMedia();
      if (newStream && !connection.isConnected) {
        await connection.connectToSession(newStream);
      }
    } catch (error) {
      console.error('❌ Media retry failed:', error);
    }
  }, [media, connection]);

  // Auto-initialization on mount
  useEffect(() => {
    if (sessionId && !isBlocked) {
      console.log('🚀 Auto-initializing media on mount');
      media.initializeMedia().catch(error => {
        console.warn('⚠️ Auto media initialization failed:', error);
      });
    }
  }, [sessionId, isBlocked, media]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component cleanup');
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

  if (!sessionValidation.isValid) {
    const errorMessage = getSessionIdErrorMessage(sessionValidation);
    const debugInfo = getSessionIdDebugInfo(sessionValidation);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 bg-red-500/20 border-red-500/50">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-bold text-white mb-4">
              ID da Sessão Inválido
            </h1>
            <p className="text-white/70 mb-4">
              {errorMessage}
            </p>
            
            {/* Debug info expandível */}
            <details className="mb-6 text-left">
              <summary className="text-white/50 text-sm cursor-pointer hover:text-white/70">
                Informações Técnicas
              </summary>
              <pre className="text-white/50 text-xs mt-2 bg-black/20 p-2 rounded overflow-auto">
                {debugInfo}
              </pre>
            </details>
            
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/')}
                className="w-full px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                Voltar ao Início
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                className="w-full px-6 py-2 bg-red-500/20 text-white rounded-lg hover:bg-red-500/30 transition-colors text-sm"
              >
                Tentar Novamente
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <ParticipantHeader 
          sessionId={sessionId} 
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
        
        {/* Debug panel toggle */}
        <Card className="bg-black/20 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm">Debug Panel</span>
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="px-3 py-1 bg-white/20 text-white text-xs rounded hover:bg-white/30 transition-colors"
              >
                {showDebugPanel ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Debug information */}
        {showDebugPanel && (
          <Card className="bg-black/30 border-green-500/50">
            <CardContent className="p-4">
              <h3 className="text-green-400 font-semibold mb-3">Debug Information</h3>
              <div className="space-y-2 text-sm font-mono">
                <p className="text-green-200">
                  🎯 SessionId: {sessionId.substring(0, 20)}...
                </p>
                <p className="text-green-200">
                  📝 Raw SessionId: {rawSessionId?.substring(0, 20)}...
                </p>
                <p className="text-green-200">
                  ✅ Valid: {sessionValidation.isValid ? 'YES' : 'NO'}
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
      </div>
    </div>
  );
};

export default ParticipantPage;