import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobileAggressively, checkMediaDevicesSupport, setCameraPreference } from '@/utils/media/deviceDetection';
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
      
      // CRITICAL: Early stream registration BEFORE WebRTC init
      console.log(`🔗 EARLY REGISTRATION: Stream with WebRTC Manager:`, {
        streamId: stream.id,
        tracks: stream.getTracks().length
      });
      
      // Import and register stream immediately
      const webRTCManager = (await import('@/utils/webrtc/UnifiedWebRTCManager')).default;
      
      // ✅ AGUARDA ESTABILIZAÇÃO DO STREAM ANTES DE REGISTRAR (rule 1)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (webRTCManager.setOutgoingStream) {
        webRTCManager.setOutgoingStream(stream);
        console.log(`✅ Stream registered with WebRTC Manager after stabilization`);
      }
      
      // ✅ EMIT EVENTO STREAM-READY PARA O HOST (rule 1)
      console.log("📡 Stream do participante conectado", stream.getTracks());
      
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
        await setupVideoElement(localVideoRef.current, stream);
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
      
      // CRITICAL: Re-register new stream with WebRTC Manager
      console.log(`🔗 RE-REGISTERING new stream after camera switch:`, {
        streamId: newStream.id,
        tracks: newStream.getTracks().length
      });
      
      const webRTCManager = (await import('@/utils/webrtc/UnifiedWebRTCManager')).default;
      if (webRTCManager.setOutgoingStream) {
        webRTCManager.setOutgoingStream(newStream);
        console.log(`✅ New stream registered with WebRTC Manager`);
      }
      
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