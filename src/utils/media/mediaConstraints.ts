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
  { video: { facingMode: 'user' }, audio: true },
  { video: true, audio: true },
  { video: true, audio: false },
  { video: false, audio: true }
];