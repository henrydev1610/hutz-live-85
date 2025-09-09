/**
 * Camera Priming - Invisible video element to warm up camera and reduce muted period
 * Attaches stream to 1px offscreen video to drain frames immediately after getUserMedia
 */

class CameraPrimingManager {
  private primingVideo: HTMLVideoElement | null = null;
  private isPriming: boolean = false;

  /**
   * Prime camera by attaching stream to invisible video element
   * This reduces the muted period from ~1500ms to ~200ms
   */
  async primeCamera(stream: MediaStream): Promise<void> {
    if (this.isPriming) {
      console.log('🔥 [PRIME] Camera priming already in progress, skipping');
      return;
    }

    this.isPriming = true;
    console.log('🔥 [PRIME] Starting invisible camera priming to drain frames');

    try {
      // Create invisible 1px video element
      this.primingVideo = document.createElement('video');
      this.primingVideo.style.position = 'absolute';
      this.primingVideo.style.top = '-9999px';
      this.primingVideo.style.left = '-9999px';
      this.primingVideo.style.width = '1px';
      this.primingVideo.style.height = '1px';
      this.primingVideo.style.opacity = '0';
      this.primingVideo.muted = true;
      this.primingVideo.playsInline = true;
      this.primingVideo.autoplay = true;

      // Attach stream and play to start draining frames
      this.primingVideo.srcObject = stream;
      document.body.appendChild(this.primingVideo);

      // Wait for video to start playing
      await this.primingVideo.play();
      
      console.log('🔥 [PRIME] Camera priming started, draining frames for 1 second');

      // Let it drain frames for 1 second to warm up camera
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ [PRIME] Camera priming completed - stream should be ready');

    } catch (error) {
      console.warn('⚠️ [PRIME] Camera priming failed, but continuing:', error);
    } finally {
      this.isPriming = false;
    }
  }

  /**
   * Wait for track to become unmuted (up to 2 seconds)
   * Returns true if track became unmuted, false if timeout
   */
  async waitForUnmute(track: MediaStreamTrack, timeoutMs: number = 2000): Promise<boolean> {
    if (!track.muted) {
      console.log('🔥 [PRIME] Track already unmuted, proceeding immediately');
      return true;
    }

    console.log('🔥 [PRIME] Track is muted, waiting up to 2s for unmute event');

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ [PRIME] Track still muted after 2s timeout');
        track.removeEventListener('unmute', onUnmute);
        resolve(false);
      }, timeoutMs);

      const onUnmute = () => {
        console.log('✅ [PRIME] Track unmuted successfully');
        clearTimeout(timeout);
        track.removeEventListener('unmute', onUnmute);
        resolve(true);
      };

      track.addEventListener('unmute', onUnmute, { once: true });
    });
  }

  /**
   * Check if track is ready for WebRTC (live and enabled, muted is OK)
   */
  isTrackReady(track: MediaStreamTrack): boolean {
    const ready = track.readyState === 'live' && track.enabled;
    console.log('🔍 [PRIME] Track readiness check:', {
      kind: track.kind,
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted,
      ready
    });
    return ready;
  }

  /**
   * Clean up priming resources
   */
  cleanup(): void {
    if (this.primingVideo) {
      try {
        this.primingVideo.pause();
        this.primingVideo.srcObject = null;
        if (this.primingVideo.parentNode) {
          this.primingVideo.parentNode.removeChild(this.primingVideo);
        }
      } catch (error) {
        console.warn('⚠️ [PRIME] Cleanup error:', error);
      }
      this.primingVideo = null;
    }
    this.isPriming = false;
    console.log('🧹 [PRIME] Camera priming cleanup completed');
  }
}

// Export singleton instance
export const cameraPriming = new CameraPrimingManager();