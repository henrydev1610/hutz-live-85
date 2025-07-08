import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobile, checkMediaDevicesSupport } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { setupVideoElement } from '@/utils/media/videoPlayback';
import { useMediaState } from './useMediaState';
import { useMediaControls } from './useMediaControls';

export const useParticipantMedia = () => {
  const mediaState = useMediaState();
  const {
    hasVideo,
    setHasVideo,
    hasAudio,
    setHasAudio,
    hasScreenShare,
    setHasScreenShare,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    localVideoRef,
    localStreamRef,
    screenStreamRef
  } = mediaState;

  const mediaControls = useMediaControls({
    localStreamRef,
    screenStreamRef,
    localVideoRef,
    isVideoEnabled,
    setIsVideoEnabled,
    isAudioEnabled,
    setIsAudioEnabled,
    hasScreenShare,
    setHasScreenShare
  });

  const initializeMedia = useCallback(async () => {
    const isMobile = detectMobile();
    
    try {
      console.log(`📹 MEDIA DEBUG: Starting initialization (Mobile: ${isMobile})`);
      
      // Clean up any existing stream first
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Verificar suporte a getUserMedia
      if (!checkMediaDevicesSupport()) {
        console.error('❌ MEDIA DEBUG: getUserMedia not supported');
        toast.error('Mídia não suportada neste navegador/dispositivo.');
        return null;
      }
      
      // Show loading state
      toast.info('Inicializando câmera...');
      
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        console.warn('⚠️ MEDIA: No stream obtained');
        toast.info('Continuando sem câmera/microfone.');
        return null;
      }

      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      console.log(`✅ MEDIA: Media initialized - Video: ${videoTracks.length}, Audio: ${audioTracks.length}`);
      
      if (localVideoRef.current && videoTracks.length > 0) {
        try {
          await setupVideoElement(localVideoRef.current, stream);
          toast.success('Câmera conectada com sucesso!');
        } catch (videoError) {
          console.error('❌ MEDIA: Video setup failed:', videoError);
          toast.warning('Mídia conectada, mas vídeo pode não estar visível');
        }
      } else {
        toast.success('Mídia conectada (sem vídeo)');
      }
      
      return stream;
    } catch (error) {
      console.error(`❌ MEDIA: Initialization failed:`, error);
      toast.error('Não foi possível acessar câmera/microfone');
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled]);

  return {
    hasVideo,
    hasAudio,
    hasScreenShare,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    localStreamRef,
    initializeMedia,
    ...mediaControls
  };
};