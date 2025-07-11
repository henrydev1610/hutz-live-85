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
  // 🖥️ Tentativa 1: DESKTOP - Webcam padrão SEM facingMode (IMPORTANTE!)
  {
    video: {
      // ❌ NUNCA usar facingMode no desktop - causa conflito com mobile
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
      // ✅ SEM facingMode - usa webcam padrão do desktop
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // 🖥️ Tentativa 2: DESKTOP - Qualidade média SEM facingMode
  {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 }
      // ✅ SEM facingMode - webcam desktop padrão
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  },
  // 🖥️ Tentativa 3: DESKTOP - Básico sem áudio SEM facingMode
  {
    video: {
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 }
      // ✅ SEM facingMode - webcam desktop
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