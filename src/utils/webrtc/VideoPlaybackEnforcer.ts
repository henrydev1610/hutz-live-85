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
    
    let playingCount = 0;
    let pausedWithStreamCount = 0;
    let totalWithStreamCount = 0;
    let unhealthyVideos = 0;
    
    videosToCheck.forEach(video => {
      const participantId = video.getAttribute('data-participant-id') || 'unknown';
      const hasStream = !!video.srcObject;
      
      if (hasStream) {
        totalWithStreamCount++;
        
        // FASE 4: Validação mais rigorosa de saúde do video
        const isVideoHealthy = this.validateVideoHealth(video);
        
        if (!isVideoHealthy) {
          unhealthyVideos++;
          console.warn(`🩺 VIDEO-ENFORCER: Unhealthy video detected for ${participantId}:`, {
            paused: video.paused,
            ended: video.ended,
            readyState: video.readyState,
            networkState: video.networkState,
            error: video.error?.message
          });
        }
        
        if (video.paused) {
          pausedWithStreamCount++;
          console.warn(`⚠️ VIDEO-ENFORCER: Found paused video for ${participantId}, forcing play`);
          
          // FASE 4: Recovery mais robusto
          this.forceVideoRecovery(video, participantId);
        } else {
          playingCount++;
        }
      }
    });

    // FASE 4: Enhanced monitoring status com mais detalhes
    const status = {
      totalVideos: videosToCheck.length,
      videosWithStream: totalWithStreamCount,
      playing: playingCount,
      pausedWithStream: pausedWithStreamCount,
      unhealthy: unhealthyVideos,
      timestamp: new Date().toISOString()
    };

    console.log(`💓 VIDEO-ENFORCER: Status`, status);

    // FASE 4: Dispatch evento para debug se há problemas
    if (pausedWithStreamCount > 0 || unhealthyVideos > 0) {
      window.dispatchEvent(new CustomEvent('video-enforcer-issues', {
        detail: status
      }));
    }
  }

  // FASE 4: Validação detalhada da saúde do vídeo
  private validateVideoHealth(video: HTMLVideoElement): boolean {
    if (video.paused || video.ended) return false;
    if (video.readyState < 2) return false; // HAVE_CURRENT_DATA
    if (video.error) return false;
    if (!video.srcObject) return false;

    // Verificar se o stream está ativo
    const stream = video.srcObject as MediaStream;
    if (!stream || !stream.active) return false;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const activeVideoTracks = videoTracks.filter(track => 
      track.readyState === 'live' && track.enabled && !track.muted
    );

    return activeVideoTracks.length > 0;
  }

  // FASE 4: Recovery mais sofisticado
  private async forceVideoRecovery(video: HTMLVideoElement, participantId: string): Promise<void> {
    try {
      // Attempt 1: Simple play
      await video.play();
      console.log(`✅ VIDEO-ENFORCER: Successfully resumed video for ${participantId}`);
    } catch (error) {
      console.warn(`⚠️ VIDEO-ENFORCER: Simple play failed for ${participantId}, attempting recovery...`);
      
      try {
        // Attempt 2: Reset and play
        const currentSrc = video.srcObject;
        video.srcObject = null;
        await new Promise(resolve => setTimeout(resolve, 50));
        video.srcObject = currentSrc;
        await video.play();
        
        console.log(`✅ VIDEO-ENFORCER: Recovery successful for ${participantId}`);
      } catch (recoveryError) {
        console.error(`❌ VIDEO-ENFORCER: Recovery failed for ${participantId}:`, recoveryError);
        
        // FASE 4: Notificar falha crítica
        window.dispatchEvent(new CustomEvent('video-recovery-failed', {
          detail: {
            participantId,
            error: recoveryError,
            timestamp: Date.now()
          }
        }));
      }
    }
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