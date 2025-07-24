import { detectMobile, getCameraPreference } from './deviceDetection';

export const getDeviceSpecificConstraints = (): MediaStreamConstraints[] => {
  const isMobile = detectMobile();
  const cameraPreference = getCameraPreference();
  
  console.log('📱 Getting constraints for:', { isMobile, cameraPreference });
  
  if (isMobile) {
    return getMobileConstraints(cameraPreference);
  } else {
    return getDesktopConstraints();
  }
};

export const getMobileConstraints = (preferredFacing: 'user' | 'environment' = 'user'): MediaStreamConstraints[] => [
  // 🎯 MOBILE ATTEMPT 1: BÁSICO - Video + Audio simples (CRÍTICO para resolver "NOT FOUND")
  {
    video: true,
    audio: true
  },
  
  // 🎯 MOBILE ATTEMPT 2: IDEAL facingMode básico
  {
    video: {
      facingMode: { ideal: preferredFacing }
    },
    audio: true
  },
  
  // 🎯 MOBILE ATTEMPT 3: EXACT facingMode preferido
  {
    video: {
      facingMode: { exact: preferredFacing }
    },
    audio: true
  },
  
  // 🔄 MOBILE ATTEMPT 4: Câmera oposta IDEAL
  {
    video: {
      facingMode: { ideal: preferredFacing === 'user' ? 'environment' : 'user' }
    },
    audio: true
  },
  
  // 🔄 MOBILE ATTEMPT 5: Câmera oposta EXACT
  {
    video: {
      facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' }
    },
    audio: true
  },
  
  // 📱 MOBILE ATTEMPT 6: Apenas vídeo básico
  {
    video: true,
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 7: Vídeo com constraints básicas
  {
    video: {
      width: { ideal: 480 },
      height: { ideal: 360 }
    },
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 8: Audio apenas (emergência)
  {
    video: false,
    audio: true
  }
];

export const getDesktopConstraints = (): MediaStreamConstraints[] => [
  // 🖥️ CRITICAL FIX: Desktop constraints SEM facingMode (resolve conexão quadrante)
  {
    video: {
      // ✅ DESKTOP: Configurações otimizadas para webcam sem mobile-specific constraints
      width: { ideal: 1280, min: 640, max: 1920 },
      height: { ideal: 720, min: 480, max: 1080 },
      frameRate: { ideal: 30, min: 15, max: 60 },
      aspectRatio: { ideal: 16/9 },
      // ❌ REMOVIDO: facingMode (causa erro em desktop)
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 2 }
    }
  },
  // 🖥️ OTIMIZADO: Tentativa 2 - DESKTOP qualidade média otimizada
  {
    video: {
      width: { ideal: 640, min: 320, max: 1280 },
      height: { ideal: 480, min: 240, max: 720 },
      frameRate: { ideal: 24, min: 10, max: 30 },
      aspectRatio: { ideal: 4/3 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // 🖥️ OTIMIZADO: Tentativa 3 - DESKTOP básico sem áudio
  {
    video: {
      width: { ideal: 480, min: 320, max: 640 },
      height: { ideal: 360, min: 240, max: 480 },
      frameRate: { ideal: 15, min: 10, max: 24 }
    },
    audio: false
  },
  // Tentativa 4: Vídeo ultra-simples para desktop
  {
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 }
    },
    audio: false
  },
  // Tentativa 5: Qualquer vídeo disponível
  {
    video: true,
    audio: false
  },
  // Tentativa 6: Apenas áudio
  {
    video: false,
    audio: true
  }
];