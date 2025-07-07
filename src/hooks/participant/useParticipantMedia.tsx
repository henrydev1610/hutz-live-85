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
      console.log(`📹 MEDIA: Initializing media (Mobile: ${isMobile})`);
      
      // No mobile, aguardar mais tempo e verificar permissões
      if (isMobile) {
        console.log(`📱 MEDIA: Mobile detected, waiting for device ready...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar se getUserMedia está disponível
        if (!checkMediaDevicesSupport()) {
          throw new Error('getUserMedia não suportado no dispositivo');
        }
      }
      
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        throw new Error('Falha ao obter stream de mídia');
      }

    localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`✅ MEDIA: Media initialized (Mobile: ${isMobile}) - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, stream);
      }
      
      // Mostrar toast de sucesso específico para mobile
      if (isMobile) {
        toast.success(`📱 Câmera mobile conectada! Video: ${videoTracks.length > 0 ? 'SIM' : 'NÃO'}, Áudio: ${audioTracks.length > 0 ? 'SIM' : 'NÃO'}`);
      }
      
      return stream;
    } catch (error) {
      console.error(`❌ MEDIA: Initialization failed (Mobile: ${isMobile}):`, error);
      
      if (isMobile) {
        toast.error('❌ Falha na inicialização da câmera mobile. Verifique as permissões do navegador.');
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