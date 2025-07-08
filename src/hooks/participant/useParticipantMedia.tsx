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
      console.log(`📹 MEDIA CRITICAL: Starting initialization (Mobile: ${isMobile})`);
      console.log(`📹 MEDIA CRITICAL: Current state:`, {
        hasVideo,
        hasAudio,
        isVideoEnabled,
        isAudioEnabled,
        hasExistingStream: !!localStreamRef.current
      });
      
      // Clean up any existing stream first
      if (localStreamRef.current) {
        console.log(`🧹 MEDIA CRITICAL: Cleaning up existing stream`);
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Reset states
      setHasVideo(false);
      setHasAudio(false);
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      
      // Verificar suporte a getUserMedia
      if (!checkMediaDevicesSupport()) {
        console.error('❌ MEDIA CRITICAL: getUserMedia not supported');
        toast.error('Mídia não suportada neste navegador/dispositivo.');
        return null;
      }
      
      // Show loading state
      toast.info('Inicializando câmera...');
      
      console.log(`🚀 MEDIA CRITICAL: About to call getUserMediaWithFallback`);
      const stream = await getUserMediaWithFallback();
      console.log(`🎯 MEDIA CRITICAL: getUserMediaWithFallback returned:`, stream);

      if (!stream) {
        console.warn('⚠️ MEDIA CRITICAL: No stream obtained');
        toast.warning('Continuando sem câmera/microfone.');
        return null;
      }

      console.log(`📦 MEDIA CRITICAL: Setting stream reference`);
      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`📊 MEDIA CRITICAL: Track counts:`, {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoDetails: videoTracks.map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled })),
        audioDetails: audioTracks.map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled }))
      });
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      console.log(`✅ MEDIA CRITICAL: State updated - Video: ${videoTracks.length}, Audio: ${audioTracks.length}`);
      
      if (localVideoRef.current && videoTracks.length > 0) {
        console.log(`🎬 MEDIA CRITICAL: Setting up video element`);
        try {
          await setupVideoElement(localVideoRef.current, stream);
          console.log(`✅ MEDIA CRITICAL: Video element setup successful`);
          toast.success('Câmera conectada com sucesso!');
        } catch (videoError) {
          console.error('❌ MEDIA CRITICAL: Video setup failed:', videoError);
          toast.warning('Mídia conectada, mas vídeo pode não estar visível');
        }
      } else {
        console.log(`ℹ️ MEDIA CRITICAL: No video element or no video tracks`);
        if (videoTracks.length === 0) {
          toast.warning('Mídia conectada (sem vídeo)');
        }
      }
      
      return stream;
    } catch (error) {
      console.error(`❌ MEDIA CRITICAL: Initialization failed:`, error);
      if (error instanceof Error) {
        console.error(`❌ MEDIA CRITICAL: Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      toast.error('Não foi possível acessar câmera/microfone');
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, hasVideo, hasAudio, isVideoEnabled, isAudioEnabled]);

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