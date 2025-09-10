
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Monitor } from "lucide-react";
import MediaDiagnostics from './MediaDiagnostics';
import { MobileCameraDebugger } from './MobileCameraDebugger';

interface ParticipantVideoPreviewProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  hasVideo: boolean;
  hasAudio: boolean;
  hasScreenShare: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  localStream?: MediaStream | null;
  onRetryMedia?: () => Promise<void>;
}

const ParticipantVideoPreview: React.FC<ParticipantVideoPreviewProps> = ({
  localVideoRef,
  hasVideo,
  hasAudio,
  hasScreenShare,
  isVideoEnabled,
  isAudioEnabled,
  localStream,
  onRetryMedia
}) => {
  const showDiagnostics = !hasVideo && !hasAudio;
  
  // FASE 1: CORRIGIR PREVIEW - Garantir elemento <video> correto com stream
  useEffect(() => {
    const setupCorrectVideoElement = async () => {
      if (!localVideoRef.current || !localStream) {
        console.log('🔍 [PREVIEW] Missing video ref or stream, skipping setup');
        return;
      }

      const video = localVideoRef.current;
      
      // CRITICAL: Verificar se stream está realmente ativo
      const videoTracks = localStream.getVideoTracks();
      const activeVideoTracks = videoTracks.filter(track => 
        track.readyState === 'live' && track.enabled && !track.muted
      );

      if (activeVideoTracks.length === 0) {
        console.warn('⚠️ [PREVIEW] No active video tracks, cannot setup preview');
        return;
      }

      console.log('🎬 [PREVIEW] Setting up video element with active stream', {
        streamId: localStream.id,
        activeVideoTracks: activeVideoTracks.length,
        totalTracks: videoTracks.length
      });

      // FASE 1: Configurar atributos OBRIGATÓRIOS antes de srcObject
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      video.controls = false;
      video.setAttribute('data-unified-video', 'true');
      video.setAttribute('data-participant-id', 'local-preview');

      // CRITICAL: Limpar srcObject anterior se existir
      if (video.srcObject && video.srcObject !== localStream) {
        console.log('🧹 [PREVIEW] Clearing old srcObject before setting new stream');
        video.srcObject = null;
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // FASE 1: Anexar stream IMEDIATAMENTE
      video.srcObject = localStream;

      // FASE 1: Forçar registro no VideoPlaybackEnforcer
      try {
        const { videoPlaybackEnforcer } = await import('@/utils/webrtc/VideoPlaybackEnforcer');
        videoPlaybackEnforcer.registerVideo(video);
        console.log('✅ [PREVIEW] Video manually registered with VideoPlaybackEnforcer');
      } catch (error) {
        console.warn('⚠️ [PREVIEW] Failed to register with VideoPlaybackEnforcer:', error);
      }

      // FASE 1: Retry robusto com logs detalhados
      const attemptPlay = async (retryCount = 0): Promise<boolean> => {
        try {
          console.log(`🎬 [PREVIEW] Play attempt ${retryCount + 1}...`);
          await video.play();
          
          // Verificar se realmente está reproduzindo
          const isActuallyPlaying = !video.paused && !video.ended && video.readyState > 2;
          
          if (isActuallyPlaying) {
            console.log('✅ [PREVIEW] Video playing successfully', { 
              streamId: localStream.id,
              paused: video.paused,
              ended: video.ended,
              readyState: video.readyState,
              attempt: retryCount + 1
            });

            // FASE 2: Notificar que preview está ativo via evento global
            window.dispatchEvent(new CustomEvent('participant-preview-active', {
              detail: {
                participantId: 'local-preview',
                streamId: localStream.id,
                videoElement: video,
                playing: true
              }
            }));

            return true;
          } else {
            throw new Error(`Video not actually playing: paused=${video.paused}, ended=${video.ended}, readyState=${video.readyState}`);
          }
        } catch (playError) {
          console.warn(`⚠️ [PREVIEW] Play attempt ${retryCount + 1} failed:`, playError);
          
          if (retryCount < 4) {
            const delay = Math.pow(2, retryCount) * 100; // 100ms, 200ms, 400ms, 800ms
            console.log(`🔄 [PREVIEW] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptPlay(retryCount + 1);
          } else {
            console.error('❌ [PREVIEW] All play attempts failed after 5 tries');
            return false;
          }
        }
      };

      const playSuccess = await attemptPlay();
      
      if (!playSuccess) {
        console.error('💀 [PREVIEW] Failed to start video preview - WebRTC may not work');
        
        // FASE 4: Notificar falha para sistema de recuperação
        window.dispatchEvent(new CustomEvent('participant-preview-failed', {
          detail: {
            participantId: 'local-preview',
            streamId: localStream.id,
            error: 'Failed to play video after retries'
          }
        }));
      }
    };

    setupCorrectVideoElement();
  }, [localStream, localVideoRef]);
  
  return (
    <>
      {/* Mobile Camera Debugger - Always available */}
      <MobileCameraDebugger
        localStream={localStream}
        onForceRetry={onRetryMedia}
        isVisible={true}
      />
      
      {showDiagnostics && onRetryMedia && (
        <MediaDiagnostics
          isVisible={true}
          onRetryMedia={onRetryMedia}
          hasVideo={hasVideo}
          hasAudio={hasAudio}
          stream={localStream || null}
        />
      )}
      
      <Card className="mb-6 bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Sua Transmissão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            controls={false}
            className="w-full h-full object-cover"
            style={{ backgroundColor: 'black' }}
            onLoadedMetadata={() => console.log('📺 [VIDEO] Metadata loaded')}
            onCanPlay={() => console.log('📺 [VIDEO] Can play')}
            onPlaying={() => console.log('📺 [VIDEO] Playing - frames flowing')}
            onPause={() => console.warn('⏸️ [VIDEO] Video paused - may cause muting')}
            onStalled={() => console.warn('🚫 [VIDEO] Video stalled')}
            onWaiting={() => console.warn('⏳ [VIDEO] Video waiting for data')}
            onError={(e) => console.error('❌ [VIDEO] Error:', e)}
            onEmptied={() => console.warn('🗑️ [VIDEO] Video emptied')}
            onSuspend={() => console.warn('⏹️ [VIDEO] Video suspended')}
          />
          
          {(!hasVideo || !isVideoEnabled) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center text-white">
                <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">
                  {!hasVideo ? 'Câmera não disponível' : 'Câmera desabilitada'}
                </p>
                {!hasVideo && !hasAudio && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Modo degradado - sem mídia local
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="absolute top-4 left-4 flex gap-2">
            {hasVideo && (
              <Badge variant={isVideoEnabled ? "default" : "destructive"}>
                {isVideoEnabled ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
              </Badge>
            )}
            {hasAudio && (
              <Badge variant={isAudioEnabled ? "default" : "destructive"}>
                {isAudioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
              </Badge>
            )}
            {hasScreenShare && (
              <Badge variant="default">
                <Monitor className="h-3 w-3" />
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
};

export default ParticipantVideoPreview;
