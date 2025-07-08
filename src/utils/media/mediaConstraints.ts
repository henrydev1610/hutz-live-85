export const getMobileConstraints = (): MediaStreamConstraints[] => [
  // Tentativa 1: Configuração básica ideal
  {
    video: {
      facingMode: 'user'
    },
    audio: true
  },
  // Tentativa 2: Só vídeo sem áudio
  {
    video: true,
    audio: false
  },
  // Tentativa 3: Câmera traseira
  {
    video: {
      facingMode: 'environment'
    },
    audio: false
  },
  // Tentativa 4: Qualquer câmera disponível
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