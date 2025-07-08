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
      console.log(`📹 MEDIA: Starting initialization (Mobile: ${isMobile})`);
      
      // Verificar suporte básico
      if (!checkMediaDevicesSupport()) {
        throw new Error('getUserMedia não é suportado neste navegador');
      }
      
      // Aguardar um pouco para garantir que a página carregou
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Tentar obter stream
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        throw new Error('Falha ao obter stream de mídia');
      }

      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`✅ MEDIA: Media initialized - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, stream);
      }
      
      // Mostrar toast de sucesso
      const videoStatus = videoTracks.length > 0 ? 'SIM' : 'NÃO';
      const audioStatus = audioTracks.length > 0 ? 'SIM' : 'NÃO';
      toast.success(`Câmera conectada! Video: ${videoStatus}, Áudio: ${audioStatus}`);
      
      return stream;
    } catch (error) {
      console.error(`❌ MEDIA: Initialization failed:`, error);
      
      // Limpar estado em caso de erro
      setHasVideo(false);
      setHasAudio(false);
      
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast.error('Acesso negado. Clique no ícone de câmera na barra de endereços e permita o acesso.');
      } else {
        toast.error('Falha ao conectar câmera. Verifique suas permissões.');
      }
      
      throw error;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio]);

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