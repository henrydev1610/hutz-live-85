export const getMobileConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Configuração básica e permissiva para mobile
  {
    video: {
      facingMode: 'user',
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
  // Tentativa 2: Vídeo simples sem áudio
  {
    video: {
      facingMode: 'user',
      width: { ideal: 320, max: 480 },
      height: { ideal: 240, max: 360 }
    },
    audio: false
  },
  // Tentativa 3: Câmera traseira básica
  {
    video: {
      facingMode: 'environment',
      width: { ideal: 320, max: 480 },
      height: { ideal: 240, max: 360 }
    },
    audio: false
  },
  // Tentativa 4: Vídeo ultra-básico frontal
  {
    video: {
      facingMode: 'user'
    },
    audio: false
  },
  // Tentativa 5: Vídeo ultra-básico traseiro
  {
    video: {
      facingMode: 'environment'
    },
    audio: false
  },
  // Tentativa 6: Qualquer vídeo sem especificações
  {
    video: true,
    audio: false
  },
  // Tentativa 7: Vídeo vazio (aceita qualquer coisa)
  {
    video: {},
    audio: false
  },
  // Tentativa 8: Apenas áudio de qualidade
  {
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  },
  // Tentativa 9: Apenas áudio básico
  {
    video: false,
    audio: true
  },
  // Tentativa 10: ULTRA-FALLBACK - aceita qualquer mídia
  {
    video: { optional: [] } as any,
    audio: { optional: [] } as any
  }
];

export const getDesktopConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Desktop com qualidade média-boa
  {
    video: {
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
  // Tentativa 2: Qualidade básica 
  {
    video: {
      width: { ideal: 480, max: 640 },
      height: { ideal: 360, max: 480 },
      frameRate: { ideal: 15, max: 24 }
    },
    audio: true
  },
  // Tentativa 3: Vídeo básico sem áudio
  {
    video: {
      width: { max: 480 },
      height: { max: 360 }
    },
    audio: false
  },
  // Tentativa 4: Vídeo ultra-simples
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
  // Tentativa 6: Vídeo sem constraints específicos
  {
    video: {},
    audio: false
  },
  // Tentativa 7: Apenas áudio com qualidade
  {
    video: false,
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  },
  // Tentativa 8: Apenas áudio básico
  {
    video: false,
    audio: true
  },
  // Tentativa 9: ULTRA-FALLBACK - aceita qualquer mídia
  {
    video: { optional: [] } as any,
    audio: { optional: [] } as any
  }
];