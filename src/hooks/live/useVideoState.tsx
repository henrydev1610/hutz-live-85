
import { useRef } from 'react';

interface VideoPlayState {
  isPlaying: boolean;
  playPromise: Promise<void> | null;
  retryCount: number;
  lastStreamId: string | null;
  element: HTMLVideoElement | null;
}

export const useVideoState = () => {
  const videoStatesRef = useRef(new Map<HTMLElement, VideoPlayState>());

  const getVideoState = (container: HTMLElement): VideoPlayState => {
    let videoState = videoStatesRef.current.get(container);
    if (!videoState) {
      videoState = {
        isPlaying: false,
        playPromise: null,
        retryCount: 0,
        lastStreamId: null,
        element: null
      };
      videoStatesRef.current.set(container, videoState);
    }
    return videoState;
  };

  const updateVideoState = (container: HTMLElement, updates: Partial<VideoPlayState>) => {
    const currentState = getVideoState(container);
    const newState = { ...currentState, ...updates };
    videoStatesRef.current.set(container, newState);
  };

  const resetVideoState = (container: HTMLElement) => {
    const state = getVideoState(container);
    updateVideoState(container, {
      isPlaying: false,
      playPromise: null,
      retryCount: 0,
      lastStreamId: null,
      element: null
    });
  };

  const clearAllStates = () => {
    console.log('🧹 CLEANUP: Cleaning up all video states');
    videoStatesRef.current.clear();
  };

  return {
    getVideoState,
    updateVideoState,
    resetVideoState,
    clearAllStates
  };
};
