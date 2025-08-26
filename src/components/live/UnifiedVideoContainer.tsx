import React, { useEffect, useRef, useState } from 'react';
import { Participant } from './ParticipantGrid';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';

interface UnifiedVideoContainerProps {
  participant: Participant;
  index: number;
  stream?: MediaStream | null;
}

const MIN_OK_DIM = 32; // evita marcar ready com 2×2/1×1/0×0
const PLAY_RETRIES = 5;

const UnifiedVideoContainer: React.FC<UnifiedVideoContainerProps> = ({
  participant,
  index,
  stream
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [lowRes, setLowRes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // cria <video> uma única vez
  useEffect(() => {
    const el = containerRef.current;
    if (!el || videoRef.current) return;

    const v = document.createElement('video');
    v.id = `unified-video-${participant.id}`;
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    (v as any).disablePictureInPicture = true;
    v.controls = false;

    v.style.width = '100%';
    v.style.height = '100%';
    v.style.objectFit = 'cover';
    v.style.backgroundColor = 'black';

    el.appendChild(v);
    videoRef.current = v;

    console.log(`📦 VIDEO CREATED: Element created for ${participant.id}`, {
      videoId: v.id,
      container: el.id
    });

    return () => {
      try {
        v.srcObject = null;
        v.remove();
      } catch {}
      videoRef.current = null;
    };
  }, [participant.id]);

  // helper: tenta dar play com retry exponencial
  const ensurePlayback = async (v: HTMLVideoElement) => {
    let attempt = 0;
    while (attempt < PLAY_RETRIES) {
      try {
        await v.play();
        return true;
      } catch (e) {
        const wait = Math.min(1500 * Math.pow(1.4, attempt), 4000);
        console.warn(`⚠️ PLAY attempt ${attempt + 1} failed, retrying in ${Math.round(wait)}ms`, e);
        await new Promise(r => setTimeout(r, wait));
        attempt++;
      }
    }
    return false;
  };

  // valida resolução e controla estados
  const validateResolution = (v: HTMLVideoElement) => {
    const w = v.videoWidth || 0;
    const h = v.videoHeight || 0;

    const ok = w >= MIN_OK_DIM && h >= MIN_OK_DIM;
    const isTiny = (w <= 2 && h <= 2) || (w === 0 || h === 0);

    setLowRes(!ok);
    setIsVideoReady(ok);

    if (isTiny) {
      // dispara evento para outros módulos (DisplayManager/Handshake) poderem reagir
      window.dispatchEvent(new CustomEvent('host-low-res-detected', {
        detail: {
          participantId: participant.id,
          width: w,
          height: h,
          streamId: (stream && stream.id) || 'unknown'
        }
      }));
    }

    console.log(`📏 HOST VIDEO DIM: ${w}x${h} → ready=${ok} lowRes=${!ok}`);
  };

  // sonda watchdog: se ficar 2×2 por tempo, tenta novo play
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let watchdogTimer: number | null = null;

    const arm = () => {
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      watchdogTimer = window.setTimeout(async () => {
        // se ainda baixíssimo, tenta “cutucar” o player
        if (v.videoWidth <= 2 && v.videoHeight <= 2) {
          console.warn('⏱️ WATCHDOG: still 2×2, forcing play() retry');
          await ensurePlayback(v);
          validateResolution(v);
        }
      }, 3000);
    };

    arm();
    const onResize = () => { validateResolution(v); arm(); };
    const onPlaying = () => { validateResolution(v); arm(); };

    v.addEventListener('resize', onResize);
    v.addEventListener('playing', onPlaying);

    return () => {
      if (watchdogTimer) window.clearTimeout(watchdogTimer);
      v.removeEventListener('resize', onResize);
      v.removeEventListener('playing', onPlaying);
    };
    // não depende de stream aqui; monitor geral do elemento
  }, []);

  // aplica stream e listeners quando mudar
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    setError(null);
    setIsVideoReady(false);
    setLowRes(false);

    // cleanup de listeners antigos
    const handleLoadedMetadata = () => {
      console.log(`🎞️ loadedmetadata for ${participant.id}`);
      validateResolution(v);
    };
    const handleCanPlay = () => {
      console.log(`▶️ canplay for ${participant.id}`);
      validateResolution(v);
    };
    const handlePlaying = () => {
      console.log(`🎬 playing for ${participant.id}`);
      validateResolution(v);
    };
    const handleError = (e: Event) => {
      setError('Erro ao reproduzir vídeo');
      setIsVideoReady(false);
      console.error(`❌ VIDEO ERROR for ${participant.id}`, e);
    };

    // aplica/limpa srcObject
    if (!stream) {
      v.srcObject = null;
      return;
    }

    if (v.srcObject !== stream) {
      v.srcObject = stream;
      console.log(`🎥 STREAM APPLIED: srcObject set for ${participant.id}`, {
        streamId: stream.id,
        streamActive: stream.active
      });
    }

    // listeners
    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    v.addEventListener('canplay', handleCanPlay);
    v.addEventListener('playing', handlePlaying);
    v.addEventListener('error', handleError);

    // tenta tocar explicitamente
    (async () => {
      const ok = await ensurePlayback(v);
      if (!ok) {
        setError('Falha ao iniciar reprodução');
      } else {
        validateResolution(v);
      }
    })();

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      v.removeEventListener('canplay', handleCanPlay);
      v.removeEventListener('playing', handlePlaying);
      v.removeEventListener('error', handleError);
    };
  }, [stream, participant.id]);

  // Mobile detection para overlay
  const isMobile = participant.isMobile ?? detectMobileAggressively();

  // status simples
  const getStatus = () => {
    if (!participant.active) return { text: 'Aguardando', color: 'text-gray-400', icon: '⏳' };
    if (error) return { text: 'Erro', color: 'text-red-400', icon: '❌' };
    if (!stream) return { text: 'Conectado', color: 'text-green-400', icon: '🔗' };
    if (isVideoReady) return { text: 'Ativo', color: 'text-green-400', icon: '📹' };
    if (lowRes) return { text: 'Baixa resolução', color: 'text-yellow-400', icon: '🟨' };
    return { text: 'Carregando', color: 'text-yellow-400', icon: '⏳' };
  };

  const status = getStatus();

  return (
    <div
      id={`video-container-participant-${participant.id}`}
      ref={containerRef}
      data-video-container="true"
      data-participant-id={participant.id}
      className="relative w-full h-full overflow-hidden aspect-video bg-gray-800/60 rounded-md"
      style={{ minWidth: 160, minHeight: 120, backgroundColor: 'transparent' }}
    >
      {/* Status */}
      <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
        <div className="flex items-center gap-1">
          <span>{status.icon}</span>
          <span className={status.color}>{status.text}</span>
          {isMobile && <span>📱</span>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-500/20">
          <div className="text-center text-white">
            <div className="text-xs">❌ Erro</div>
            <div className="text-xs opacity-75">{error}</div>
          </div>
        </div>
      )}

      {/* Loading / Low-res */}
      {participant.active && stream && !isVideoReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-blue-500/10">
          <div className="text-center text-white">
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mx-auto mb-1" />
            <div className="text-xs">
              {lowRes
                ? '🔍 Aguardando resolução (evitando 2×2)…'
                : (isMobile ? '📱 Conectando móvel…' : '💻 Conectando desktop…')}
            </div>
          </div>
        </div>
      )}

      {/* No stream */}
      {participant.active && !stream && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-800/60">
          <div className="text-center text-white/70">
            <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-xs font-medium">{participant.name || `P${index + 1}`}</p>
            <p className="text-xs text-green-400 mt-1">● Conectado</p>
            <p className="text-xs text-yellow-400 mt-1">Aguardando stream…</p>
          </div>
        </div>
      )}

      {/* Inativo */}
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

      {/* Info participante */}
      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
        {participant.name || `P${index + 1}`}
      </div>

      {/* Indicador de vídeo */}
      {participant.hasVideo && isVideoReady && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
        </div>
      )}

      {/* Status de conexão */}
      {participant.active && (
        <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs px-1 py-0.5 rounded z-20">
          ●
        </div>
      )}
    </div>
  );
};

export default UnifiedVideoContainer;
