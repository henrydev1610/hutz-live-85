import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobileAggressively, checkMediaDevicesSupport } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { setupVideoElement } from '@/utils/media/videoPlayback';
import { updateWebRTCStream } from '@/utils/webrtc';

interface UseMediaInitializationProps {
  localVideoRef: React.RefObject<HTMLVideoElement>;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  setHasVideo: (value: boolean) => void;
  setHasAudio: (value: boolean) => void;
  setIsVideoEnabled: (value: boolean) => void;
  setIsAudioEnabled: (value: boolean) => void;
}

export const useMediaInitialization = ({
  localVideoRef,
  localStreamRef,
  setHasVideo,
  setHasAudio,
  setIsVideoEnabled,
  setIsAudioEnabled
}: UseMediaInitializationProps) => {
  const initializeMedia = useCallback(async () => {
    const isMobile = detectMobileAggressively();
    
    try {
      console.log(`🎬 MEDIA: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} camera initialization`);
      console.log(`🔒 HTTPS Check: ${window.location.protocol}`);
      console.log(`📱 User Agent: ${navigator.userAgent}`);
      
      if (!checkMediaDevicesSupport()) {
        throw new Error('getUserMedia not supported');
      }
      
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        console.log(`⚠️ MEDIA: No stream obtained, entering degraded mode`);
        setHasVideo(false);
        setHasAudio(false);
        toast.warning('Connected in degraded mode (no camera/microphone)');
        return null;
      }

      localStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`✅ MEDIA: Stream obtained:`, {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        deviceType: isMobile ? 'MOBILE' : 'DESKTOP'
      });
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      // Setup video element
      if (localVideoRef.current && videoTracks.length > 0) {
        console.log('📺 MEDIA: Setting up local video preview with rear camera stream');
        await setupVideoElement(localVideoRef.current, stream);
        
        // Force video element to display camera correctly
        setTimeout(() => {
          if (localVideoRef.current) {
            console.log('📺 MEDIA: Forcing video play after setup');
            localVideoRef.current.play().catch(e => console.warn('Play retry failed:', e));
          }
        }, 500);
      }
      
      // CRITICAL: Update WebRTC connections with new stream
      try {
        console.log('🔄 MEDIA: Updating WebRTC connections with mobile camera stream');
        console.log('🎥 MEDIA: Stream to send:', {
          streamId: stream.id,
          active: stream.active,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });
        
        await updateWebRTCStream(stream);
        console.log('✅ MEDIA: WebRTC connections updated with mobile camera stream');
        
        // Force immediate stream validation
        setTimeout(() => {
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            console.log('🔍 MEDIA: Validating stream after WebRTC update:', {
              trackId: track.id,
              enabled: track.enabled,
              readyState: track.readyState,
              muted: track.muted
            });
          }
        }, 1000);
        
      } catch (webrtcError) {
        console.error('❌ MEDIA: CRITICAL - Failed to update WebRTC connections:', webrtcError);
        // This is critical - without this the stream won't be sent
        throw new Error(`WebRTC stream update failed: ${webrtcError.message}`);
      }
      
      const deviceType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
      const videoStatus = videoTracks.length > 0 ? '✅' : '❌';
      const audioStatus = audioTracks.length > 0 ? '✅' : '❌';
      
      toast.success(`${deviceType} camera connected! Video: ${videoStatus}, Audio: ${audioStatus}`);
      
      return stream;
      
    } catch (error) {
      console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Camera initialization failed: ${errorMsg}`);
      
      setHasVideo(false);
      setHasAudio(false);
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled]);

  return { initializeMedia };
};