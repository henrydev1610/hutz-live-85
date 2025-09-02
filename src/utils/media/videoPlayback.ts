import { detectMobileAggressively } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobileAggressively();
  
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
  
  // Enhanced autoplay configuration for muted tracks
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  videoElement.controls = false;
  
  // Force video properties for better compatibility
  if (isMobile) {
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('playsinline', 'true');
  }
  
  try {
    console.log('📺 SETUP VIDEO: Attempting to play video...');
    await videoElement.play();
    console.log(`✅ SETUP VIDEO: Video playing successfully (Mobile: ${isMobile})`);
    
    // Verify video is actually playing
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      console.log(`✅ SETUP VIDEO: Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    } else {
      console.warn('⚠️ SETUP VIDEO: Video dimensions are 0x0 - may still be loading');
      
      // Retry after tracks potentially unmute
      setTimeout(async () => {
        if (videoElement.videoWidth === 0 && videoElement.videoHeight === 0) {
          try {
            await videoElement.play();
            console.log('🔄 SETUP VIDEO: Delayed retry after track unmute successful');
          } catch (delayedError) {
            console.warn('⚠️ SETUP VIDEO: Delayed retry failed, may need user interaction');
          }
        }
      }, 2000);
    }
    
  } catch (playError) {
    console.error(`❌ SETUP VIDEO: Play failed (Mobile: ${isMobile}):`, playError);
    
    // Enhanced error handling with specific warnings
    if (playError instanceof DOMException) {
      if (playError.name === 'NotAllowedError') {
        console.warn('⚠️ SETUP VIDEO: Autoplay bloqueado pelo navegador - aguardando interação do usuário');
        console.warn('💡 SETUP VIDEO: O vídeo será reproduzido após o usuário interagir com a página');
      } else if (playError.name === 'AbortError') {
        console.warn('⚠️ SETUP VIDEO: Reprodução abortada - tracks podem estar muted');
      }
    }
    
    // Force retry for mobile and muted tracks
    if (isMobile || playError.message.includes('muted')) {
      console.log('📱 SETUP VIDEO: Forcing retry for mobile/muted tracks...');
      setTimeout(async () => {
        try {
          await videoElement.play();
          console.log('✅ SETUP VIDEO: Retry successful');
        } catch (retryError) {
          console.warn('⚠️ SETUP VIDEO: Retry failed - may require user interaction or track unmute');
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