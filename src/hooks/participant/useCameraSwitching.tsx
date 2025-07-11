import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobileAggressively, setCameraPreference } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { setupVideoElement } from '@/utils/media/videoPlayback';

interface UseCameraSwitchingProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  setHasVideo: (value: boolean) => void;
  setHasAudio: (value: boolean) => void;
  setIsVideoEnabled: (value: boolean) => void;
  setIsAudioEnabled: (value: boolean) => void;
  retryMediaInitialization: () => Promise<MediaStream | undefined>;
}

export const useCameraSwitching = ({
  localStreamRef,
  localVideoRef,
  setHasVideo,
  setHasAudio,
  setIsVideoEnabled,
  setIsAudioEnabled,
  retryMediaInitialization
}: UseCameraSwitchingProps) => {
  const switchCamera = useCallback(async (facing: 'user' | 'environment') => {
    const isMobile = detectMobileAggressively();
    
    if (!isMobile) {
      toast.warning('Camera switching only available on mobile devices');
      return;
    }

    console.log(`📱 CAMERA SWITCH: Switching to ${facing} camera`);
    
    try {
      // Stop current stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Set new camera preference
      setCameraPreference(facing);
      
      // Get new stream with new camera
      const newStream = await getUserMediaWithFallback();
      
      if (!newStream) {
        throw new Error(`Cannot access ${facing === 'user' ? 'front' : 'back'} camera`);
      }

      // Update state
      localStreamRef.current = newStream;
      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      // Setup video element
      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, newStream);
      }
      
      toast.success(`📱 ${facing === 'user' ? 'Front' : 'Back'} camera activated!`);
      
      return newStream;
      
    } catch (error) {
      console.error(`❌ CAMERA SWITCH: Failed to switch to ${facing}:`, error);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to switch camera: ${errorMsg}`);
      
      // Try to reinitialize
      try {
        await retryMediaInitialization();
      } catch (recoveryError) {
        console.error('❌ CAMERA SWITCH: Recovery also failed:', recoveryError);
      }
      
      throw error;
    }
  }, [localStreamRef, localVideoRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, retryMediaInitialization]);

  return { switchCamera };
};