import { detectMobile, waitForStableConditions } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobile();
  
  console.log(`🎬 VIDEO CRITICAL: Setting up video element (Mobile: ${isMobile})`);
  console.log(`🎬 VIDEO CRITICAL: Stream info:`, {
    streamId: stream.id,
    active: stream.active,
    videoTracks: stream.getVideoTracks().length,
    audioTracks: stream.getAudioTracks().length
  });
  
  // Clear any existing stream
  if (videoElement.srcObject) {
    console.log(`🧹 VIDEO CRITICAL: Clearing existing stream`);
    videoElement.srcObject = null;
  }
  
  // Configure video properties before setting stream
  console.log(`⚙️ VIDEO CRITICAL: Configuring video element properties`);
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.controls = false;
  
  // Additional mobile-specific settings
  if (isMobile) {
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
  }
  
  // Set the stream
  console.log(`📹 VIDEO CRITICAL: Setting srcObject`);
  videoElement.srcObject = stream;
  
  console.log(`📊 VIDEO CRITICAL: Video element state before play:`, {
    readyState: videoElement.readyState,
    paused: videoElement.paused,
    muted: videoElement.muted,
    autoplay: videoElement.autoplay,
    playsInline: videoElement.playsInline
  });
  
  try {
    // Wait a bit for the stream to be ready
    console.log(`⏳ VIDEO CRITICAL: Waiting for stable conditions`);
    await waitForStableConditions(100);
    
    console.log(`▶️ VIDEO CRITICAL: Attempting to play video`);
    await videoElement.play();
    console.log(`✅ VIDEO CRITICAL: Video play() successful (Mobile: ${isMobile})`);
    
    // Verify video is actually playing
    if (videoElement.paused) {
      console.warn(`⚠️ VIDEO CRITICAL: Video is still paused after play attempt`);
      throw new Error('Video failed to start playing');
    }
    
    console.log(`🎯 VIDEO CRITICAL: Final video state:`, {
      readyState: videoElement.readyState,
      paused: videoElement.paused,
      currentTime: videoElement.currentTime,
      duration: videoElement.duration,
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight
    });
    
  } catch (playError) {
    console.error(`❌ VIDEO CRITICAL: Video play failed (Mobile: ${isMobile}):`, playError);
    
    // Try again with user interaction simulation
    try {
      console.log(`🔄 VIDEO CRITICAL: Retrying video play after delay`);
      await waitForStableConditions(500);
      await videoElement.play();
      console.log(`✅ VIDEO CRITICAL: Video playing on retry`);
    } catch (retryError) {
      console.error(`❌ VIDEO CRITICAL: Video play failed on retry:`, retryError);
      throw retryError;
    }
  }
};