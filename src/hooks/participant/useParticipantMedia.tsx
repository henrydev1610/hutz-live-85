// (IMPORTS SEGUEM OS MESMOS)

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

  // 🔁 Função auxiliar para garantir que o WebRTCManager esteja pronto antes de usar
  const waitForWebRTCManager = async (maxWait = 1500, interval = 100) => {
    const { getWebRTCManager } = await import('@/utils/webrtc');
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const manager = getWebRTCManager();
      if (manager) return manager;
      await new Promise(res => setTimeout(res, interval));
    }
    return null;
  };

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

      console.log(`🎬 MEDIA: Stream obtained, waiting for WebRTCManager to be ready`, {
        streamId: stream.id,
        tracks: stream.getTracks().length
      });

      const webRTCManager = await waitForWebRTCManager();

      if (webRTCManager) {
        webRTCManager.setOutgoingStream(stream);
        console.log(`✅ FASE 1: Stream registered with correct singleton instance`);
        console.log("📡 Stream do participante conectado", stream.getTracks());
      } else {
        console.warn(`⚠️ FASE 1: WebRTC manager not available after waiting - stream will be registered later`);
      }

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);

      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, stream);
      }

      toast.success(`${isMobile ? '📱 Mobile' : '🖥️ Desktop'} camera connected! Video: ${videoTracks.length > 0 ? '✅' : '❌'}, Audio: ${audioTracks.length > 0 ? '✅' : '❌'}`);
      
      return stream;

    } catch (error) {
      console.error(`❌ MEDIA: Failed to initialize ${isMobile ? 'mobile' : 'desktop'} camera:`, error);
      toast.error(`Camera initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      setHasVideo(false);
      setHasAudio(false);
      return null;
    }
  }, [localVideoRef, localStreamRef, setHasVideo, setHasAudio, setIsVideoEnabled, setIsAudioEnabled]);

  const retryMediaInitialization = useCallback(async () => {
    console.log('🔄 MEDIA: Retrying media initialization...');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setHasVideo(false);
    setHasAudio(false);

    try {
      return await initializeMedia();
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      setCameraPreference(facing);
      const newStream = await getUserMediaWithFallback();

      if (!newStream) throw new Error(`Cannot access ${facing} camera`);

      localStreamRef.current = newStream;

      const webRTCManager = await waitForWebRTCManager();

      if (webRTCManager) {
        webRTCManager.setOutgoingStream(newStream);
        console.log(`✅ CAMERA SWITCH: New stream registered`);
      } else {
        console.warn(`⚠️ CAMERA SWITCH: WebRTC manager not available during switch`);
      }

      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();

      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      setIsVideoEnabled(videoTracks.length > 0);
      setIsAudioEnabled(audioTracks.length > 0);

      if (localVideoRef.current && videoTracks.length > 0) {
        await setupVideoElement(localVideoRef.current, newStream);
      }

      toast.success(`📱 ${facing === 'user' ? 'Front' : 'Back'} camera activated!`);
      return newStream;

    } catch (error) {
      console.error(`❌ CAMERA SWITCH: Failed to switch to ${facing}:`, error);
      toast.error(`Failed to switch camera: ${error instanceof Error ? error.message : String(error)}`);

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
