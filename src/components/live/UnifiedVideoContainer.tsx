
import React, { useEffect, useRef, useState } from 'react';
import { Participant } from './ParticipantGrid';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { videoPlaybackEnforcer } from '@/utils/webrtc/VideoPlaybackEnforcer';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Criar <video> no primeiro mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || videoRef.current) return;
    
    const v = document.createElement('video');
    v.id = `unified-video-${participant.id}`;
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.style.width = '100%';
    v.style.height = '100%';
    v.style.objectFit = 'cover';
    
    el.appendChild(v);
    videoRef.current = v;
    
    // FASE 4: REGISTRAR NO VIDEO ENFORCER
    videoPlaybackEnforcer.registerVideo(v);
    
    console.log(`📦 VIDEO CREATED: Element created for ${participant.id}`, {
      videoId: v.id,
      container: el.id
    });
  }, [participant.id]);

  // 2. Aplicar srcObject e GARANTIR PLAYBACK
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) {
      if (!stream) {
        setIsVideoReady(false);
        setError(null);
      }
      return;
    }
    
    if (v.srcObject !== stream) {
      // FASE 3: VALIDAÇÃO DE STREAM ANTES DE APLICAR
      const videoTracks = stream.getVideoTracks();
      const hasActiveVideoTrack = videoTracks.some(track => 
        track.enabled && 
        track.readyState === 'live' && 
        !track.muted
      );
      
      if (!hasActiveVideoTrack) {
        console.warn(`⚠️ STREAM VALIDATION: No active video tracks for ${participant.id}`, {
          totalTracks: videoTracks.length,
          trackStates: videoTracks.map(t => ({
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            muted: t.muted
          }))
        });
        setError('Stream sem vídeo ativo');
        return;
      }

      v.srcObject = stream;
      setError(null);
      
      const handleLoadedMetadata = async () => {
        try {
          // FASE 1: GARANTIR PLAY AUTOMÁTICO APÓS METADATA
          console.log(`📊 METADATA LOADED: Starting playback for ${participant.id}`, {
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
            paused: v.paused,
            streamId: stream.id
          });

          if (v.paused) {
            console.log(`▶️ FORCING PLAY: Video was paused, attempting play for ${participant.id}`);
            
            // FASE 1: RETRY PLAY COM TIMEOUT
            let playRetries = 0;
            const maxRetries = 3;
            
            const attemptPlay = async () => {
              try {
                await v.play();
                console.log(`✅ PLAY SUCCESS: Video playing for ${participant.id} (retry ${playRetries})`);
                setIsVideoReady(true);
                
                // FASE 4: VERIFICAR SE REALMENTE ESTÁ TOCANDO
                setTimeout(() => {
                  if (v.paused) {
                    console.warn(`⚠️ STILL PAUSED: Video paused again for ${participant.id}, forcing play`);
                    v.play().catch(console.error);
                  }
                }, 1000);
                
              } catch (playError) {
                playRetries++;
                console.warn(`⚠️ PLAY FAILED: Retry ${playRetries}/${maxRetries} for ${participant.id}:`, playError);
                
                if (playRetries < maxRetries) {
                  setTimeout(attemptPlay, 500 * playRetries); // Exponential backoff
                } else {
                  console.error(`❌ PLAY FAILED: All retries failed for ${participant.id}`);
                  setError('Falha ao reproduzir vídeo');
                }
              }
            };
            
            await attemptPlay();
          } else {
            setIsVideoReady(true);
            console.log(`✅ ALREADY PLAYING: Video already playing for ${participant.id}`);
          }
        } catch (error) {
          console.error(`❌ METADATA ERROR: Failed to handle loadedmetadata for ${participant.id}:`, error);
          setError('Erro ao carregar vídeo');
        }
      };
      
      const handleError = (e: Event) => {
        setError('Erro ao reproduzir vídeo');
        setIsVideoReady(false);
        console.error(`❌ VIDEO ERROR: Error playing video for ${participant.id}:`, e);
      };

      // FASE 4: MONITORAMENTO DE PLAYBACK
      const handlePlay = () => {
        console.log(`▶️ PLAY EVENT: Video started playing for ${participant.id}`);
        setIsVideoReady(true);
      };

      const handlePause = () => {
        console.warn(`⏸️ PAUSE EVENT: Video paused for ${participant.id}, attempting resume`);
        // Auto-resume se pausar inesperadamente
        setTimeout(() => {
          if (v.paused && v.srcObject) {
            console.log(`🔄 AUTO-RESUME: Attempting to resume video for ${participant.id}`);
            v.play().catch(console.error);
          }
        }, 100);
      };
      
      v.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      v.addEventListener('error', handleError, { once: true });
      v.addEventListener('play', handlePlay);
      v.addEventListener('pause', handlePause);
      
      console.log(`🎥 STREAM APPLIED: srcObject set for ${participant.id}`, {
        streamId: stream.id,
        streamActive: stream.active,
        videoTracks: videoTracks.length,
        hasActiveTrack: hasActiveVideoTrack
      });

      // Cleanup listeners
      return () => {
        v.removeEventListener('play', handlePlay);
        v.removeEventListener('pause', handlePause);
      };
    }
  }, [stream, participant.id]);

  // Mobile detection for status display
  const isMobile = participant.isMobile ?? detectMobileAggressively();

  // Simple status determination
  const getStatus = () => {
    if (!participant.active) return { text: 'Aguardando', color: 'text-gray-400', icon: '⏳' };
    if (error) return { text: 'Erro', color: 'text-red-400', icon: '❌' };
    if (!stream) return { text: 'Conectado', color: 'text-green-400', icon: '🔗' };
    if (isVideoReady) return { text: 'Ativo', color: 'text-green-400', icon: '📹' };
    return { text: 'Carregando', color: 'text-yellow-400', icon: '⏳' };
  };

  const status = getStatus();

  // 3. Render com container standardizado
  return (
    <div
      id={`video-container-participant-${participant.id}`}
      ref={containerRef}
      data-video-container="true"
      data-participant-id={participant.id}
      className="relative w-full h-full overflow-hidden aspect-video bg-gray-800/60 rounded-md"
      style={{ minWidth: 160, minHeight: 120, backgroundColor: 'transparent' }}
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

export default UnifiedVideoContainer;
