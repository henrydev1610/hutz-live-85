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
  // Tentativa 1: Câmera preferida do usuário com qualidade média
  {
    video: {
      facingMode: preferredFacing,
      width: { ideal: 480, max: 800 },
      height: { ideal: 360, max: 600 },
      frameRate: { ideal: 15, max: 25 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // Tentativa 2: Câmera alternativa (se user não funcionar, tenta environment e vice-versa)
  {
    video: {
      facingMode: preferredFacing === 'user' ? 'environment' : 'user',
      width: { ideal: 480, max: 800 },
      height: { ideal: 360, max: 600 },
      frameRate: { ideal: 15, max: 25 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // Tentativa 3: Câmera preferida sem áudio
  {
    video: {
      facingMode: preferredFacing,
      width: { ideal: 320, max: 480 },
      height: { ideal: 240, max: 360 }
    },
    audio: false
  },
  // Tentativa 4: Câmera alternativa sem áudio
  {
    video: {
      facingMode: preferredFacing === 'user' ? 'environment' : 'user',
      width: { ideal: 320, max: 480 },
      height: { ideal: 240, max: 360 }
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
  // Tentativa 1: Desktop com qualidade boa - SEM facingMode (usa webcam padrão)
  {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 }
      // Nota: Não usa facingMode no desktop
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // Tentativa 2: Desktop qualidade média - SEM facingMode
  {
    video: {
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 15, max: 24 }
      // Nota: Não usa facingMode no desktop
    },
    audio: true
  },
  // Tentativa 3: Desktop básico sem áudio - SEM facingMode
  {
    video: {
      width: { max: 480 },
      height: { max: 360 }
      // Nota: Não usa facingMode no desktop
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