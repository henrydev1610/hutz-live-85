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
  },
  // Tentativa 5: Apenas áudio (modo degradado)
  {
    video: false,
    audio: true
  },
  // Tentativa 6: Áudio básico
  {
    video: false,
    audio: {}
  }
];

export const getDesktopConstraints = (): MediaStreamConstraints[] => [
  { video: { facingMode: 'user' }, audio: true },
  { video: true, audio: true },
  { video: true, audio: false },
  { video: false, audio: true },
  { video: false, audio: {} }, // Modo degradado apenas áudio
  { video: {}, audio: false },  // Tentativa câmera sem áudio
  { video: {}, audio: {} }      // Última tentativa qualquer dispositivo
];