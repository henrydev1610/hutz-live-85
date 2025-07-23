
import { useCallback } from 'react';
import { toast } from "sonner";
import { detectMobileAggressively, checkMediaDevicesSupport, setCameraPreference } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { setupVideoElement } from '@/utils/media/videoPlayback';
import { streamLogger } from '@/utils/debug/StreamLogger';
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

  const generateParticipantId = useCallback(() => {
    return `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const initializeMedia = useCallback(async () => {
    const isMobile = detectMobileAggressively();
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const participantId = generateParticipantId();
    
    try {
      console.log(`🎬 MEDIA: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} camera initialization`);
      console.log(`🔒 HTTPS Check: ${window.location.protocol}`);
      console.log(`📱 User Agent: ${navigator.userAgent}`);
      
      // Log início via StreamLogger
      streamLogger.log(
        'STREAM_START' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0 },
        undefined,
        'MEDIA_INIT',
        'Media initialization started',
        { userAgent: navigator.userAgent, protocol: window.location.protocol }
      );
      
      if (!checkMediaDevicesSupport()) {
        const error = new Error('getUserMedia not supported');
        streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
        throw error;
      }
      
      const stream = await getUserMediaWithFallback(participantId);

      if (!stream) {
        console.log(`⚠️ MEDIA: No stream obtained, entering degraded mode`);
        
        streamLogger.log(
          'STREAM_ERROR' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0, errorType: 'NO_STREAM_DEGRADED_MODE' },
          undefined,
          'MEDIA_INIT',
          'No stream obtained, entering degraded mode'
        );
        
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
      
      // Log sucesso detalhado
      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, stream, 0);
      
      // Log WebRTC send
      streamLogger.logWebRTCSend(participantId, isMobile, deviceType, stream);
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      // Setup video element
      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, stream);
        
        // Log DOM update
        streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
      }
      
      const deviceType = isMobile ? '📱 Mobile' : '🖥️ Desktop';
      const videoStatus = videoTracks.length > 0 ? '✅' : '❌';
      const audioStatus = audioTracks.length > 0 ? '✅' : '❌';
      
      toast.success(`${deviceType} camera connected! Video: ${videoStatus}, Audio: ${audioStatus}`);
      
      return stream;
      
    } catch (error) {
      console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Camera initialization failed: ${errorMsg}`);
      
      setHasVideo(false);
      setHasAudio(false);
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, generateParticipantId]);

  const retryMediaInitialization = useCallback(async () => {
    const isMobile = detectMobileAggressively();
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const participantId = generateParticipantId();
    
    console.log('🔄 MEDIA: Retrying media initialization...');
    
    streamLogger.log(
      'STREAM_START' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'MEDIA_RETRY',
      'Media retry initialization started'
    );
    
    // Clean up previous stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_for_retry', track);
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    // Reset state
    setHasVideo(false);
    setHasAudio(false);
    
    try {
      const stream = await initializeMedia();
      
      if (stream) {
        streamLogger.log(
          'STREAM_SUCCESS' as any,
          participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0 },
          undefined,
          'MEDIA_RETRY',
          'Media retry successful'
        );
      }
      
      return stream;
    } catch (error) {
      console.error('❌ MEDIA: Retry failed:', error);
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      toast.error('Failed to retry media connection');
      throw error;
    }
  }, [initializeMedia, localStreamRef, setHasVideo, setHasAudio, generateParticipantId]);

  const switchCamera = useCallback(async (facing: 'user' | 'environment') => {
    const isMobile = detectMobileAggressively();
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const participantId = generateParticipantId();
    
    if (!isMobile) {
      streamLogger.log(
        'STREAM_ERROR' as any,
        participantId,
        isMobile,
        deviceType,
        { timestamp: Date.now(), duration: 0, errorType: 'CAMERA_SWITCH_NOT_MOBILE' },
        undefined,
        'CAMERA_SWITCH',
        'Camera switch attempted on non-mobile device'
      );
      
      toast.warning('Camera switching only available on mobile devices');
      return;
    }

    console.log(`📱 CAMERA SWITCH: Switching to ${facing} camera`);
    
    streamLogger.log(
      'STREAM_START' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'CAMERA_SWITCH',
      `Camera switch to ${facing} started`
    );
    
    try {
      // Stop current stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_for_switch', track);
          track.stop();
        });
        localStreamRef.current = null;
      }

      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
      }

      // Set new camera preference
      setCameraPreference(facing);
      
      // Get new stream with new camera
      const newStream = await getUserMediaWithFallback(participantId);
      
      if (!newStream) {
        const error = new Error(`Cannot access ${facing === 'user' ? 'front' : 'back'} camera`);
        streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
        throw error;
      }

      // Update state
      localStreamRef.current = newStream;
      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      streamLogger.logStreamSuccess(participantId, isMobile, deviceType, newStream, 0);
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);
      
      // Setup video element
      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, newStream);
        streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
      }
      
      toast.success(`📱 ${facing === 'user' ? 'Front' : 'Back'} camera activated!`);
      
      return newStream;
      
    } catch (error) {
      console.error(`❌ CAMERA SWITCH: Failed to switch to ${facing}:`, error);
      
      streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to switch camera: ${errorMsg}`);
      
      // Try to reinitialize
      try {
        await retryMediaInitialization();
      } catch (recoveryError) {
        console.error('❌ CAMERA SWITCH: Recovery also failed:', recoveryError);
        streamLogger.logStreamError(participantId, isMobile, deviceType, recoveryError as Error, 0);
      }
      
      throw error;
    }
  }, [localStreamRef, localVideoRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled, retryMediaInitialization, generateParticipantId]);

  const cleanup = useCallback(() => {
    const isMobile = detectMobileAggressively();
    const deviceType = isMobile ? 'mobile' : 'desktop';
    const participantId = generateParticipantId();
    
    console.log('🧹 MEDIA: Cleaning up media resources...');
    
    streamLogger.log(
      'VALIDATION' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'CLEANUP',
      'Media cleanup initiated'
    );
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'track_stopped_cleanup', track);
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        streamLogger.logTrackEvent(participantId, isMobile, deviceType, 'screen_track_stopped_cleanup', track);
        track.stop();
      });
      screenStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      streamLogger.logDOMUpdate(participantId, isMobile, deviceType, localVideoRef.current);
    }
    
    setHasVideo(false);
    setHasAudio(false);
    setHasScreenShare(false);
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
  }, [localStreamRef, screenStreamRef, localVideoRef, setHasVideo, setHasAudio, setHasScreenShare, setIsVideoEnabled, setIsAudioEnabled, generateParticipantId]);

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
    cleanup,
    ...mediaControls
  };
};
