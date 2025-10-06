import React, { useEffect, useRef, useState } from 'react';
import { Participant } from './ParticipantGrid';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { setupVideoElement } from '@/utils/media/videoPlayback';

interface VideoContainerProps {
  participant: Participant;
  index: number;
  stream?: MediaStream | null;
}

// COMPONENTE UNIFICADO - ÚNICA FONTE DE VERDADE PARA VÍDEOS
const VideoContainer: React.FC<VideoContainerProps> = ({
  participant,
  index,
  stream
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStreamId, setLastStreamId] = useState<string | null>(null);

  // ID ÚNICO PADRONIZADO para todo o sistema
  const containerId = `unified-video-container-${participant.id}`;
  const videoId = `unified-video-element-${participant.id}`;

  console.log(`🎭 VideoContainer render for ${participant.id}`, {
    containerId,
    videoId,
    hasStream: !!stream,
    streamId: stream?.id,
    isVideoReady,
    error
  });

  // Criar elemento de vídeo uma única vez
  useEffect(() => {
    if (!containerRef.current || videoRef.current) return;
    
    console.log(`📺 UNIFIED: Creating video element for ${participant.id}`);
    
    const video = document.createElement('video');
    video.id = videoId;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    video.disablePictureInPicture = true;
    video.className = 'w-full h-full object-cover';
    video.style.cssText = `
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 10 !important;
    `;
    
    // Mobile-specific attributes
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x-webkit-airplay', 'deny');
    
    containerRef.current.appendChild(video);
    videoRef.current = video;
    
    console.log(`✅ UNIFIED: Video element created for ${participant.id}`);
  }, [participant.id, videoId]);

  // FASE 4: Aplicar stream com validação adicional
  useEffect(() => {
    const video = videoRef.current;
    
    // FASE 4: Validação crítica
    if (!video) {
      console.warn(`⚠️ VideoContainer: Missing video ref for ${participant.id}`);
      return;
    }

    // Reset states when stream changes
    if (stream?.id !== lastStreamId) {
      console.log(`🔄 VideoContainer: Stream changed for ${participant.id}`, {
        oldStreamId: lastStreamId,
        newStreamId: stream?.id
      });
      setIsVideoReady(false);
      setError(null);
      setLastStreamId(stream?.id || null);
    }

    if (!stream) {
      console.log(`🚫 FASE 4: VideoContainer: No stream for ${participant.id}`, {
        participantId: participant.id,
        participantActive: participant.active,
        participantSelected: participant.selected,
        hasVideo: participant.hasVideo
      });
      video.srcObject = null;
      setIsVideoReady(false);
      return;
    }

    // FASE 4: Validar stream antes de aplicar
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn(`⚠️ VideoContainer: Stream has no video tracks for ${participant.id}`);
      setError('Stream sem vídeo');
      return;
    }

    // 🔧 CORREÇÃO: Remover validação prematura que bloqueia re-play
    // Mesmo se o stream já estiver atribuído, pode ser necessário forçar play
    if (video.srcObject === stream && !video.paused) {
      console.log(`✅ VideoContainer: Stream already playing for ${participant.id}`);
      return;
    }
    
    if (video.srcObject === stream && video.paused) {
      console.log(`⚠️ VideoContainer: Stream assigned but paused, will retry play for ${participant.id}`);
    }

    // FASE 3: Log detalhado de aplicação de stream
    console.log(`🎥 UNIFIED: Applying stream to ${participant.id}`, {
      streamId: stream.id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      videoEnabled: stream.getVideoTracks()[0]?.enabled,
      videoReadyState: stream.getVideoTracks()[0]?.readyState,
      videoMuted: stream.getVideoTracks()[0]?.muted,
      active: stream.active,
      videoElementId: video.id,
      currentSrcObject: video.srcObject ? 'has stream' : 'empty'
    });

    // 🔧 CORREÇÃO CRÍTICA: Atribuir stream ANTES de setupVideoElement
    console.log(`🔧 FIX: Assigning srcObject directly before setup for ${participant.id}`);
    video.srcObject = stream;
    console.log(`✅ FIX: srcObject assigned`, {
      participantId: participant.id,
      srcObjectAssigned: video.srcObject === stream,
      videoTracks: (video.srcObject as MediaStream)?.getVideoTracks().length,
      videoTrackEnabled: stream.getVideoTracks()[0]?.enabled,
      videoTrackLive: stream.getVideoTracks()[0]?.readyState === 'live'
    });

    // Apply stream using utility function
    setupVideoElement(video, stream)
      .then(() => {
        setIsVideoReady(true);  
        setError(null);
        console.log(`✅ UNIFIED: Video ready for ${participant.id}`, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          currentTime: video.currentTime
        });
        
        // Dispatch global event for synchronization
        window.dispatchEvent(new CustomEvent('video-ready', {
          detail: { participantId: participant.id, streamId: stream.id }
        }));
      })
      .catch((err) => {
        console.error(`❌ UNIFIED: Video setup failed for ${participant.id}:`, err);
        
        // 🔧 RETRY LOGIC: Tentar novamente após 1 segundo
        console.log(`🔄 RETRY: Will retry video setup for ${participant.id} in 1s`);
        setTimeout(() => {
          if (video.srcObject === stream && video.paused) {
            console.log(`🔄 RETRY: Attempting manual play for ${participant.id}`);
            video.play()
              .then(() => {
                console.log(`✅ RETRY: Manual play succeeded for ${participant.id}`);
                setIsVideoReady(true);
                setError(null);
              })
              .catch((retryErr) => {
                console.error(`❌ RETRY: Manual play failed for ${participant.id}:`, retryErr);
                setError('Erro ao reproduzir vídeo');
                setIsVideoReady(false);
              });
          }
        }, 1000);
        
        setError('Tentando reproduzir...');
        setIsVideoReady(false);
      });

  }, [stream, participant.id, lastStreamId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        console.log(`🧹 UNIFIED: Cleanup video for ${participant.id}`);
        const video = videoRef.current;
        video.srcObject = null;
        video.remove();
      }
    };
  }, [participant.id]);

  const isMobile = participant.isMobile ?? detectMobileAggressively();
  
  const getStatus = () => {
    if (!participant.active) return { text: 'Aguardando', color: 'text-gray-400', icon: '⏳' };
    if (error) return { text: 'Erro', color: 'text-red-400', icon: '❌' };
    if (!stream) return { text: 'Conectado', color: 'text-green-400', icon: '🔗' };
    if (isVideoReady) return { text: 'Ativo', color: 'text-green-400', icon: '📹' };
    return { text: 'Carregando', color: 'text-yellow-400', icon: '⏳' };
  };

  const status = getStatus();

  return (
    <div
      id={containerId}
      ref={containerRef}
      data-video-container="unified"
      data-participant-id={participant.id}
      className="relative w-full h-full overflow-hidden aspect-video bg-gray-800/60 rounded-md"
      style={{ minWidth: 160, minHeight: 120 }}
    >
      {/* Status indicator */}
      <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
        <div className="flex items-center gap-1">
          <span>{status.icon}</span>
          <span className={status.color}>{status.text}</span>
          {isMobile && <span>📱</span>}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 002 2v8a2 2 0 002 2z" />
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
      {participant.hasVideo && isVideoReady && (
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

export default VideoContainer;