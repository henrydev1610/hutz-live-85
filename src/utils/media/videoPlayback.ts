import { detectMobileAggressively } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobileAggressively();
  
  console.log('📺 SETUP VIDEO: Starting video element setup', {
    isMobile,
    streamId: stream.id,
    streamActive: stream.active,
    videoTracks: stream.getVideoTracks().length,
    currentSrcObject: videoElement.srcObject ? 'has stream' : 'empty'
  });
  
  // 🔧 CORREÇÃO CRÍTICA: Apenas atribuir se for diferente
  if (videoElement.srcObject !== stream) {
    console.log('📺 SETUP VIDEO: Assigning new srcObject');
    videoElement.srcObject = stream;
    console.log('✅ SETUP VIDEO: srcObject assigned successfully');
  } else {
    console.log('📺 SETUP VIDEO: Stream already assigned, skipping');
  }
  
  // Ensure all necessary properties are set
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  
  // 🔧 CORREÇÃO: Garantir que o vídeo tenha metadados antes de tentar play
  console.log('📺 SETUP VIDEO: Waiting for metadata if needed...');
  if (videoElement.readyState === 0) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ SETUP VIDEO: Metadata load timeout');
        resolve(); // Continue anyway
      }, 2000);
      
      videoElement.onloadedmetadata = () => {
        clearTimeout(timeout);
        console.log('✅ SETUP VIDEO: Metadata loaded');
        resolve();
      };
    });
  }
  
  try {
    console.log('📺 SETUP VIDEO: Attempting to play video...', {
      readyState: videoElement.readyState,
      networkState: videoElement.networkState,
      paused: videoElement.paused
    });
    
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