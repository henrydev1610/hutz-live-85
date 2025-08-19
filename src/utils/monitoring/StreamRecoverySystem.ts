// FASE 3 - STREAM RENDERING CRÍTICO
// Sistema de recuperação automática para streams que não renderizam

interface StreamRecoveryConfig {
  maxRecoveryAttempts: number;
  darkVideoThresholdMs: number;
  trackValidationIntervalMs: number;
  forceRefreshThresholdMs: number;
}

interface StreamHealthMetrics {
  streamId: string;
  isActive: boolean;
  hasVideoTracks: boolean;
  hasAudioTracks: boolean;
  videoTrackState: string;
  isVideoProducingData: boolean;
  lastDataDetected: number;
  recoveryAttempts: number;
}

class StreamRecoverySystem {
  private static instance: StreamRecoverySystem;
  private monitoredStreams = new Map<string, StreamHealthMetrics>();
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private videoElements = new Map<string, HTMLVideoElement>();
  private recoveryCallbacks = new Map<string, () => Promise<void>>();

  private readonly config: StreamRecoveryConfig = {
    maxRecoveryAttempts: 3,
    darkVideoThresholdMs: 5000, // 5s without video data = dark
    trackValidationIntervalMs: 2000, // Check every 2s
    forceRefreshThresholdMs: 15000 // Force refresh after 15s
  };

  static getInstance(): StreamRecoverySystem {
    if (!StreamRecoverySystem.instance) {
      StreamRecoverySystem.instance = new StreamRecoverySystem();
    }
    return StreamRecoverySystem.instance;
  }

  // CRÍTICO: Monitor stream para detectar falhas de renderização
  monitorStream(
    streamId: string, 
    stream: MediaStream, 
    videoElement?: HTMLVideoElement,
    recoveryCallback?: () => Promise<void>
  ): void {
    console.log(`🔥 RECOVERY: Starting stream monitoring for ${streamId}`);

    if (videoElement) {
      this.videoElements.set(streamId, videoElement);
    }

    if (recoveryCallback) {
      this.recoveryCallbacks.set(streamId, recoveryCallback);
    }

    const metrics: StreamHealthMetrics = {
      streamId,
      isActive: stream.active,
      hasVideoTracks: stream.getVideoTracks().length > 0,
      hasAudioTracks: stream.getAudioTracks().length > 0,
      videoTrackState: stream.getVideoTracks()[0]?.readyState || 'none',
      isVideoProducingData: false,
      lastDataDetected: Date.now(),
      recoveryAttempts: 0
    };

    this.monitoredStreams.set(streamId, metrics);

    // Validação rigorosa de track data production
    this.startTrackDataValidation(streamId, stream);

    // Monitor video element se disponível
    if (videoElement) {
      this.startVideoElementMonitoring(streamId, videoElement);
    }
  }

  // CRÍTICO: Validação rigorosa se tracks estão produzindo dados reais
  private startTrackDataValidation(streamId: string, stream: MediaStream): void {
    const interval = setInterval(() => {
      const metrics = this.monitoredStreams.get(streamId);
      if (!metrics) {
        clearInterval(interval);
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        this.handleStreamFailure(streamId, 'No video track found');
        return;
      }

      // Verificar se track está "live" mas não produzindo dados
      const isTrackLive = videoTrack.readyState === 'live';
      const isTrackEnabled = videoTrack.enabled;
      const trackMuted = videoTrack.muted;

      // Detectar "ghost streams" - live mas sem dados reais
      const timeSinceLastData = Date.now() - metrics.lastDataDetected;
      const isDarkVideo = timeSinceLastData > this.config.darkVideoThresholdMs;

      metrics.videoTrackState = videoTrack.readyState;
      metrics.isVideoProducingData = isTrackLive && !trackMuted && !isDarkVideo;

      console.log(`🔥 RECOVERY: Track validation ${streamId}:`, {
        isTrackLive,
        isTrackEnabled,
        trackMuted,
        isDarkVideo,
        timeSinceLastData,
        isProducingData: metrics.isVideoProducingData
      });

      // CRÍTICO: Detectar stream que não renderiza
      if (isTrackLive && !trackMuted && isDarkVideo && metrics.recoveryAttempts < this.config.maxRecoveryAttempts) {
        console.warn(`🔥 RECOVERY: DARK VIDEO detected for ${streamId} - initiating recovery`);
        this.initiateStreamRecovery(streamId, 'Dark video detected');
      }

      // Atualizar métricas
      this.monitoredStreams.set(streamId, metrics);

    }, this.config.trackValidationIntervalMs);

    this.monitoringIntervals.set(`${streamId}-track`, interval);
  }

  // CRÍTICO: Monitor video element para containers escuros
  private startVideoElementMonitoring(streamId: string, videoElement: HTMLVideoElement): void {
    const checkVideoElementHealth = () => {
      const metrics = this.monitoredStreams.get(streamId);
      if (!metrics) return;

      // Verificar se video element está renderizando
      const hasVideoSize = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
      const isPlaying = !videoElement.paused && !videoElement.ended;
      const currentTime = videoElement.currentTime;

      console.log(`🔥 RECOVERY: Video element health ${streamId}:`, {
        hasVideoSize,
        isPlaying,
        currentTime,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        readyState: videoElement.readyState
      });

      // CRÍTICO: Detectar video element escuro
      if (!hasVideoSize && metrics.isActive && metrics.hasVideoTracks) {
        console.warn(`🔥 RECOVERY: Dark container detected for ${streamId}`);
        this.initiateStreamRecovery(streamId, 'Dark video container');
      }

      // Atualizar lastDataDetected se video está funcionando
      if (hasVideoSize && isPlaying) {
        metrics.lastDataDetected = Date.now();
        this.monitoredStreams.set(streamId, metrics);
      }
    };

    const interval = setInterval(checkVideoElementHealth, this.config.trackValidationIntervalMs);
    this.monitoringIntervals.set(`${streamId}-video`, interval);

    // Event listeners para o video element
    videoElement.addEventListener('loadedmetadata', () => {
      console.log(`🔥 RECOVERY: Video metadata loaded for ${streamId}`);
      const metrics = this.monitoredStreams.get(streamId);
      if (metrics) {
        metrics.lastDataDetected = Date.now();
        this.monitoredStreams.set(streamId, metrics);
      }
    });

    videoElement.addEventListener('timeupdate', () => {
      const metrics = this.monitoredStreams.get(streamId);
      if (metrics) {
        metrics.lastDataDetected = Date.now();
        this.monitoredStreams.set(streamId, metrics);
      }
    });
  }

  // CRÍTICO: Inicia recuperação automática
  private async initiateStreamRecovery(streamId: string, reason: string): Promise<void> {
    const metrics = this.monitoredStreams.get(streamId);
    if (!metrics || metrics.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      console.error(`🔥 RECOVERY: Max attempts reached for ${streamId}`);
      return;
    }

    metrics.recoveryAttempts++;
    console.log(`🔥 RECOVERY: Attempting recovery ${metrics.recoveryAttempts}/${this.config.maxRecoveryAttempts} for ${streamId}: ${reason}`);

    try {
      // Tentar refresh do video element primeiro
      const videoElement = this.videoElements.get(streamId);
      if (videoElement) {
        console.log(`🔥 RECOVERY: Refreshing video element for ${streamId}`);
        videoElement.load();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Executar callback de recuperação se disponível
      const recoveryCallback = this.recoveryCallbacks.get(streamId);
      if (recoveryCallback) {
        console.log(`🔥 RECOVERY: Executing recovery callback for ${streamId}`);
        await recoveryCallback();
      }

      // Reset timestamp para nova tentativa
      metrics.lastDataDetected = Date.now();
      this.monitoredStreams.set(streamId, metrics);

      console.log(`🔥 RECOVERY: Recovery attempt completed for ${streamId}`);
      
    } catch (error) {
      console.error(`🔥 RECOVERY: Recovery failed for ${streamId}:`, error);
      this.handleStreamFailure(streamId, `Recovery failed: ${error}`);
    }
  }

  // CRÍTICO: Handle falha definitiva do stream
  private handleStreamFailure(streamId: string, reason: string): void {
    console.error(`🔥 RECOVERY: Stream failure detected for ${streamId}: ${reason}`);
    
    // Limpar monitoramento
    this.stopMonitoring(streamId);
    
    // Notificar falha
    if (typeof window !== 'undefined' && 'toast' in window) {
      (window as any).toast?.error(`❌ Falha crítica no stream: ${reason}`);
    }
  }

  // CRÍTICO: Para monitoramento de um stream
  stopMonitoring(streamId: string): void {
    console.log(`🔥 RECOVERY: Stopping monitoring for ${streamId}`);

    // Limpar intervals
    const trackInterval = this.monitoringIntervals.get(`${streamId}-track`);
    const videoInterval = this.monitoringIntervals.get(`${streamId}-video`);
    
    if (trackInterval) {
      clearInterval(trackInterval);
      this.monitoringIntervals.delete(`${streamId}-track`);
    }
    
    if (videoInterval) {
      clearInterval(videoInterval);
      this.monitoringIntervals.delete(`${streamId}-video`);
    }

    // Limpar referências
    this.monitoredStreams.delete(streamId);
    this.videoElements.delete(streamId);
    this.recoveryCallbacks.delete(streamId);
  }

  // API pública
  getStreamMetrics(streamId: string): StreamHealthMetrics | undefined {
    return this.monitoredStreams.get(streamId);
  }

  getAllStreamMetrics(): StreamHealthMetrics[] {
    return Array.from(this.monitoredStreams.values());
  }

  forceRecovery(streamId: string): Promise<void> {
    return this.initiateStreamRecovery(streamId, 'Manual recovery triggered');
  }

  cleanup(): void {
    console.log('🔥 RECOVERY: Cleaning up all monitoring');
    
    // Stop all monitoring
    for (const streamId of this.monitoredStreams.keys()) {
      this.stopMonitoring(streamId);
    }
  }
}

export const streamRecoverySystem = StreamRecoverySystem.getInstance();
export type { StreamHealthMetrics };