import { detectMobileAggressively } from './deviceDetection';

export const setupVideoElement = async (videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> => {
  const isMobile = detectMobileAggressively();
  
  console.log('📺 SETUP VIDEO: Starting video element setup', {
    isMobile,
    streamId: stream.id,
    streamActive: stream.active,
    videoTracks: stream.getVideoTracks().length
  });

  // FASE 1: VALIDAÇÃO CRÍTICA DE TRACKS ANTES DE SETUP
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) {
    throw new Error('Stream não possui tracks de vídeo');
  }

  const activeVideoTracks = videoTracks.filter(track => 
    track.enabled && track.readyState === 'live' && !track.muted
  );

  console.log('🔍 SETUP VIDEO: Track validation', {
    totalTracks: videoTracks.length,
    activeTracks: activeVideoTracks.length,
    trackStates: videoTracks.map(track => ({
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
      kind: track.kind
    }))
  });

  if (activeVideoTracks.length === 0) {
    console.warn('⚠️ SETUP VIDEO: Aguardando tracks ficarem ativas...');
    // Aguarda até 3 segundos para tracks ficarem ativas
    await new Promise((resolve) => {
      let attempts = 0;
      const checkTracks = () => {
        const currentActiveTracks = stream.getVideoTracks().filter(track => 
          track.enabled && track.readyState === 'live' && !track.muted
        );
        
        if (currentActiveTracks.length > 0 || attempts >= 30) {
          resolve(void 0);
          return;
        }
        
        attempts++;
        setTimeout(checkTracks, 100);
      };
      checkTracks();
    });
  }
  
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
  
  // FASE 1 CONTINUAÇÃO: Aguarda metadados E canplay antes de tentar play
  const waitForVideoReady = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      let metadataLoaded = false;
      let canPlayLoaded = false;
      let attempts = 0;
      const maxAttempts = 50; // 5 segundos
      
      const checkVideoReady = () => {
        attempts++;
        
        // VALIDAÇÃO DUPLA: Metadados + Dimensões + CanPlay
        const hasMetadata = videoElement.readyState >= 1;
        const hasDimensions = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
        const canPlay = videoElement.readyState >= 3;
        
        console.log(`🔍 SETUP VIDEO: Verificação ${attempts}:`, {
          hasMetadata,
          hasDimensions,
          canPlay,
          readyState: videoElement.readyState,
          dimensions: `${videoElement.videoWidth}x${videoElement.videoHeight}`
        });
        
        // Só considera pronto se tem metadados E dimensões E pode reproduzir
        if (hasMetadata && hasDimensions && canPlay) {
          console.log(`✅ SETUP VIDEO: Dados completos prontos: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.warn('⚠️ SETUP VIDEO: Timeout aguardando dados completos');
          resolve(false);
          return;
        }
        
        setTimeout(checkVideoReady, 100);
      };
      
      // Listeners para garantir que ambos eventos foram disparados
      const metadataHandler = () => {
        metadataLoaded = true;
        console.log('📺 SETUP VIDEO: Metadata carregada');
        if (canPlayLoaded) checkVideoReady();
      };
      
      const canPlayHandler = () => {
        canPlayLoaded = true;
        console.log('📺 SETUP VIDEO: CanPlay ativado');
        if (metadataLoaded) checkVideoReady();
      };
      
      // Se eventos já dispararam, verifica imediatamente
      if (videoElement.readyState >= 1 && videoElement.readyState >= 3) {
        checkVideoReady();
      } else {
        videoElement.addEventListener('loadedmetadata', metadataHandler, { once: true });
        videoElement.addEventListener('canplay', canPlayHandler, { once: true });
        
        // Fallback check após 1 segundo
        setTimeout(() => {
          if (!metadataLoaded || !canPlayLoaded) {
            checkVideoReady();
          }
        }, 1000);
      }
    });
  };

  try {
    console.log('📺 SETUP VIDEO: Aguardando dados completos de vídeo...');
    const hasVideoData = await waitForVideoReady();
    
    if (!hasVideoData) {
      console.warn('⚠️ SETUP VIDEO: Forçando play sem dados completos');
      
      // FASE 2: FALLBACK AGRESSIVO - Reaplica srcObject
      console.log('🔄 SETUP VIDEO: Aplicando fallback - reaplicando srcObject');
      videoElement.srcObject = null;
      await new Promise(resolve => setTimeout(resolve, 100));
      videoElement.srcObject = stream;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('📺 SETUP VIDEO: Attempting to play video...');
    await videoElement.play();
    console.log(`✅ SETUP VIDEO: Video playing successfully (Mobile: ${isMobile})`);
    
    // VERIFICAÇÃO CRÍTICA: Aguarda dimensões aparecerem após play
    let dimensionChecks = 0;
    const waitForDimensions = () => {
      dimensionChecks++;
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        console.log(`✅ SETUP VIDEO: Dimensões confirmadas: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        return;
      }
      
      if (dimensionChecks < 20) { // 2 segundos
        setTimeout(waitForDimensions, 100);
      } else {
        console.error('❌ SETUP VIDEO: CRÍTICO - Vídeo tocando mas sem dimensões após 2s');
        
        // ÚLTIMO RECURSO: Recreation do srcObject
        console.log('🚨 SETUP VIDEO: ÚLTIMO RECURSO - Recriando srcObject');
        videoElement.srcObject = null;
        setTimeout(() => {
          videoElement.srcObject = stream;
          videoElement.play().catch(console.error);
        }, 1000);
      }
    };
    
    // Inicia verificação de dimensões
    setTimeout(waitForDimensions, 100);
    
  } catch (playError) {
    console.error(`❌ SETUP VIDEO: Play failed (Mobile: ${isMobile}):`, playError);
    
    // FASE 2: FALLBACK AGRESSIVO COM MULTIPLE RETRIES
    console.log('🔄 SETUP VIDEO: Iniciando fallback agressivo...');
    
    const aggressiveRetry = async (attempt: number) => {
      if (attempt > 3) {
        console.error('❌ SETUP VIDEO: Fallback falhou após 3 tentativas');
        return;
      }
      
      console.log(`🔄 SETUP VIDEO: Tentativa ${attempt} - Reaplicando srcObject`);
      videoElement.srcObject = null;
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      videoElement.srcObject = stream;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await videoElement.play();
        console.log(`✅ SETUP VIDEO: Fallback sucesso na tentativa ${attempt}`);
      } catch (retryError) {
        console.warn(`⚠️ SETUP VIDEO: Tentativa ${attempt} falhou, continuando...`);
        setTimeout(() => aggressiveRetry(attempt + 1), 1000 * attempt);
      }
    };
    
    aggressiveRetry(1);
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