import { useState, useRef, useCallback } from 'react';
import { toast } from "sonner";

export const useParticipantMedia = () => {
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const detectMobile = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const getUserMediaWithMobileFallback = useCallback(async (): Promise<MediaStream | null> => {
    const isMobile = detectMobile();
    console.log(`📱 MEDIA: Initializing media for ${isMobile ? 'MOBILE' : 'DESKTOP'}`);

    // Configurações específicas para mobile com fallbacks agressivos
    const mobileConstraints = [
      // Tentativa 1: Configuração ideal para mobile
      {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      },
      // Tentativa 2: Configuração mais simples
      {
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        },
        audio: true
      },
      // Tentativa 3: Configuração mínima
      {
        video: {
          width: 320,
          height: 240
        },
        audio: true
      },
      // Tentativa 4: Só vídeo básico
      {
        video: true,
        audio: false
      },
      // Tentativa 5: Vídeo com facing mode environment (câmera traseira)
      {
        video: {
          facingMode: 'environment'
        },
        audio: false
      },
      // Tentativa 6: Só áudio
      {
        video: false,
        audio: true
      }
    ];

    // Configurações para desktop (mais flexíveis)
    const desktopConstraints = [
      { video: { facingMode: 'user' }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true }
    ];

    const constraintsList = isMobile ? mobileConstraints : desktopConstraints;

    for (let i = 0; i < constraintsList.length; i++) {
      const constraints = constraintsList[i];
      try {
        console.log(`🎥 MEDIA: Trying constraint ${i + 1}/${constraintsList.length} (Mobile: ${isMobile}):`, constraints);
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia não é suportado neste navegador');
        }

        // Aguardar um pouco no mobile para evitar problemas de timing
        if (isMobile && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log(`✅ MEDIA: Successfully obtained media (Mobile: ${isMobile}):`, {
          streamId: stream.id,
          tracks: stream.getTracks().map(t => ({ 
            kind: t.kind, 
            label: t.label, 
            enabled: t.enabled,
            readyState: t.readyState,
            constraints: t.getConstraints()
          }))
        });

        return stream;
      } catch (error) {
        console.error(`❌ MEDIA: Constraint ${i + 1} failed (Mobile: ${isMobile}):`, error);
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
            throw error;
          } else if (error.name === 'NotFoundError') {
            console.warn(`⚠️ MEDIA: Device not found with constraint ${i + 1}, trying next...`);
            if (i === 0 && isMobile) {
              toast.error('Câmera não encontrada. Tentando configurações alternativas...');
            }
          } else if (error.name === 'OverconstrainedError') {
            console.warn(`⚠️ MEDIA: Constraints too strict for constraint ${i + 1}, trying simpler...`);
          }
        }
        
        if (i === constraintsList.length - 1) {
          console.error(`❌ MEDIA: All constraints failed (Mobile: ${isMobile})`);
          if (isMobile) {
            toast.error('Não foi possível acessar a câmera do seu dispositivo. Verifique as permissões do navegador.');
          }
          throw error;
        }
      }
    }

    throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
  }, [detectMobile]);

  const initializeMedia = useCallback(async () => {
    const isMobile = detectMobile();
    
    try {
      console.log(`📹 MEDIA: Initializing media (Mobile: ${isMobile})`);
      
      // No mobile, aguardar um pouco para garantir que o DOM está pronto
      if (isMobile) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const stream = await getUserMediaWithMobileFallback();

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
        localVideoRef.current.srcObject = stream;
        try {
          // No mobile, configurar propriedades específicas do vídeo
          if (isMobile) {
            localVideoRef.current.playsInline = true;
            localVideoRef.current.muted = true;
            localVideoRef.current.autoplay = true;
          }
          
          await localVideoRef.current.play();
          console.log(`✅ MEDIA: Local video playing (Mobile: ${isMobile})`);
        } catch (playError) {
          console.warn(`⚠️ MEDIA: Video play warning (Mobile: ${isMobile}):`, playError);
          // No mobile, tentar forçar o play
          if (isMobile) {
            setTimeout(() => {
              localVideoRef.current?.play().catch(e => console.warn('Retry play failed:', e));
            }, 1000);
          }
        }
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
  }, [getUserMediaWithMobileFallback, detectMobile]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newEnabled = !isVideoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      
      setIsVideoEnabled(newEnabled);
      console.log(`PARTICIPANT: Video toggled: ${newEnabled ? 'ON' : 'OFF'}`);
    }
  }, [isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newEnabled = !isAudioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      
      setIsAudioEnabled(newEnabled);
      console.log(`PARTICIPANT: Audio toggled: ${newEnabled ? 'ON' : 'OFF'}`);
    }
  }, [isAudioEnabled]);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (hasScreenShare) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        const stream = await getUserMediaWithMobileFallback();
        if (stream) {
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
        
        setHasScreenShare(false);
        toast.success('Compartilhamento de tela interrompido');
        
      } else {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          
          screenStreamRef.current = screenStream;
          
          if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
              screenStream.addTrack(track);
            });
          }
          
          localStreamRef.current = screenStream;
          setHasScreenShare(true);
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }
          
          screenStream.getVideoTracks()[0].onended = () => {
            toggleScreenShare();
          };
          
          toast.success('Compartilhamento de tela iniciado');
          
        } catch (error) {
          console.error('PARTICIPANT: Error starting screen share:', error);
          toast.error('Erro ao iniciar compartilhamento de tela');
        }
      }
    } catch (error) {
      console.error('PARTICIPANT: Error toggling screen share:', error);
      toast.error('Erro ao alternar compartilhamento de tela');
    }
  }, [hasScreenShare, getUserMediaWithMobileFallback]);

  const cleanup = useCallback(() => {
    console.log('🧹 PARTICIPANT: Cleaning up media');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`PARTICIPANT: Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`PARTICIPANT: Stopped screen ${track.kind} track`);
      });
      screenStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  return {
    hasVideo,
    hasAudio,
    hasScreenShare,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    localStreamRef,
    initializeMedia,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    cleanup
  };
};
