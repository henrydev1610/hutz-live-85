// FASE 2: CENTRALIZED VIDEO RENDERING MANAGER
// This class ensures all video rendering goes through a single pipeline

export class VideoRenderingCentralizer {
  private static instance: VideoRenderingCentralizer;
  private renderingSources = new Set<string>();

  static getInstance(): VideoRenderingCentralizer {
    if (!VideoRenderingCentralizer.instance) {
      VideoRenderingCentralizer.instance = new VideoRenderingCentralizer();
    }
    return VideoRenderingCentralizer.instance;
  }

  registerRenderingSource(sourceName: string) {
    this.renderingSources.add(sourceName);
    console.log(`📝 VIDEO-CENTRALIZER: Registered rendering source: ${sourceName}`);
    console.log(`📝 VIDEO-CENTRALIZER: Active sources:`, Array.from(this.renderingSources));
  }

  unregisterRenderingSource(sourceName: string) {
    this.renderingSources.delete(sourceName);
    console.log(`📝 VIDEO-CENTRALIZER: Unregistered rendering source: ${sourceName}`);
  }

  isAuthorizedToRender(sourceName: string): boolean {
    // Only StreamDisplayManager is authorized to create video elements
    return sourceName === 'StreamDisplayManager';
  }

  reportUnauthorizedRender(sourceName: string, participantId: string) {
    console.warn(`🚨 VIDEO-CENTRALIZER: UNAUTHORIZED rendering attempt by ${sourceName} for ${participantId}`);
    console.warn(`🚨 VIDEO-CENTRALIZER: Only StreamDisplayManager should create video elements!`);
    
    // Emit warning event
    window.dispatchEvent(new CustomEvent('unauthorized-video-render', {
      detail: { sourceName, participantId, timestamp: Date.now() }
    }));
  }

  getAllActiveSources(): string[] {
    return Array.from(this.renderingSources);
  }

  getStats() {
    return {
      activeSources: this.getAllActiveSources(),
      totalSources: this.renderingSources.size,
      authorizedSources: ['StreamDisplayManager']
    };
  }
}

// Global instance for easy access
export const videoRenderingCentralizer = VideoRenderingCentralizer.getInstance();