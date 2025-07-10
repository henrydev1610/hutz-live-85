export const getMobileConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Configuração mais permissiva para mobile
  {
    video: {
      facingMode: 'user',
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // Tentativa 2: Vídeo básico com qualidade reduzida
  {
    video: {
      width: { ideal: 320, max: 640 },
      height: { ideal: 240, max: 480 },
      frameRate: { ideal: 10, max: 15 }
    },
    audio: true
  },
  // Tentativa 3: Vídeo mínimo sem áudio
  {
    video: {
      width: { max: 320 },
      height: { max: 240 },
      frameRate: { max: 10 }
    },
    audio: false
  },
  // Tentativa 4: Qualquer vídeo disponível
  {
    video: true,
    audio: false
  },
  // Tentativa 5: Câmera traseira se frontal falhar
  {
    video: {
      facingMode: 'environment',
      width: { max: 640 },
      height: { max: 480 }
    },
    audio: false
  },
  // Tentativa 6: Vídeo básico sem constraints específicos
  {
    video: {},
    audio: false
  },
  // Tentativa 7: Apenas áudio (modo degradado)
  {
    video: false,
    audio: true
  }
];

export const getDesktopConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Desktop com qualidade boa
  {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  },
  // Tentativa 2: Qualidade média 
  {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 30 }
    },
    audio: true
  },
  // Tentativa 3: Vídeo básico sem áudio
  {
    video: {
      width: { max: 640 },
      height: { max: 480 }
    },
    audio: false
  },
  // Tentativa 4: Qualquer vídeo disponível
  {
    video: true,
    audio: false
  },
  // Tentativa 5: Vídeo sem constraints específicos
  {
    video: {},
    audio: false
  },
  // Tentativa 6: Apenas áudio (modo degradado)
  {
    video: false,
    audio: true
  }
];