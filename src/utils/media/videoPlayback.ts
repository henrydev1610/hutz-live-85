import { detectMobileAggressively } from './deviceDetection';

/**
 * FASE 1: Force unmute all video tracks in a stream
 */
export const forceUnmuteTracks = (stream: MediaStream, logPrefix: string = ''): void => {
  console.log(`🔧 FASE1 ${logPrefix} forceUnmuteTracks: Checking ${stream.getVideoTracks().length} video tracks`);
  
  stream.getVideoTracks().forEach((track, index) => {
    const wasDisabled = !track.enabled;
    const wasMuted = track.muted;
    
    // Force enable
    track.enabled = true;
    
    if (wasDisabled || wasMuted) {
      console.log(`✅ FASE1 ${logPrefix} Track ${index} force enabled`, {
        trackId: track.id,
        wasDisabled,
        wasMuted,
        nowEnabled: track.enabled,
        readyState: track.readyState
      });
    }
    
    // Add protective listeners
    track.onunmute = () => {
      console.log(`✅ FASE1 ${logPrefix} Track ${track.id} unmuted event`);
    };
    
    track.onmute = () => {
      console.warn(`⚠️ FASE1 ${logPrefix} Track ${track.id} muted! Auto re-enabling...`);
      setTimeout(() => {
        track.enabled = true;
      }, 100);
    };
  });
};

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobileAggressively();
  
  // FASE 1: Force unmute tracks before setup
  forceUnmuteTracks(stream, '[setupVideoElement]');
  
  console.log('📺 SETUP VIDEO: Starting video element setup', {
    isMobile,
    streamId: stream.id,
    streamActive: stream.active,
    videoTracks: stream.getVideoTracks().length
  });
  
  // Clear any existing stream first
  if (videoElement.srcObject) {
    console.log('📺 SETUP VIDEO: Clearing existing srcObject');
    videoElement.srcObject = null;
  }
  
  // Set new stream
  videoElement.srcObject = stream;
  
  // Ensure all necessary properties are set
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  
  try {
    console.log('📺 SETUP VIDEO: Attempting to play video...');
    await videoElement.play();
    console.log(`✅ SETUP VIDEO: Video playing successfully (Mobile: ${isMobile})`);
    
    // Verify video is actually playing
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      console.log(`✅ SETUP VIDEO: Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    } else {
      console.warn('⚠️ SETUP VIDEO: Video dimensions are 0x0 - may still be loading');
    }
    
  } catch (playError) {
    console.error(`❌ SETUP VIDEO: Play failed (Mobile: ${isMobile}):`, playError);
    
    // Force retry for mobile
    if (isMobile) {
      console.log('📱 SETUP VIDEO: Forcing mobile retry...');
      setTimeout(async () => {
        try {
          await videoElement.play();
          console.log('✅ SETUP VIDEO: Mobile retry successful');
        } catch (retryError) {
          console.error('❌ SETUP VIDEO: Mobile retry failed:', retryError);
        }
      }, 1000);
    }
  }
  
  // Add event listeners for debugging
  videoElement.addEventListener('loadedmetadata', () => {
    console.log('📺 VIDEO EVENT: Metadata loaded', {
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      duration: videoElement.duration
    });
  });
  
  videoElement.addEventListener('canplay', () => {
    console.log('📺 VIDEO EVENT: Can play');
  });
  
  videoElement.addEventListener('playing', () => {
    console.log('📺 VIDEO EVENT: Playing started');
  });
  
  videoElement.addEventListener('error', (error) => {
    console.error('📺 VIDEO EVENT: Error occurred', error);
  });
};