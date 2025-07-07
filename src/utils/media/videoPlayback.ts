import { detectMobile } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobile();
  
  videoElement.srcObject = stream;
  
  try {
    // No mobile, configurar propriedades específicas do vídeo
    if (isMobile) {
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.autoplay = true;
    }
    
    await videoElement.play();
    console.log(`✅ MEDIA: Local video playing (Mobile: ${isMobile})`);
  } catch (playError) {
    console.warn(`⚠️ MEDIA: Video play warning (Mobile: ${isMobile}):`, playError);
    // No mobile, tentar forçar o play
    if (isMobile) {
      setTimeout(() => {
        videoElement.play().catch(e => console.warn('Retry play failed:', e));
      }, 1000);
    }
  }
};