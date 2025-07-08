export const getMobileConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Configuração básica com resolução específica
  {
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: true
  },
  // Tentativa 2: Configuração básica sem especificações
  {
    video: {
      facingMode: 'user'
    },
    audio: true
  },
  // Tentativa 3: Só vídeo frontal
  {
    video: {
      facingMode: 'user'
    },
    audio: false
  },
  // Tentativa 4: Qualquer vídeo com áudio
  {
    video: true,
    audio: true
  },
  // Tentativa 5: Só vídeo sem áudio
  {
    video: true,
    audio: false
  },
  // Tentativa 6: Configuração mínima
  {
    video: {},
    audio: false
  }
];

export const getDesktopConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Configuração ideal com câmera frontal
  { video: { facingMode: 'user' }, audio: true },
  // Tentativa 2: Qualquer câmera com áudio
  { video: true, audio: true },
  // Tentativa 3: Qualquer câmera sem áudio
  { video: true, audio: false },
  // Tentativa 4: Só áudio
  { video: false, audio: true },
  // Tentativa 5: Câmera com configurações básicas
  { video: { width: 640, height: 480 }, audio: false },
  // Tentativa 6: Último recurso - sem especificações
  { video: {}, audio: false }
];