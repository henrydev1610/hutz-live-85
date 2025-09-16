
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
  
  // GARANTIR PREVIEW ESTÁVEL COM PLAYBACK FORÇADO
  useEffect(() => {
    const setupStablePreview = async () => {
      if (localVideoRef.current && localStream) {
        const video = localVideoRef.current;
        
        // Configurar atributos críticos para mobile
        video.playsInline = true;
        video.autoplay = true;
        video.muted = true;
        video.controls = false;
        
        // Anexar stream
        video.srcObject = localStream;
        
        try {
          // Forçar reprodução para evitar throttling
          await video.play();
          console.log('✅ [PREVIEW] Video playing successfully');
        } catch (playError) {
          console.warn('⚠️ [PREVIEW] Initial play failed, retrying...', playError);
          
          // Retry após breve delay
          setTimeout(async () => {
            try {
              await video.play();
              console.log('✅ [PREVIEW] Video playing on retry');
            } catch (retryError) {
              console.error('❌ [PREVIEW] Play retry failed:', retryError);
            }
          }, 500);
        }
        
        console.log('🎬 [PREVIEW] Video attached and configured:', {
          stream: localStream.id,
          tracks: localStream.getTracks().length,
          playing: !video.paused
        });
      }
    };

    setupStablePreview();
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
