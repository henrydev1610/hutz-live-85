// Configuração inteligente de elementos de vídeo por contexto
export interface VideoElementConfig {
  muted: boolean;
  autoplay: boolean;
  playsInline: boolean;
}

export const getVideoElementConfig = (context: 'local-preview' | 'remote-stream'): VideoElementConfig => {
  switch (context) {
    case 'local-preview':
      // Preview local: sempre muted para evitar feedback
      return {
        muted: true,
        autoplay: true,
        playsInline: true
      };
    
    case 'remote-stream':
      // Stream remoto: NÃO muted para permitir áudio
      return {
        muted: false,
        autoplay: true,
        playsInline: true
      };
    
    default:
      throw new Error(`Contexto de vídeo inválido: ${context}`);
  }
};

export const applyVideoElementConfig = (
  videoElement: HTMLVideoElement, 
  config: VideoElementConfig,
  context: string
) => {
  console.log(`🎬 VIDEO CONFIG: Aplicando configuração para ${context}:`, config);
  
  videoElement.playsInline = config.playsInline;
  videoElement.muted = config.muted;
  videoElement.autoplay = config.autoplay;
  
  console.log(`🎬 VIDEO CONFIG: Elemento configurado - muted: ${videoElement.muted}, autoplay: ${videoElement.autoplay}`);
};