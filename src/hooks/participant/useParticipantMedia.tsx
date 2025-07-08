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
      console.log(`📹 MEDIA DEBUG: User agent: ${navigator.userAgent}`);
      console.log(`📹 MEDIA DEBUG: Protocol: ${window.location.protocol}`);
      console.log(`📹 MEDIA DEBUG: Host: ${window.location.host}`);
      
      // Verificar suporte a getUserMedia ANTES de qualquer coisa
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ MEDIA DEBUG: getUserMedia not supported');
        toast.error('getUserMedia não é suportado neste navegador/dispositivo. Continuando sem mídia.');
        return null; // Allow app to continue without media
      }
      
      // No mobile, aguardar mais tempo e verificar permissões
      if (isMobile) {
        console.log(`📱 MEDIA DEBUG: Mobile detected, checking permissions...`);
        
        // Verificar permissões
        try {
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log(`📱 MEDIA DEBUG: Camera permission: ${permissions.state}`);
          
          const micPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log(`📱 MEDIA DEBUG: Microphone permission: ${micPermissions.state}`);
        } catch (permError) {
          console.log(`📱 MEDIA DEBUG: Permission check failed:`, permError);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar se getUserMedia está disponível
        if (!checkMediaDevicesSupport()) {
          toast.error('getUserMedia não suportado no dispositivo. Continuando sem mídia.');
          return null; // Allow app to continue without media
        }
      }
      
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        console.warn('⚠️ MEDIA: No stream obtained, continuing without media');
        toast.info('Continuando sem câmera/microfone. Você ainda pode participar da sessão.');
        return null;
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
      
      // Don't prevent app from working if media fails
      toast.info('Não foi possível acessar câmera/microfone. Continuando sem mídia.');
      console.log('🔄 MEDIA: Continuing without media access');
      
      return null; // Allow app to continue without media
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