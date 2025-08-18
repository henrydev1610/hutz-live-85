// ✅ ETAPA 4: DEBUGGING E MONITORAMENTO UTILITIES

export interface StreamDebugInfo {
  participantId: string;
  streamId?: string;
  trackCount: number;
  hasVideo: boolean;
  hasAudio: boolean;
  containerExists: boolean;
  videoElementExists: boolean;
  isPlaying: boolean;
  timestamp: number;
}

export class StreamDebugUtils {
  private static instance: StreamDebugUtils;
  private debugLog: StreamDebugInfo[] = [];

  static getInstance(): StreamDebugUtils {
    if (!StreamDebugUtils.instance) {
      StreamDebugUtils.instance = new StreamDebugUtils();
    }
    return StreamDebugUtils.instance;
  }

  logStreamInfo(participantId: string, stream?: MediaStream): void {
    const info: StreamDebugInfo = {
      participantId,
      streamId: stream?.id?.substring(0, 8),
      trackCount: stream?.getTracks()?.length || 0,
      hasVideo: stream?.getVideoTracks()?.length > 0 || false,
      hasAudio: stream?.getAudioTracks()?.length > 0 || false,
      containerExists: this.checkContainerExists(participantId),
      videoElementExists: this.checkVideoElementExists(participantId),
      isPlaying: this.checkVideoPlaying(participantId),
      timestamp: Date.now()
    };

    this.debugLog.push(info);
    
    // Keep only last 50 entries
    if (this.debugLog.length > 50) {
      this.debugLog.shift();
    }

    console.log(`🔍 STREAM DEBUG: ${participantId}`, info);
  }

  private checkContainerExists(participantId: string): boolean {
    const selectors = [
      `#video-container-${participantId}`,
      `#unified-video-${participantId}`,
      `[data-participant-id="${participantId}"]`
    ];

    return selectors.some(selector => document.querySelector(selector) !== null);
  }

  private checkVideoElementExists(participantId: string): boolean {
    const selectors = [
      `#stream-video-${participantId}`,
      `video[data-participant-id="${participantId}"]`,
      `#video-container-${participantId} video`,
      `#unified-video-${participantId} video`
    ];

    return selectors.some(selector => document.querySelector(selector) !== null);
  }

  private checkVideoPlaying(participantId: string): boolean {
    const videoElement = document.querySelector(`#stream-video-${participantId}`) as HTMLVideoElement;
    return videoElement ? !videoElement.paused && !videoElement.ended : false;
  }

  getDebugLog(): StreamDebugInfo[] {
    return [...this.debugLog];
  }

  getParticipantDebugInfo(participantId: string): StreamDebugInfo[] {
    return this.debugLog.filter(info => info.participantId === participantId);
  }

  clearDebugLog(): void {
    this.debugLog = [];
    console.log('🧹 STREAM DEBUG: Log cleared');
  }

  // Global debug functions for console access
  exposeGlobalDebugFunctions(): void {
    (window as any).__streamDebug = {
      getLog: () => this.getDebugLog(),
      getParticipantInfo: (id: string) => this.getParticipantDebugInfo(id),
      clear: () => this.clearDebugLog(),
      checkContainers: () => {
        const containers = document.querySelectorAll('[data-participant-id], [id*="video-container"], [id*="unified-video"]');
        console.log(`📦 Available containers (${containers.length}):`, Array.from(containers).map(c => ({
          id: c.id,
          participantId: c.getAttribute('data-participant-id'),
          className: c.className
        })));
        return containers;
      },
      checkVideos: () => {
        const videos = document.querySelectorAll('video');
        console.log(`🎥 Available videos (${videos.length}):`, Array.from(videos).map(v => ({
          id: v.id,
          src: v.src,
          srcObject: !!v.srcObject,
          paused: v.paused,
          ended: v.ended
        })));
        return videos;
      }
    };

    console.log('🔧 STREAM DEBUG: Global functions available at window.__streamDebug');
  }
}

// Export singleton instance
export const streamDebugUtils = StreamDebugUtils.getInstance();
