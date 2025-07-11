import { useCallback } from 'react';
import { toast } from "sonner";

interface UseMediaRetryProps {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  setHasVideo: (value: boolean) => void;
  setHasAudio: (value: boolean) => void;
  initializeMedia: () => Promise<MediaStream | null>;
}

export const useMediaRetry = ({
  localStreamRef,
  setHasVideo,
  setHasAudio,
  initializeMedia
}: UseMediaRetryProps) => {
  const retryMediaInitialization = useCallback(async () => {
    console.log('🔄 MEDIA: Retrying media initialization...');
    
    // Clean up previous stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Reset state
    setHasVideo(false);
    setHasAudio(false);
    
    try {
      const stream = await initializeMedia();
      return stream;
    } catch (error) {
      console.error('❌ MEDIA: Retry failed:', error);
      toast.error('Failed to retry media connection');
      throw error;
    }
  }, [initializeMedia, localStreamRef, setHasVideo, setHasAudio]);

  return { retryMediaInitialization };
};