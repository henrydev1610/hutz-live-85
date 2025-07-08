import { useCallback } from 'react';
import { toast } from "sonner";
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';

interface MediaControlsProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  screenStreamRef: React.MutableRefObject<MediaStream | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  setIsVideoEnabled: (enabled: boolean) => void;
  isAudioEnabled: boolean;
  setIsAudioEnabled: (enabled: boolean) => void;
  hasScreenShare: boolean;
  setHasScreenShare: (sharing: boolean) => void;
}

export const useMediaControls = ({
  localStreamRef,
  screenStreamRef,
  localVideoRef,
  isVideoEnabled,
  setIsVideoEnabled,
  isAudioEnabled,
  setIsAudioEnabled,
  hasScreenShare,
  setHasScreenShare
}: MediaControlsProps) => {
  
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
  }, [isVideoEnabled, localStreamRef, setIsVideoEnabled]);

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
  }, [isAudioEnabled, localStreamRef, setIsAudioEnabled]);

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
  }, [hasScreenShare, localStreamRef, screenStreamRef, localVideoRef, setHasScreenShare]);

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
  }, [localStreamRef, screenStreamRef, localVideoRef]);

  return {
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
    cleanup
  };
};