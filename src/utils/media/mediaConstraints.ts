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
  // 🎯 Tentativa 1: MOBILE - Câmera específica com facingMode OBRIGATÓRIO
  {
    video: {
      facingMode: { exact: preferredFacing }, // EXACT para forçar câmera específica
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // 🔄 Tentativa 2: MOBILE - Câmera alternativa com facingMode IDEAL (mais flexível)
  {
    video: {
      facingMode: { ideal: preferredFacing },
      width: { ideal: 480, max: 800 },
      height: { ideal: 360, max: 600 },
      frameRate: { ideal: 20, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // 🔄 Tentativa 3: MOBILE - Câmera oposta com EXACT
  {
    video: {
      facingMode: { exact: preferredFacing === 'user' ? 'environment' : 'user' },
      width: { ideal: 480, max: 800 },
      height: { ideal: 360, max: 600 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  },
  // 📱 Tentativa 4: MOBILE - Câmera preferida básica sem áudio
  {
    video: {
      facingMode: { ideal: preferredFacing },
      width: { ideal: 320, max: 640 },
      height: { ideal: 240, max: 480 }
    },
    audio: false
  },
  // Tentativa 5: Qualquer câmera móvel disponível
  {
    video: {
      width: { ideal: 320, max: 480 },
      height: { ideal: 240, max: 360 }
    },
    audio: false
  },
  // Tentativa 6: Vídeo ultra-básico sem especificações
  {
    video: true,
    audio: false
  },
  // Tentativa 7: Apenas áudio
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