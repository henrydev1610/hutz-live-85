// FASE 4: VIDEO PLAYBACK ENFORCER - Garante que vídeos não fiquem pausados
export class VideoPlaybackEnforcer {
  private static instance: VideoPlaybackEnforcer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoredVideos = new Set<HTMLVideoElement>();

  static getInstance(): VideoPlaybackEnforcer {
    if (!VideoPlaybackEnforcer.instance) {
      VideoPlaybackEnforcer.instance = new VideoPlaybackEnforcer();
    }
    return VideoPlaybackEnforcer.instance;
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      return;
    }

    console.log('🎯 VIDEO-ENFORCER: Starting video playback monitoring');

    this.monitoringInterval = setInterval(() => {
      this.checkAndEnforcePlayback();
    }, 2000); // Check every 2 seconds
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.monitoredVideos.clear();
      console.log('🛑 VIDEO-ENFORCER: Stopped video playback monitoring');
    }
  }

  registerVideo(video: HTMLVideoElement) {
    this.monitoredVideos.add(video);
    console.log(`📹 VIDEO-ENFORCER: Registered video ${video.id || 'unknown'} for monitoring`);
  }

  unregisterVideo(video: HTMLVideoElement) {
    this.monitoredVideos.delete(video);
    console.log(`📹 VIDEO-ENFORCER: Unregistered video ${video.id || 'unknown'} from monitoring`);
  }

  private checkAndEnforcePlayback() {
    const videosToCheck = Array.from(document.querySelectorAll('video[data-unified-video="true"]')) as HTMLVideoElement[];
    
    videosToCheck.forEach(video => {
      const participantId = video.getAttribute('data-participant-id');
      
      if (video.srcObject && video.paused) {
        console.warn(`⚠️ VIDEO-ENFORCER: Found paused video for ${participantId}, forcing play`);
        
        video.play().then(() => {
          console.log(`✅ VIDEO-ENFORCER: Successfully resumed video for ${participantId}`);
        }).catch(error => {
          console.error(`❌ VIDEO-ENFORCER: Failed to resume video for ${participantId}:`, error);
        });
      }
    });

    // Log monitoring status
    console.log(`💓 VIDEO-ENFORCER: Monitoring ${videosToCheck.length} videos`);
  }

  // Force play for specific participant
  forcePlayForParticipant(participantId: string): boolean {
    const video = document.querySelector(`video[data-participant-id="${participantId}"]`) as HTMLVideoElement;
    
    if (!video) {
      console.warn(`⚠️ VIDEO-ENFORCER: No video found for ${participantId}`);
      return false;
    }

    if (video.paused && video.srcObject) {
      console.log(`🔄 VIDEO-ENFORCER: Force playing video for ${participantId}`);
      video.play().catch(error => {
        console.error(`❌ VIDEO-ENFORCER: Failed to force play for ${participantId}:`, error);
      });
      return true;
    }

    return false;
  }

  getStatus() {
    const allVideos = Array.from(document.querySelectorAll('video[data-unified-video="true"]')) as HTMLVideoElement[];
    
    return {
      totalVideos: allVideos.length,
      playingVideos: allVideos.filter(v => !v.paused).length,
      pausedVideos: allVideos.filter(v => v.paused && v.srcObject).length,
      videosWithStreams: allVideos.filter(v => v.srcObject).length,
      isMonitoring: !!this.monitoringInterval
    };
  }
}

// Global instance
export const videoPlaybackEnforcer = VideoPlaybackEnforcer.getInstance();

// Auto-start monitoring when module loads
videoPlaybackEnforcer.startMonitoring();

// Debug access
(window as any).__videoPlaybackEnforcer = {
  getStatus: () => videoPlaybackEnforcer.getStatus(),
  forcePlay: (participantId: string) => videoPlaybackEnforcer.forcePlayForParticipant(participantId),
  startMonitoring: () => videoPlaybackEnforcer.startMonitoring(),
  stopMonitoring: () => videoPlaybackEnforcer.stopMonitoring()
};