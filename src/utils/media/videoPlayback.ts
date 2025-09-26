import { detectMobileAggressively } from './deviceDetection';
import { getVideoElementConfig, applyVideoElementConfig } from './videoElementConfig';
import { validateAndFixMediaTracks, logStreamDetails } from './trackValidation';

export const setupVideoElement = async (
  videoElement: HTMLVideoElement, 
  stream: MediaStream, 
  context: 'local-preview' | 'remote-stream' = 'remote-stream'
): Promise<void> => {
  const isMobile = detectMobileAggressively();
  
  console.log('📺 SETUP VIDEO: Starting video element setup', {
    isMobile,
    streamId: stream.id,
    streamActive: stream.active,
    videoTracks: stream.getVideoTracks().length
  });
  
  // CRÍTICO: Validar e corrigir tracks antes de aplicar ao elemento
  validateAndFixMediaTracks(stream);
  logStreamDetails(stream, context);
  
  // Clear any existing stream first
  if (videoElement.srcObject) {
    console.log('📺 SETUP VIDEO: Clearing existing srcObject');
    videoElement.srcObject = null;
  }
  
  // Set new stream
  videoElement.srcObject = stream;
  
  // Aplicar configuração baseada no contexto
  const config = getVideoElementConfig(context);
  applyVideoElementConfig(videoElement, config, context);
  
  // CRÍTICO: Verificar se tracks de vídeo estão habilitados
  const videoTracks = stream.getVideoTracks();
  console.log(`📺 SETUP VIDEO: Verificando tracks de vídeo:`, {
    totalTracks: videoTracks.length,
    trackStates: videoTracks.map(track => ({
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    }))
  });
  
  // Garantir que os tracks de vídeo estão habilitados
  videoTracks.forEach(track => {
    if (!track.enabled) {
      console.warn(`⚠️ SETUP VIDEO: Habilitando track de vídeo desabilitado: ${track.id}`);
      track.enabled = true;
    }
  });
  
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