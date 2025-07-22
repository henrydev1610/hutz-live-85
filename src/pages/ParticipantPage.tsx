
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
import { clearDeviceCache, validateMobileCameraCapabilities } from '@/utils/media/deviceDetection';
import { toast } from 'sonner';

const ParticipantPage = () => {
  console.log('🎯 PARTICIPANT PAGE: Starting MOBILE-FORCED render with ENHANCED camera validation');
  
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // ENHANCED: Mobile-only guard with FORCE OVERRIDE support
  const { isMobile, isValidated, isBlocked } = useMobileOnlyGuard({
    redirectTo: '/',
    allowDesktop: false,
    showToast: true,
    enforceQRAccess: true
  });
  
  console.log('🎯 PARTICIPANT PAGE: sessionId:', sessionId);
  console.log('🎯 PARTICIPANT PAGE: Enhanced mobile guard:', { isMobile, isValidated, isBlocked });
  
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  const connection = useParticipantConnection(sessionId, participantId);
  const media = useParticipantMedia();

  // Enhanced URL consistency validation with mobile override detection
  useEffect(() => {
    console.log('🔍 PARTICIPANT PAGE: Enhanced URL validation with FORCE OVERRIDE detection');
    clearConnectionCache();
    clearDeviceCache();
    
    const isConsistent = validateURLConsistency();
    if (!isConsistent) {
      console.warn('⚠️ PARTICIPANT PAGE: URL inconsistency detected - could affect camera');
    }
    
    // FASE 1: Enhanced parameter detection and storage
    const urlParams = new URLSearchParams(window.location.search);
    const forceMobile = urlParams.get('forceMobile') === 'true' || urlParams.get('mobile') === 'true';
    const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
    const hasCameraParam = urlParams.get('camera') === 'environment' || urlParams.get('camera') === 'user';
    const isParticipantRoute = window.location.pathname.includes('/participant/');
    
    // Store all mobile indicators
    if (forceMobile || hasQRParam || hasCameraParam || isParticipantRoute) {
      sessionStorage.setItem('accessedViaQR', 'true');
      sessionStorage.setItem('forcedMobile', 'true');
      sessionStorage.setItem('mobileValidated', 'true');
      
      console.log('✅ PARTICIPANT PAGE: Mobile FORCE OVERRIDE activated and stored');
      console.log('✅ Override indicators:', {
        forceMobile,
        hasQRParam,
        hasCameraParam,
        isParticipantRoute,
        cameraMode: urlParams.get('camera')
      });
      
      toast.success('📱 Modo móvel forçado - câmera do celular será ativada');
    }
    
    // Enhanced environment logging
    console.log('🌐 PARTICIPANT PAGE: Enhanced environment check:', {
      currentURL: window.location.href,
      expectedDomain: 'hutz-live-85.onrender.com',
      isDomainCorrect: window.location.href.includes('hutz-live-85.onrender.com'),
      forceParameters: {
        forceMobile,
        hasQR: hasQRParam,
        hasCameraParam,
        cameraMode: urlParams.get('camera'),
        isParticipantRoute
      },
      mobileOverrideActive: forceMobile || hasQRParam || hasCameraParam || isParticipantRoute
    });
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

  // ENHANCED: Auto-initialization with mobile camera validation
  useEffect(() => {
    if (!isValidated || isBlocked || !sessionId) {
      console.log('🚫 PARTICIPANT PAGE: Skipping auto-connect - mobile validation failed');
      return;
    }
    
    console.log('🚀 PARTICIPANT PAGE: MOBILE-FORCED auto-initializing for session:', sessionId);
    
    autoConnectToMobileSession().catch(error => {
      console.error('❌ PARTICIPANT: Failed to auto-connect mobile session:', error);
      toast.error('Falha ao conectar câmera móvel automaticamente');
    });
    
    return () => {
      try {
        media.cleanup();
      } catch (error) {
        console.error('❌ PARTICIPANT: Cleanup error:', error);
      }
    };
  }, [sessionId, isValidated, isBlocked]);

  const autoConnectToMobileSession = async () => {
    try {
      console.log('📱 PARTICIPANT: Starting MOBILE-FORCED auto-connection with camera validation');
      
      // FASE 3: Validate mobile camera capabilities first
      const hasValidCamera = await validateMobileCameraCapabilities();
      if (hasValidCamera) {
        console.log('✅ PARTICIPANT: Mobile camera capabilities validated');
        toast.success('📱 Câmera móvel validada - iniciando conexão');
      } else {
        console.log('⚠️ PARTICIPANT: Camera validation inconclusive - proceeding anyway');
        toast.warning('⚠️ Validação de câmera inconclusiva - tentando conectar');
      }
      
      // Force mobile camera initialization
      const stream = await media.initializeMedia();
      
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          console.log('📱 PARTICIPANT: Mobile camera stream verified:', {
            facingMode: settings.facingMode,
            width: settings.width,
            height: settings.height,
            deviceId: settings.deviceId?.substring(0, 20),
            isMobileCamera: settings.facingMode === 'environment' || settings.facingMode === 'user',
            isForced: sessionStorage.getItem('forcedMobile') === 'true'
          });
          
          // Validate we got mobile camera
          if (settings.facingMode) {
            console.log('✅ PARTICIPANT: MOBILE CAMERA CONFIRMED with facingMode:', settings.facingMode);
            toast.success(`📱 Câmera ${settings.facingMode === 'environment' ? 'traseira' : 'frontal'} ativada!`);
            
            // Store confirmed mobile camera
            sessionStorage.setItem('confirmedMobileCamera', settings.facingMode);
          } else {
            console.warn('⚠️ PARTICIPANT: Camera may not be mobile - no facingMode detected');
            toast.warning('⚠️ Câmera ativada mas tipo não confirmado');
          }
        }
      } else {
        console.warn('⚠️ PARTICIPANT: No stream obtained - entering degraded mode');
        toast.error('❌ Falha ao obter stream da câmera - modo degradado');
      }
      
      // Connect sempre, mesmo em modo degradado
      await connection.connectToSession(stream);
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Mobile auto-connection failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha na conexão móvel: ${errorMsg}`);
    }
  };

  const handleConnect = async () => {
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Connection blocked - mobile validation failed');
      toast.error('🚫 Conexão bloqueada - dispositivo não validado como móvel');
      return;
    }
    
    try {
      let stream = media.localStreamRef.current;
      if (!stream) {
        console.log('📱 PARTICIPANT: Initializing mobile camera for manual connection');
        toast.info('📱 Inicializando câmera móvel...');
        stream = await media.initializeMedia();
      }
      
      await connection.connectToSession(stream);
      toast.success('✅ Conectado com sucesso!');
    } catch (error) {
      console.error('❌ PARTICIPANT: Manual mobile connection failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha na conexão manual: ${errorMsg}`);
    }
  };

  const handleRetryMedia = async () => {
    if (isBlocked) {
      console.log('🚫 PARTICIPANT: Media retry blocked - mobile validation failed');
      toast.error('🚫 Retry bloqueado - dispositivo não validado como móvel');
      return;
    }
    
    try {
      console.log('🔄 PARTICIPANT: Retrying MOBILE camera with enhanced detection');
      toast.info('🔄 Tentando novamente câmera móvel...');
      
      const stream = await media.retryMediaInitialization();
      if (stream && connection.isConnected) {
        await connection.disconnectFromSession();
        await connection.connectToSession(stream);
        toast.success('✅ Câmera reconectada com sucesso!');
      }
    } catch (error) {
      console.error('❌ PARTICIPANT: Mobile media retry failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`❌ Falha ao tentar novamente: ${errorMsg}`);
    }
  };

  // Show loading screen while validating mobile access
  if (!isValidated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>🔒 Validando acesso móvel FORÇADO...</p>
          <p className="text-sm opacity-75 mt-2">Verificando parâmetros de força e câmera</p>
        </div>
      </div>
    );
  }

  // Show blocked screen for non-mobile users
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">📱🚫</div>
          <h1 className="text-2xl font-bold mb-4">Acesso Exclusivo Móvel</h1>
          <p className="text-lg mb-6">Esta página requer câmera móvel para funcionar corretamente.</p>
          <p className="text-sm opacity-75 mb-4">
            Escaneie o QR Code com seu <strong>celular</strong> para acessar a câmera.
          </p>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-yellow-200 text-xs">
              💡 A câmera do PC não é compatível com esta funcionalidade
            </p>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-200 text-xs">
              🔧 Para forçar acesso móvel, adicione ?forceMobile=true na URL
            </p>
          </div>
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
        
        {/* Enhanced Mobile Debug Info */}
        {isMobile && (
          <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
            <p className="text-green-300 text-sm">
              ✅ Dispositivo móvel FORÇADO | Câmera traseira priorizada
            </p>
            <p className="text-green-200 text-xs mt-1">
              📱 Modo: {sessionStorage.getItem('confirmedMobileCamera') || 
                        media.localStreamRef.current?.getVideoTracks()[0]?.getSettings()?.facingMode || 
                        'Detectando...'}
            </p>
            <p className="text-green-100 text-xs mt-1">
              🔧 Forçado: {sessionStorage.getItem('forcedMobile') === 'true' ? 'SIM' : 'NÃO'}
            </p>
          </div>
        )}
        
        {/* Enhanced URL Debug Info */}
        <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20">
          <p className="text-blue-300 text-xs">
            🌐 URL: {window.location.href.includes('hutz-live-85.onrender.com') ? '✅ Produção' : '⚠️ Desenvolvimento'}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            🔧 Parâmetros: {new URLSearchParams(window.location.search).toString() || 'Nenhum'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParticipantPage;
