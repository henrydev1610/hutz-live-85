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
  
  // Ensure all necessary properties are set
  videoElement.playsInline = true;
  videoElement.muted = true;
  videoElement.autoplay = true;
  
  // Aguarda metadados e dados de vídeo antes de tentar play
  const waitForVideoReady = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 segundos
      
      const checkVideoReady = () => {
        attempts++;
        
        // Verifica se tem dimensões válidas
        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          console.log(`✅ SETUP VIDEO: Dados de vídeo prontos: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.warn('⚠️ SETUP VIDEO: Timeout aguardando dados de vídeo');
          resolve(false);
          return;
        }
        
        setTimeout(checkVideoReady, 100);
      };
      
      // Se metadados já estão carregados, verifica imediatamente
      if (videoElement.readyState >= 1) {
        checkVideoReady();
      } else {
        // Aguarda metadados carregarem
        const metadataHandler = () => {
          videoElement.removeEventListener('loadedmetadata', metadataHandler);
          checkVideoReady();
        };
        videoElement.addEventListener('loadedmetadata', metadataHandler);
      }
    });
  };

  try {
    console.log('📺 SETUP VIDEO: Aguardando dados de vídeo...');
    const hasVideoData = await waitForVideoReady();
    
    if (!hasVideoData) {
      console.warn('⚠️ SETUP VIDEO: Prosseguindo play sem dados de vídeo confirmados');
    }
    
    console.log('📺 SETUP VIDEO: Attempting to play video...');
    await videoElement.play();
    console.log(`✅ SETUP VIDEO: Video playing successfully (Mobile: ${isMobile})`);
    
    // Verificação final após play
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      console.log(`✅ SETUP VIDEO: Video dimensions confirmadas: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    } else {
      console.warn('⚠️ SETUP VIDEO: Video tocando mas dimensões ainda são 0x0');
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