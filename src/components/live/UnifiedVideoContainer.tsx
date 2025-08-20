
import React, { useEffect, useRef, useState } from 'react';
import { Participant } from './ParticipantGrid';
import { useUnifiedVideoCreation } from '@/hooks/live/useUnifiedVideoCreation';
import { useRealTimeStatus } from '@/hooks/live/useRealTimeStatus';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { lovableBridge } from '@/utils/LovableWebRTCBridge';
import { environmentDetector } from '@/utils/LovableEnvironmentDetector';

interface UnifiedVideoContainerProps {
  participant: Participant;
  index: number;
  stream?: MediaStream | null;
}

const UnifiedVideoContainer: React.FC<UnifiedVideoContainerProps> = ({
  participant,
  index,
  stream
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createVideoElementUnified } = useUnifiedVideoCreation();
  
  // ✅ ETAPA 3: CONTAINER COM MÚLTIPLOS IDs PADRONIZADOS
  const containerId = `video-container-${participant.id}`;
  const unifiedVideoId = `unified-video-${participant.id}`;
  
  // ✅ ETAPA 4: ENSURE CONTAINER HAS STANDARDIZED IDs
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.id = containerId;
      containerRef.current.setAttribute('data-participant-id', participant.id);
      containerRef.current.setAttribute('data-video-container', 'true');
      
      // Also add unified video ID as class for compatibility
      containerRef.current.classList.add(`unified-video-${participant.id}`);
      
      console.log(`📦 UNIFIED CONTAINER: IDs set for ${participant.id}`, {
        containerId,
        unifiedVideoId,
        hasRef: !!containerRef.current
      });
    }
  }, [participant.id, containerId, unifiedVideoId]);

  // ✅ ETAPA 1: ENHANCED VIDEO DISPLAY EVENT LISTENER
  useEffect(() => {
    const handleVideoDisplayReady = (event: CustomEvent) => {
      const { participantId, success, error } = event.detail;
      
      if (participantId === participant.id) {
        console.log(`🎥 UNIFIED CONTAINER: Video display event for ${participantId}`, { success, error });
        
        if (success) {
          setIsVideoReady(true);
          setError(null);
          console.log(`✅ UNIFIED CONTAINER: Video display ready for ${participant.id}`);
        } else {
          setError(error || 'Video display failed');
          console.error(`❌ UNIFIED CONTAINER: Video display failed for ${participant.id}:`, error);
        }
      }
    };

    // Listen for both event types for redundancy
    const eventTypes = ['video-display-ready', 'participant-stream-received'];
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleVideoDisplayReady as EventListener);
    });
    
    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleVideoDisplayReady as EventListener);
      });
    };
  }, [participant.id]);

  // ✅ ETAPA 4: MOBILE DETECTION WITH DEBUGGING
  const isMobile = participant.isMobile ?? detectMobileAggressively();
  
  // ✅ CORREÇÃO 4: STATUS VISUAL APRIMORADO - não mostrar "disconnected" durante negociação
  const [isNegotiating, setIsNegotiating] = useState(false);
  
  // CORREÇÃO CRÍTICA: Verificar tracks antes de marcar como "com vídeo"
  const [hasValidVideo, setHasValidVideo] = useState(false);
  
  useEffect(() => {
    const checkStreamTracks = async () => {
      if (!stream) {
        setHasValidVideo(false);
        return;
      }

      const { shouldProcessStream } = await import('@/utils/media/trackValidation');
      const isValid = shouldProcessStream(stream, participant.id);
      
      console.log(`🔍 UNIFIED CONTAINER: Verificação de tracks para ${participant.id}:`, {
        streamId: stream.id,
        isValid,
        trackCount: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        activeTracks: stream.getTracks().filter(t => t.readyState === 'live').length
      });
      
      setHasValidVideo(isValid);
    };

    checkStreamTracks();
  }, [stream, participant.id]);

  const { 
    status, 
    statusText, 
    statusColor, 
    statusIcon, 
    isConnected, 
    hasActiveVideo 
  } = useRealTimeStatus({
    participantId: participant.id,
    hasVideo: hasValidVideo, // Usar validação crítica em vez de participant.hasVideo
    active: participant.active,
    stream
  });

  // Override status during WebRTC negotiation
  const displayStatus = isNegotiating && status === 'disconnected' ? 'connecting' : status;
  const displayStatusText = isNegotiating && statusText === 'Desconectado' ? 'Negociando...' : statusText;
  const displayStatusColor = isNegotiating && statusColor === 'text-red-400' ? 'text-yellow-400' : statusColor;

  // ✅ CORREÇÃO 3: Monitor de negociação WebRTC
  useEffect(() => {
    const handleWebRTCNegotiation = (event: CustomEvent) => {
      const { participantId, state } = event.detail;
      if (participantId === participant.id) {
        console.log(`🔄 WEBRTC STATE: ${participantId} -> ${state}`);
        setIsNegotiating(state === 'negotiating' || state === 'connecting');
      }
    };

    window.addEventListener('webrtc-negotiation-state', handleWebRTCNegotiation as EventListener);
    return () => window.removeEventListener('webrtc-negotiation-state', handleWebRTCNegotiation as EventListener);
  }, [participant.id]);

  // ✅ CORREÇÃO 1: BRIDGE REATIVO - Stream disponível mas sem vídeo  
  useEffect(() => {
    if (!stream || !containerRef.current) return;
    
    // Verificar se já existe elemento de vídeo
    const existingVideo = containerRef.current.querySelector('video');
    if (existingVideo) return;
    
    console.log(`🎯 BRIDGE REATIVO: Stream disponível mas sem vídeo para ${participant.id}`, {
      streamId: stream.id.substring(0, 8),
      hasContainer: !!containerRef.current,
      containerId: containerRef.current?.id
    });
    
    // Aguardar um tick para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      
      // Disparar evento para StreamDisplayManager processar
      window.dispatchEvent(new CustomEvent('react-container-ready', {
        detail: {
          participantId: participant.id,
          stream,
          container: containerRef.current,
          timestamp: Date.now()
        }
      }));
      
      console.log(`✅ BRIDGE REATIVO: Evento disparado para ${participant.id}`);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [participant.id, stream]);

  // Video creation is now handled by the centralized StreamDisplayManager
  // This component handles display state, UI, and React-WebRTC bridge

  return (
    <div 
      className="participant-video aspect-video bg-gray-800/60 rounded-md overflow-hidden relative flex-1 w-full h-full max-w-full max-h-full"
      id={containerId}
      data-participant-id={participant.id}
      data-video-container="true"
      style={{ 
        minHeight: '80px', 
        minWidth: '120px',
        backgroundColor: hasValidVideo ? 'transparent' : 'rgba(55, 65, 81, 0.6)'
      }}
    >
      {/* ✅ ETAPA 3: MAIN VIDEO CONTAINER WITH MULTIPLE IDs FOR COMPATIBILITY */}
      <div 
        ref={containerRef} 
        id={unifiedVideoId}
        className="w-full h-full relative flex items-center justify-center"
        data-unified-video="true"
        style={{
          aspectRatio: '16/9',
          minHeight: 'inherit',
          minWidth: 'inherit'
        }}
      />
      
      {/* CORREÇÃO 4: STATUS VISUAL APRIMORADO - sem "disconnected" durante negociação */}
      <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
        <div className="flex items-center gap-1">
          <span>{statusIcon}</span>
          <span className={displayStatusColor}>{displayStatusText}</span>
          {isMobile && <span>📱</span>}
          {isNegotiating && <span className="animate-spin">⚙️</span>}
        </div>
      </div>
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-500/20">
          <div className="text-center text-white">
            <div className="text-xs">❌ Erro</div>
            <div className="text-xs opacity-75">{error}</div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {participant.active && stream && !isVideoReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-blue-500/20">
          <div className="text-center text-white">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div className="text-xs">
              {isMobile ? '📱 Conectando móvel...' : '💻 Conectando desktop...'}
            </div>
          </div>
        </div>
      )}
      
      {/* No stream state */}
      {participant.active && !stream && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-xs font-medium">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-green-400 mt-1">● Conectado</p>
            <p className="text-xs text-yellow-400 mt-1">Aguardando stream...</p>
          </div>
        </div>
      )}
      
      {/* Inactive participant */}
      {!participant.active && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/60">
          <div className="text-center text-white/40">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-xs">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-gray-500 mt-1">Aguardando</p>
          </div>
        </div>
      )}
      
      {/* Participant info overlay */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
        {participant.name || `P${index + 1}`}
      </div>
      
      {/* Video indicator */}
      {hasValidVideo && isVideoReady && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
        </div>
      )}
      
      {/* Connection status */}
      {participant.active && (
        <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-1 py-0.5 rounded z-20">
          ●
        </div>
      )}
    </div>
  );
};

export default UnifiedVideoContainer;
