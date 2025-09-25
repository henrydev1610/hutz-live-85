import { useEffect, useRef, useCallback } from 'react';

export const useMutedTrackTolerance = (
  track: MediaStreamTrack | null,
  onPersistentMute?: () => void,
  toleranceMs: number = 2000
) => {
  const muteTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMuted = useRef<boolean>(false);

  const handleTrackMute = useCallback(() => {
    if (!track) return;
    
    console.log(`🔇 [MUTE-TOLERANCE] Track ${track.kind} muted, starting tolerance timer`);
    isMuted.current = true;
    
    // Clear any existing timeout
    if (muteTimeout.current) {
      clearTimeout(muteTimeout.current);
    }
    
    // FASE 4: Tolerate track.muted for up to 2s
    muteTimeout.current = setTimeout(() => {
      if (isMuted.current && onPersistentMute) {
        console.warn(`⏰ [MUTE-TOLERANCE] Track ${track.kind} muted for ${toleranceMs}ms, triggering recovery`);
        onPersistentMute();
      }
    }, toleranceMs);
  }, [track, onPersistentMute, toleranceMs]);

  const handleTrackUnmute = useCallback(() => {
    if (!track) return;
    
    console.log(`🔊 [MUTE-TOLERANCE] Track ${track.kind} unmuted, clearing tolerance timer`);
    isMuted.current = false;
    
    if (muteTimeout.current) {
      clearTimeout(muteTimeout.current);
      muteTimeout.current = null;
    }
  }, [track]);

  useEffect(() => {
    if (!track) return;

    track.addEventListener('mute', handleTrackMute);
    track.addEventListener('unmute', handleTrackUnmute);

    return () => {
      track.removeEventListener('mute', handleTrackMute);
      track.removeEventListener('unmute', handleTrackUnmute);
      
      if (muteTimeout.current) {
        clearTimeout(muteTimeout.current);
        muteTimeout.current = null;
      }
    };
  }, [track, handleTrackMute, handleTrackUnmute]);

  return {
    isMuted: isMuted.current,
    clearTolerance: () => {
      if (muteTimeout.current) {
        clearTimeout(muteTimeout.current);
        muteTimeout.current = null;
      }
      isMuted.current = false;
    }
  };
};