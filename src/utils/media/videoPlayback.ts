import { detectMobile, waitForStableConditions } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobile();
  
  // Clear any existing stream
  if (videoElement.srcObject) {
    videoElement.srcObject = null;
  }
  
  // Configure video properties before setting stream
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.controls = false;
  
  // Set the stream
  videoElement.srcObject = stream;
  
  try {
    // Wait a bit for the stream to be ready
    await waitForStableConditions(100);
    
    await videoElement.play();
    console.log(`✅ MEDIA: Local video playing (Mobile: ${isMobile})`);
    
    // Verify video is actually playing
    if (videoElement.paused) {
      console.warn(`⚠️ MEDIA: Video is still paused after play attempt`);
      throw new Error('Video failed to start playing');
    }
    
  } catch (playError) {
    console.warn(`⚠️ MEDIA: Video play failed (Mobile: ${isMobile}):`, playError);
    
    // Try again with user interaction simulation
    try {
      await waitForStableConditions(500);
      await videoElement.play();
      console.log(`✅ MEDIA: Video playing on retry`);
    } catch (retryError) {
      console.error(`❌ MEDIA: Video play failed on retry:`, retryError);
      throw retryError;
    }
  }
};