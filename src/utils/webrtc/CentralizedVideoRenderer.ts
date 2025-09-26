// FASE 5: Centralizador de renderização de vídeo - ponto único de criação de elementos

export interface VideoElementConfig {
  autoplay?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
}

export interface VideoMetrics {
  videoWidth: number;
  videoHeight: number;
  bytesReceived: number;
  framesReceived: number;
  isReceiving: boolean;
  lastUpdate: number;
}

export class CentralizedVideoRenderer {
  private static instance: CentralizedVideoRenderer;
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private videoMetrics: Map<string, VideoMetrics> = new Map();
  private metricsIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): CentralizedVideoRenderer {
    if (!CentralizedVideoRenderer.instance) {
      CentralizedVideoRenderer.instance = new CentralizedVideoRenderer();
    }
    return CentralizedVideoRenderer.instance;
  }

  // FASE 5: Único ponto de criação de elementos de vídeo
  createVideoElement(
    participantId: string, 
    container: HTMLElement, 
    stream: MediaStream,
    config: VideoElementConfig = {}
  ): HTMLVideoElement {
    console.log(`🎥 CENTRAL: Criando elemento de vídeo para ${participantId}`);

    // Remover elemento existente se houver
    this.removeVideoElement(participantId);

    const video = document.createElement('video');
    
    // FASE 3: Configuração correta sem pausas programáticas
    video.autoplay = config.autoplay !== false; // Default true
    video.playsInline = config.playsInline !== false; // Default true  
    video.muted = config.muted !== false; // Default true para host
    video.controls = config.controls || false;
    video.className = config.className || 'w-full h-full object-cover';
    
    // Atribuir stream
    video.srcObject = stream;
    
    console.log(`🎥 CENTRAL: Configuração do vídeo:`, {
      participantId,
      autoplay: video.autoplay,
      playsInline: video.playsInline,
      muted: video.muted,
      streamActive: stream.active,
      tracks: stream.getTracks().length
    });

    // Eventos para diagnóstico
    video.addEventListener('loadedmetadata', () => {
      console.log(`📊 CENTRAL: Metadata loaded para ${participantId}:`, {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration
      });
      this.updateMetrics(participantId, video);
    });

    video.addEventListener('play', () => {
      console.log(`▶️ CENTRAL: Vídeo iniciado para ${participantId}`);
    });

    video.addEventListener('pause', () => {
      console.log(`⏸️ CENTRAL: Vídeo pausado para ${participantId}`);
    });

    video.addEventListener('error', (e) => {
      console.error(`❌ CENTRAL: Erro no vídeo ${participantId}:`, e);
    });

    // FASE 3: Tentar reproduzir automaticamente com fallback silencioso
    this.attemptAutoplay(video, participantId);

    // Adicionar ao container e registrar
    container.appendChild(video);
    this.videoElements.set(participantId, video);
    
    // Iniciar monitoramento de métricas
    this.startMetricsMonitoring(participantId, video);

    return video;
  }

  // FASE 3: Autoplay com fallback silencioso
  private async attemptAutoplay(video: HTMLVideoElement, participantId: string): Promise<void> {
    try {
      await video.play();
      console.log(`✅ CENTRAL: Autoplay sucesso para ${participantId}`);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        console.log(`🔇 CENTRAL: Autoplay bloqueado para ${participantId} - aguardando interação do usuário`);
        // Fallback silencioso - adicionar listener para próximo click
        document.addEventListener('click', () => {
          video.play().catch(() => {
            console.log(`⚠️ CENTRAL: Fallback play também falhou para ${participantId}`);
          });
        }, { once: true });
      } else {
        console.error(`❌ CENTRAL: Erro de autoplay para ${participantId}:`, error);
      }
    }
  }

  // FASE 5: Monitoramento objetivo de métricas
  private startMetricsMonitoring(participantId: string, video: HTMLVideoElement): void {
    const interval = setInterval(() => {
      this.updateMetrics(participantId, video);
    }, 1000);
    
    this.metricsIntervals.set(participantId, interval);
  }

  private updateMetrics(participantId: string, video: HTMLVideoElement): void {
    const currentMetrics: VideoMetrics = {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      bytesReceived: 0, // Will be updated from WebRTC stats
      framesReceived: 0, // Will be updated from WebRTC stats
      isReceiving: video.videoWidth > 0 && video.videoHeight > 0,
      lastUpdate: Date.now()
    };

    this.videoMetrics.set(participantId, currentMetrics);

    // Log apenas quando há mudanças significativas
    const previousMetrics = this.videoMetrics.get(participantId);
    if (!previousMetrics || 
        previousMetrics.videoWidth !== currentMetrics.videoWidth ||
        previousMetrics.videoHeight !== currentMetrics.videoHeight) {
      console.log(`📊 CENTRAL: Métricas atualizadas para ${participantId}:`, currentMetrics);
    }
  }

  // FASE 5: Atualizar métricas WebRTC externas
  updateWebRTCMetrics(participantId: string, stats: { bytesReceived: number; framesReceived: number }): void {
    const currentMetrics = this.videoMetrics.get(participantId);
    if (currentMetrics) {
      currentMetrics.bytesReceived = stats.bytesReceived;
      currentMetrics.framesReceived = stats.framesReceived;
      this.videoMetrics.set(participantId, currentMetrics);
    }
  }

  // FASE 5: Diagnóstico objetivo
  isVideoHealthy(participantId: string): boolean {
    const metrics = this.videoMetrics.get(participantId);
    if (!metrics) return false;

    return metrics.videoWidth > 0 && 
           metrics.videoHeight > 0 && 
           metrics.isReceiving &&
           (Date.now() - metrics.lastUpdate) < 5000; // Updated within 5s
  }

  getVideoElement(participantId: string): HTMLVideoElement | null {
    return this.videoElements.get(participantId) || null;
  }

  getVideoMetrics(participantId: string): VideoMetrics | null {
    return this.videoMetrics.get(participantId) || null;
  }

  getAllMetrics(): Map<string, VideoMetrics> {
    return new Map(this.videoMetrics);
  }

  removeVideoElement(participantId: string): void {
    const video = this.videoElements.get(participantId);
    if (video) {
      // FASE 3: Não pausar programaticamente - apenas remover
      video.srcObject = null;
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      this.videoElements.delete(participantId);
    }

    // Limpar métricas e intervalos
    const interval = this.metricsIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.metricsIntervals.delete(participantId);
    }
    this.videoMetrics.delete(participantId);

    console.log(`🗑️ CENTRAL: Elemento de vídeo removido para ${participantId}`);
  }

  // FASE 5: Diagnóstico global
  getSystemDiagnostics(): {
    activeVideos: number;
    healthyVideos: number;
    participants: string[];
    overallHealth: boolean;
  } {
    const participants = Array.from(this.videoElements.keys());
    const healthyCount = participants.filter(p => this.isVideoHealthy(p)).length;
    
    return {
      activeVideos: participants.length,
      healthyVideos: healthyCount,
      participants,
      overallHealth: healthyCount === participants.length && participants.length > 0
    };
  }

  // Cleanup completo
  cleanup(): void {
    console.log(`🧹 CENTRAL: Limpeza completa de todos os vídeos`);
    
    for (const participantId of this.videoElements.keys()) {
      this.removeVideoElement(participantId);
    }
  }
}

// Singleton global
export const centralizedVideoRenderer = CentralizedVideoRenderer.getInstance();