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
  // 🎯 MOBILE ATTEMPT 1: EXACT facingMode with mobile-optimized settings
  {
    video: {
      facingMode: { exact: preferredFacing },
      width: { min: 320, ideal: 640, max: 1280 },
      height: { min: 240, ideal: 480, max: 960 },
      frameRate: { min: 15, ideal: 30, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 48000 }
    }
  },
  
  // 🎯 MOBILE ATTEMPT 2: IDEAL facingMode (more flexible)
  {
    video: {
      facingMode: { ideal: preferredFacing },
      width: { min: 240, ideal: 480, max: 800 },
      height: { min: 180, ideal: 360, max: 600 },
      frameRate: { min: 10, ideal: 24, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  },
  
  // 🔄 MOBILE ATTEMPT 3: Try opposite camera with EXACT
  {
    video: {
      facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
      width: { min: 240, ideal: 480, max: 640 },
      height: { min: 180, ideal: 360, max: 480 }
    },
    audio: {
      echoCancellation: true
    }
  },
  
  // 🔄 MOBILE ATTEMPT 4: Try opposite camera with IDEAL
  {
    video: {
      facingMode: { ideal: preferredFacing === 'user' ? 'environment' : 'user' },
      width: { min: 240, ideal: 320, max: 640 },
      height: { min: 180, ideal: 240, max: 480 }
    },
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 5: Mobile-specific without facingMode (some devices)
  {
    video: {
      width: { min: 240, ideal: 320, max: 480 },
      height: { min: 180, ideal: 240, max: 360 },
      frameRate: { ideal: 15, max: 30 }
    },
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 6: Ultra-basic mobile constraints
  {
    video: {
      width: { ideal: 240 },
      height: { ideal: 180 }
    },
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 7: Minimal video only
  {
    video: true,
    audio: false
  },
  
  // 📱 MOBILE ATTEMPT 8: Audio only fallback
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