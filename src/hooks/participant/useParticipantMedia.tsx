import { useMediaState } from './useMediaState';
import { useMediaControls } from './useMediaControls';
import { useMediaInitialization } from './useMediaInitialization';
import { useMediaRetry } from './useMediaRetry';
import { useCameraSwitching } from './useCameraSwitching';

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

  // Use focused hooks for media functionality
  const { initializeMedia } = useMediaInitialization({
    localVideoRef,
    localStreamRef,
    setHasVideo,
    setHasAudio,
    setIsVideoEnabled,
    setIsAudioEnabled
  });

  const { retryMediaInitialization } = useMediaRetry({
    localStreamRef,
    setHasVideo,
    setHasAudio,
    initializeMedia
  });

  const { switchCamera } = useCameraSwitching({
    localStreamRef,
    localVideoRef,
    setHasVideo,
    setHasAudio,
    setIsVideoEnabled,
    setIsAudioEnabled,
    retryMediaInitialization
  });

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
    switchCamera,
    ...mediaControls
  };
};