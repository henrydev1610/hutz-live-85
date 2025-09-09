/**
 * FASE 1: Camera Priming Utility - Temporal offscreen priming
 * Remove offscreen element before returning stream to prevent conflicts
 */

export class CameraPriming {
  private static offscreenVideo: HTMLVideoElement | null = null;

  /**
   * Prime camera with temporal offscreen element that gets removed
   */
  static async primeStreamTemporarily(stream: MediaStream): Promise<void> {
    console.log('🔄 [CAMERA-PRIMING] Starting temporal priming process');
    
    // Clean up any existing element
    if (this.offscreenVideo) {
      this.offscreenVideo.srcObject = null;
      this.offscreenVideo.remove();
      this.offscreenVideo = null;
    }

    // Create invisible element for priming
    this.offscreenVideo = document.createElement('video');
    this.offscreenVideo.style.position = 'absolute';
    this.offscreenVideo.style.left = '-9999px';
    this.offscreenVideo.style.top = '-9999px';
    this.offscreenVideo.style.width = '1px';
    this.offscreenVideo.style.height = '1px';
    this.offscreenVideo.style.opacity = '0';
    this.offscreenVideo.style.pointerEvents = 'none';
    this.offscreenVideo.muted = true;
    this.offscreenVideo.playsInline = true;
    this.offscreenVideo.autoplay = true;

    // Attach and prime
    this.offscreenVideo.srcObject = stream;
    document.body.appendChild(this.offscreenVideo);

    try {
      await this.offscreenVideo.play();
      console.log('📱 [CAMERA-PRIMING] Offscreen element playing, draining frames...');
      
      // Wait for frame drainage with enhanced detection
      await new Promise<void>(resolve => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('📱 [CAMERA-PRIMING] Frame drainage timeout (2s)');
            resolve();
          }
        }, 2000);
        
        // Try advanced frame detection
        if (this.offscreenVideo && 'requestVideoFrameCallback' in this.offscreenVideo) {
          (this.offscreenVideo as any).requestVideoFrameCallback(() => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              console.log('📱 [CAMERA-PRIMING] Frame detected via callback');
              resolve();
            }
          });
        } else {
          // Fallback: loadeddata + buffer time
          const onLoadedData = () => {
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('📱 [CAMERA-PRIMING] Frame drainage via loadeddata + 500ms buffer');
                resolve();
              }
            }, 500);
          };
          this.offscreenVideo?.addEventListener('loadeddata', onLoadedData, { once: true });
        }
      });

    } catch (error) {
      console.warn('⚠️ [CAMERA-PRIMING] Priming play failed, but continuing:', error);
    } finally {
      // CRITICAL: Always remove offscreen element after priming
      console.log('🧹 [CAMERA-PRIMING] Removing offscreen element - stream now free for preview');
      if (this.offscreenVideo) {
        this.offscreenVideo.srcObject = null;
        this.offscreenVideo.remove();
        this.offscreenVideo = null;
      }
    }
  }

  /**
   * Clean up any remaining priming resources
   */
  static cleanup(): void {
    if (this.offscreenVideo) {
      this.offscreenVideo.srcObject = null;
      this.offscreenVideo.remove();
      this.offscreenVideo = null;
    }
  }
}