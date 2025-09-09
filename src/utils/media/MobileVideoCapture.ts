/**
 * Mobile Video-Only Capture Utility
 * Handles video-only stream capture with gesture-based retry and invisible priming
 */

interface CaptureState {
  isCapturing: boolean;
  hasPermission: boolean | null;
  retryOnGesture: boolean;
  primedStream: MediaStream | null;
}

interface GestureListener {
  type: string;
  handler: () => void;
  options?: boolean | AddEventListenerOptions;
}

export class MobileVideoCapture {
  private state: CaptureState = {
    isCapturing: false,
    hasPermission: null,
    retryOnGesture: false,
    primedStream: null
  };

  private offscreenVideo: HTMLVideoElement | null = null;
  private gestureListeners: GestureListener[] = [];
  private visibilityListener: (() => void) | null = null;
  private captureCallback: ((stream: MediaStream) => void) | null = null;

  /**
   * Start automatic video capture on page load
   */
  async startCapture(onSuccess: (stream: MediaStream) => void): Promise<void> {
    if (this.state.isCapturing) return;
    
    this.state.isCapturing = true;
    this.captureCallback = onSuccess;
    
    console.log('📱 [MOBILE-CAPTURE] Starting video-only capture');
    
    try {
      const stream = await this.attemptVideoCapture();
      if (stream) {
        await this.primeCamera(stream);
        this.state.hasPermission = true;
        onSuccess(stream);
        console.log('✅ [MOBILE-CAPTURE] Video capture successful');
      } else {
        this.handleCaptureFailure();
      }
    } catch (error) {
      console.log('⚠️ [MOBILE-CAPTURE] Initial capture failed, setting up gesture retry');
      this.handleCaptureFailure();
    }
  }

  /**
   * Attempt video-only capture (never requests audio)
   */
  private async attemptVideoCapture(): Promise<MediaStream | null> {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      },
      audio: false // NEVER request audio
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📱 [MOBILE-CAPTURE] Video stream obtained:', {
        id: stream.id,
        tracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });
      return stream;
    } catch (error) {
      console.log('⚠️ [MOBILE-CAPTURE] Video capture failed:', error);
      
      // Try fallback constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        console.log('📱 [MOBILE-CAPTURE] Fallback video stream obtained');
        return fallbackStream;
      } catch (fallbackError) {
        console.error('❌ [MOBILE-CAPTURE] All video capture attempts failed');
        return null;
      }
    }
  }

  /**
   * Prime camera with invisible offscreen video element
   * Uses new CameraPriming utility for invisible frame draining
   */
  private async primeCamera(stream: MediaStream): Promise<void> {
    console.log('🔥 [MOBILE-VIDEO] Priming camera with invisible element to drain frames');
    
    // Clean up any existing offscreen video
    if (this.offscreenVideo) {
      this.offscreenVideo.srcObject = null;
      this.offscreenVideo.remove();
      this.offscreenVideo = null;
    }

    try {
      // Create invisible video element to prime the camera
      this.offscreenVideo = document.createElement('video');
      this.offscreenVideo.style.position = 'absolute';
      this.offscreenVideo.style.top = '-9999px';
      this.offscreenVideo.style.left = '-9999px';
      this.offscreenVideo.style.width = '1px';
      this.offscreenVideo.style.height = '1px';
      this.offscreenVideo.style.opacity = '0';
      this.offscreenVideo.muted = true;
      this.offscreenVideo.playsInline = true;
      this.offscreenVideo.autoplay = true;

      // Attach stream and play to start camera
      this.offscreenVideo.srcObject = stream;
      document.body.appendChild(this.offscreenVideo);
      
      await this.offscreenVideo.play();
      console.log('✅ [MOBILE-VIDEO] Camera primed - frames being drained invisibly');
      
      // Let it run for 1 second to properly warm up the camera  
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.state.primedStream = stream;
      
    } catch (error) {
      console.warn('⚠️ [MOBILE-VIDEO] Camera priming failed:', error);
    }
  }

  /**
   * Handle capture failure - set up gesture-based retry
   */
  private handleCaptureFailure(): void {
    this.state.hasPermission = false;
    this.state.retryOnGesture = true;
    
    console.log('🤚 [MOBILE-CAPTURE] Setting up gesture-based retry');
    
    // Set up gesture listeners
    this.setupGestureRetry();
    this.setupVisibilityRetry();
  }

  /**
   * Set up gesture-based retry mechanism
   */
  private setupGestureRetry(): void {
    const gestureTypes = ['pointerdown', 'touchend', 'keydown'];
    
    gestureTypes.forEach(eventType => {
      const handler = () => this.handleGestureRetry();
      
      this.gestureListeners.push({
        type: eventType,
        handler,
        options: { once: true, passive: true }
      });
      
      document.addEventListener(eventType, handler, { once: true, passive: true });
    });
  }

  /**
   * Set up visibility change retry
   */
  private setupVisibilityRetry(): void {
    this.visibilityListener = () => {
      if (!document.hidden && this.state.retryOnGesture) {
        console.log('👁️ [MOBILE-CAPTURE] Document visible, attempting retry');
        this.handleGestureRetry();
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityListener);
  }

  /**
   * Handle gesture-triggered retry
   */
  private async handleGestureRetry(): Promise<void> {
    if (!this.state.retryOnGesture || !this.captureCallback) return;
    
    console.log('🤚 [MOBILE-CAPTURE] Gesture detected, retrying video capture');
    
    this.state.retryOnGesture = false;
    this.cleanup();
    
    try {
      const stream = await this.attemptVideoCapture();
      if (stream) {
        await this.primeCamera(stream);
        this.state.hasPermission = true;
        this.captureCallback(stream);
        console.log('✅ [MOBILE-CAPTURE] Gesture retry successful');
      }
    } catch (error) {
      console.error('❌ [MOBILE-CAPTURE] Gesture retry failed:', error);
    }
  }

  /**
   * Check if video track is healthy for transmission
   * NEW: Allow muted tracks - camera needs time to warm up
   */
  isTrackHealthy(track: MediaStreamTrack): boolean {
    // Only check readyState and enabled - muted is OK during warmup
    return track.readyState === 'live' && track.enabled === true;
  }

  /**
   * Get current capture state
   */
  getState(): CaptureState {
    return { ...this.state };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Remove gesture listeners
    this.gestureListeners.forEach(({ type, handler }) => {
      document.removeEventListener(type, handler);
    });
    this.gestureListeners = [];

    // Remove visibility listener
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }

    // Clean up offscreen video
    if (this.offscreenVideo) {
      this.offscreenVideo.srcObject = null;
      this.offscreenVideo.remove();
      this.offscreenVideo = null;
    }

    // Reset state
    this.state = {
      isCapturing: false,
      hasPermission: null,
      retryOnGesture: false,
      primedStream: null
    };
  }
}

// Singleton instance
export const mobileVideoCapture = new MobileVideoCapture();