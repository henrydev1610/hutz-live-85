
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

  const getUserMediaWithFallback = useCallback(async (): Promise<MediaStream | null> => {
    const constraintsList = [
      { video: true, audio: true },
      { video: true, audio: false },
      { video: { width: 640, height: 480, facingMode: 'user' }, audio: { echoCancellation: true } },
      { video: { width: 320, height: 240 }, audio: false },
      { video: false, audio: true }
    ];

    for (let i = 0; i < constraintsList.length; i++) {
      const constraints = constraintsList[i];
      try {
        console.log(`🎥 PARTICIPANT: Trying constraints ${i + 1}/${constraintsList.length}:`, constraints);
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia não é suportado neste navegador');
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ PARTICIPANT: Successfully obtained user media:', {
          tracks: stream.getTracks().map(t => ({ 
            kind: t.kind, 
            label: t.label, 
            enabled: t.enabled,
            readyState: t.readyState 
          }))
        });
        return stream;
      } catch (error) {
        console.error(`❌ PARTICIPANT: Constraints ${i + 1} failed:`, error);
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
            throw error;
          } else if (error.name === 'NotFoundError' && i === 0) {
            console.warn('⚠️ PARTICIPANT: No media devices found, trying fallback options...');
          }
        }
        
        if (i === constraintsList.length - 1) {
          throw error;
        }
      }
    }

    throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
  }, []);

  const initializeMedia = useCallback(async () => {
    try {
      console.log('📹 PARTICIPANT: Getting user media');
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        throw new Error('Falha ao obter stream de mídia');
      }

      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`✅ PARTICIPANT: Media obtained - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      if (localVideoRef.current && videoTracks.length > 0) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
          console.log('✅ PARTICIPANT: Local video playing');
        } catch (playError) {
          console.warn('⚠️ PARTICIPANT: Video play warning:', playError);
        }
      }
      
      return stream;
    } catch (error) {
      console.error('❌ PARTICIPANT: Media initialization failed:', error);
      throw error;
    }
  }, [getUserMediaWithFallback]);

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
        
        const stream = await getUserMediaWithFallback();
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
  }, [hasScreenShare, getUserMediaWithFallback]);

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
