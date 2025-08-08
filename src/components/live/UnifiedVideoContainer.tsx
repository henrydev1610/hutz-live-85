
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
  
  const containerId = `unified-video-${participant.id}`;
  const isMobile = participant.isMobile ?? detectMobileAggressively();
  
  // FASE 5: STATUS VISUAL EM TEMPO REAL
  const { 
    status, 
    statusText, 
    statusColor, 
    statusIcon, 
    isConnected, 
    hasActiveVideo 
  } = useRealTimeStatus({
    participantId: participant.id,
    hasVideo: participant.hasVideo,
    active: participant.active,
    stream
  });

  // FASE 1+3: AUTO-PLAY FORÇADO com detecção de ambiente Lovable
  useEffect(() => {
    const handleStreamReceived = (event: CustomEvent) => {
      const { participantId: receivedParticipantId, stream: receivedStream, isP1 } = event.detail;
      
      console.log(`🎬 FASE 1+3: AUTO-PLAY - Stream event para ${receivedParticipantId}`, {
        targetParticipant: participant.id,
        isForThisParticipant: receivedParticipantId === participant.id,
        isP1: isP1,
        hasStream: !!receivedStream,
        streamId: receivedStream?.id,
        isLovable: environmentDetector.isLovable(),
        requiresFallback: environmentDetector.requiresFallback()
      });
      
      if (receivedParticipantId === participant.id && receivedStream && containerRef.current) {
        console.log(`🎯 FASE 1+3: AUTO-PLAY FORÇADO para ${participant.id} ${isP1 ? '(P1)' : ''}`);
        
        setIsVideoReady(false);
        setError(null);
        
        // Limpar container existente
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        
        // FASE 1+3: Usar bridge do Lovable ou vídeo padrão baseado no ambiente
        if (environmentDetector.isLovable() && environmentDetector.requiresFallback()) {
          console.log(`🌉 LOVABLE BRIDGE: Usando canvas fallback para ${participant.id}`);
          
          // Iniciar bridge para converter stream em dados transferíveis
          lovableBridge.convertStreamToTransferable(participant.id, receivedStream);
          
          // Criar canvas renderer para exibir frames
          const canvas = lovableBridge.setupLovableVideoElement(containerRef.current, participant.id);
          if (canvas) {
            setIsVideoReady(true);
            console.log(`✅ LOVABLE BRIDGE: Canvas renderer ativo para ${participant.id}`);
            return;
          } else {
            console.warn(`⚠️ LOVABLE BRIDGE: Falha criando canvas, tentando vídeo padrão`);
          }
        }
        
        // FASE 1: Criar elemento de vídeo padrão (ambientes não-Lovable ou fallback)
        console.log(`🎥 VIDEO PADRÃO: Criando elemento de vídeo para ${participant.id}`);
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.controls = false;
        video.preload = 'metadata';
        video.className = 'w-full h-full object-cover absolute inset-0 z-10';
        video.style.cssText = `
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 10 !important;
          background: #000;
        `;
        
        // FASE 1: Tentar srcObject primeiro, fallback para ObjectURL
        try {
          video.srcObject = receivedStream;
          console.log(`✅ srcObject definido para ${participant.id}`);
        } catch (srcObjectError) {
          console.warn(`⚠️ srcObject falhou para ${participant.id}, tentando ObjectURL:`, srcObjectError);
          try {
            video.src = URL.createObjectURL(receivedStream);
            console.log(`✅ ObjectURL fallback para ${participant.id}`);
          } catch (urlError) {
            console.error(`❌ Ambos srcObject e ObjectURL falharam para ${participant.id}:`, urlError);
            setError('Falha configurando stream de vídeo');
            return;
          }
        }
        
        containerRef.current.appendChild(video);
        
        // FASE 1: Auto-play com retry automático e logs detalhados
        const attemptPlay = async (attempts = 0) => {
          try {
            console.log(`🎬 Tentativa ${attempts + 1} de play para ${participant.id}`);
            await video.play();
            console.log(`✅ FASE 1: Video playing (tentativa ${attempts + 1}) para ${participant.id}`);
            setIsVideoReady(true);
            setError(null);
          } catch (err) {
            console.log(`⚠️ FASE 1: Play falhou (tentativa ${attempts + 1}) para ${participant.id}:`, err);
            
            if (attempts < 5) { // Aumentado para 5 tentativas no Lovable
              // Retry com delay crescente
              setTimeout(() => attemptPlay(attempts + 1), (attempts + 1) * 1000);
            } else {
              console.error(`❌ FASE 1: Video play falhou após 5 tentativas para ${participant.id}`);
              setError('Falha na reprodução após 5 tentativas');
              
              // FASE 1: Última tentativa - forçar display mesmo sem play
              if (environmentDetector.isLovable()) {
                console.log(`🔄 LOVABLE FALLBACK: Forçando display do vídeo para ${participant.id}`);
                setIsVideoReady(true);
                setError(null);
              }
            }
          }
        };
        
        // Tentar play imediato + múltiplos delays para garantir
        attemptPlay();
        setTimeout(() => attemptPlay(), 500);
        setTimeout(() => attemptPlay(), 1500);  // Delay extra para Lovable
      }
    };

    const eventName = `stream-received-${participant.id}`;
    window.addEventListener(eventName, handleStreamReceived as EventListener);
    
    console.log(`🎧 FASE 4: Listening for ${eventName}`);
    
    return () => {
      window.removeEventListener(eventName, handleStreamReceived as EventListener);
      console.log(`🔇 FASE 4: Cleanup listener for ${eventName}`);
    };
  }, [participant.id]);

  // Main video creation effect
  useEffect(() => {
    if (!stream || !containerRef.current) {
      setIsVideoReady(false);
      return;
    }

    console.log(`🎯 UNIFIED CONTAINER: Creating video for ${participant.id}`, {
      isMobile,
      hasStream: !!stream,
      streamId: stream.id,
      active: participant.active
    });

    const createVideo = async () => {
      try {
        setError(null);
        setIsVideoReady(false);

        // Lovable fallback: usar canvas/bridge ao invés de <video>
        if (environmentDetector.isLovable() && environmentDetector.requiresFallback()) {
          console.log(`🌉 UNIFIED CONTAINER: Lovable fallback ativo para ${participant.id}`);

          // Limpar container existente
          while (containerRef.current!.firstChild) {
            containerRef.current!.removeChild(containerRef.current!.firstChild as Node);
          }

          // Iniciar captura/transferência e criar canvas renderer
          await lovableBridge.convertStreamToTransferable(participant.id, stream);
          const canvas = lovableBridge.setupLovableVideoElement(containerRef.current!, participant.id);
          if (canvas) {
            setIsVideoReady(true);
            console.log(`✅ UNIFIED CONTAINER: Canvas pronto para ${participant.id}`);
            return; // Não tentar criar <video>
          } else {
            console.warn(`⚠️ UNIFIED CONTAINER: Canvas não pôde ser criado, tentando <video>`);
          }
        }

        const videoElement = await createVideoElementUnified(
          containerRef.current!,
          stream,
          participant.id
        );

        if (videoElement) {
          setIsVideoReady(true);
          console.log(`✅ UNIFIED CONTAINER: Video ready for ${participant.id}`);
        } else {
          throw new Error('Failed to create video element');
        }
      } catch (err) {
        console.error(`❌ UNIFIED CONTAINER: Error creating video for ${participant.id}:`, err);
        setError(err instanceof Error ? err.message : 'Video creation failed');
      }
    };

    createVideo();

    return () => {
      // Cleanup específico do fallback Lovable
      if (environmentDetector.isLovable() && environmentDetector.requiresFallback()) {
        lovableBridge.cleanup(participant.id);
      }
    };
  }, [participant.id, stream, createVideoElementUnified, isMobile]);

  return (
    <div 
      className="participant-video aspect-video bg-gray-800/60 rounded-md overflow-hidden relative"
      id={containerId}
      data-participant-id={participant.id}
      style={{ 
        minHeight: '120px', 
        minWidth: '160px',
        backgroundColor: participant.hasVideo ? 'transparent' : 'rgba(55, 65, 81, 0.6)'
      }}
    >
      {/* Main video container */}
      <div ref={containerRef} className="w-full h-full relative" />
      
      {/* FASE 5: STATUS VISUAL EM TEMPO REAL - indicador unificado */}
      <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded z-30">
        <div className="flex items-center gap-1">
          <span>{statusIcon}</span>
          <span className={statusColor}>{statusText}</span>
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
