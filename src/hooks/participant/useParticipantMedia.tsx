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
      console.log(`📹 MEDIA INIT: Starting ROBUST initialization (Mobile: ${isMobile})`);
      console.log(`📹 MEDIA INIT: User agent: ${navigator.userAgent}`);
      console.log(`📹 MEDIA INIT: Protocol: ${window.location.protocol}`);
      console.log(`📹 MEDIA INIT: Host: ${window.location.host}`);
      console.log(`📹 MEDIA INIT: Timestamp: ${new Date().toISOString()}`);
      
      // Verificação mais rigorosa de suporte
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ MEDIA INIT: getUserMedia not supported');
        throw new Error('getUserMedia não é suportado neste navegador/dispositivo');
      }
      
      if (!checkMediaDevicesSupport()) {
        console.error('❌ MEDIA INIT: Media devices support check failed');
        throw new Error('getUserMedia não suportado no dispositivo');
      }
      
      // Verificação detalhada de permissões no mobile
      if (isMobile) {
        console.log(`📱 MEDIA INIT: Mobile optimization starting...`);
        
        try {
          // Verificar permissões detalhadas
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          console.log(`📱 MEDIA INIT: Permissions - Camera: ${permissions.state}, Mic: ${micPermissions.state}`);
          
          // Se ambas as permissões estão negadas, informar o usuário
          if (permissions.state === 'denied' && micPermissions.state === 'denied') {
            console.warn('⚠️ MEDIA INIT: Both permissions denied, but trying anyway...');
            toast.warning('Permissões de câmera e microfone negadas. Tentando conectar mesmo assim...');
          }
        } catch (permError) {
          console.log(`📱 MEDIA INIT: Permission check failed, continuing:`, permError);
        }
        
        // Aguardar mais tempo no mobile para processamento de permissões
        console.log(`📱 MEDIA INIT: Waiting for mobile permission processing...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`🎬 MEDIA INIT: Calling getUserMediaWithFallback...`);
      let stream = await getUserMediaWithFallback();

      if (!stream) {
        console.log(`⚠️ MEDIA INIT: No stream obtained, trying intelligent recovery...`);
        
        // Tentar recuperação inteligente antes de modo degradado
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`🔄 MEDIA INIT: Retry attempt after delay...`);
        const retryStream = await getUserMediaWithFallback();
        
        if (!retryStream) {
          console.log(`⚠️ MEDIA INIT: Recovery failed, entering degraded mode`);
          
          // Modo degradado - sem mídia local
          setHasVideo(false);
          setHasAudio(false);
          
          toast.warning('🤖 Conectando em modo degradado (sem câmera/microfone). Você ainda pode participar da transmissão!', {
            duration: 5000
          });
          
          return null; // Permite conexão sem mídia
        } else {
          console.log(`✅ MEDIA INIT: Recovery successful!`);
          // Usar o stream da recuperação
          stream = retryStream;
        }
      }

      // Validação intensiva do stream
      if (!stream.getTracks || stream.getTracks().length === 0) {
        throw new Error('Stream inválido obtido');
      }

      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`🎉 MEDIA INIT: Stream analysis:`, {
        streamId: stream.id,
        active: stream.active,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoDetails: videoTracks.map(t => ({ 
          label: t.label, 
          kind: t.kind, 
          enabled: t.enabled, 
          readyState: t.readyState 
        })),
        audioDetails: audioTracks.map(t => ({ 
          label: t.label, 
          kind: t.kind, 
          enabled: t.enabled, 
          readyState: t.readyState 
        }))
      });
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      console.log(`✅ MEDIA INIT: State updated - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      // Configurar video element se disponível
      if (localVideoRef.current && videoTracks.length > 0) {
        console.log(`📺 MEDIA INIT: Setting up video element...`);
        await setupVideoElement(localVideoRef.current, stream);
        console.log(`📺 MEDIA INIT: Video element setup complete`);
      }
      
      // Toast de sucesso específico e detalhado
      const videoStatus = videoTracks.length > 0 ? '✅ SIM' : '❌ NÃO';
      const audioStatus = audioTracks.length > 0 ? '✅ SIM' : '❌ NÃO';
      
      if (isMobile) {
        toast.success(`📱 Câmera mobile CONECTADA! Video: ${videoStatus}, Áudio: ${audioStatus}`, {
          duration: 4000
        });
      } else {
        toast.success(`🖥️ Mídia desktop CONECTADA! Video: ${videoStatus}, Áudio: ${audioStatus}`, {
          duration: 4000
        });
      }
      
      return stream;
      
    } catch (error) {
      console.error(`❌ MEDIA INIT: CRITICAL FAILURE (Mobile: ${isMobile}):`, {
        error: error,
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (isMobile) {
        toast.error(`❌ Falha crítica na câmera mobile: ${errorMsg}. Tente atualizar a página ou verificar permissões.`, {
          duration: 6000
        });
      } else {
        toast.error(`❌ Falha crítica na mídia: ${errorMsg}`, {
          duration: 5000
        });
      }
      
      // Não fazer throw - permitir que a aplicação continue
      console.log(`🤷 MEDIA INIT: Allowing app to continue without media...`);
      setHasVideo(false);
      setHasAudio(false);
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled]);

  const retryMediaInitialization = useCallback(async () => {
    console.log('🔄 MEDIA: Retrying media initialization...');
    
    // Limpar stream anterior se existir
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Resetar estado
    setHasVideo(false);
    setHasAudio(false);
    
    try {
      const stream = await initializeMedia();
      return stream;
    } catch (error) {
      console.error('❌ MEDIA: Retry failed:', error);
      toast.error('Falha ao tentar reconectar mídia');
      throw error;
    }
  }, [initializeMedia, localStreamRef, setHasVideo, setHasAudio]);

  return {
    hasVideo,
    hasAudio,
    hasScreenShare,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    localStreamRef,
    initializeMedia,
    retryMediaInitialization,
    ...mediaControls
  };
};