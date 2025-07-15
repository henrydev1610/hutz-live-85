/**
 * Video Error Handler - Handles video playback errors and stream recovery
 */

export class VideoErrorHandler {
  private static instance: VideoErrorHandler;
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private streamReconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;

  static getInstance(): VideoErrorHandler {
    if (!VideoErrorHandler.instance) {
      VideoErrorHandler.instance = new VideoErrorHandler();
    }
    return VideoErrorHandler.instance;
  }

  // Register video element for monitoring
  registerVideoElement(participantId: string, videoElement: HTMLVideoElement): void {
    console.log(`📹 VIDEO HANDLER: Registering video element for ${participantId}`);
    
    this.videoElements.set(participantId, videoElement);
    this.setupVideoEventHandlers(participantId, videoElement);
  }

  // Setup comprehensive video event handlers
  private setupVideoEventHandlers(participantId: string, videoElement: HTMLVideoElement): void {
    // Handle video errors
    videoElement.addEventListener('error', (event) => {
      console.error(`❌ VIDEO ERROR for ${participantId}:`, event);
      this.handleVideoError(participantId, videoElement);
    });

    // Handle video stalled
    videoElement.addEventListener('stalled', () => {
      console.warn(`⚠️ VIDEO STALLED for ${participantId}`);
      this.handleVideoStalled(participantId, videoElement);
    });

    // Handle video suspended
    videoElement.addEventListener('suspend', () => {
      console.warn(`⚠️ VIDEO SUSPENDED for ${participantId}`);
      this.handleVideoSuspended(participantId, videoElement);
    });

    // Handle video abort
    videoElement.addEventListener('abort', () => {
      console.warn(`⚠️ VIDEO ABORTED for ${participantId}`);
      this.handleVideoAbort(participantId, videoElement);
    });

    // Handle video emptied
    videoElement.addEventListener('emptied', () => {
      console.warn(`⚠️ VIDEO EMPTIED for ${participantId}`);
      this.handleVideoEmptied(participantId, videoElement);
    });

    // Handle loadstart
    videoElement.addEventListener('loadstart', () => {
      console.log(`📹 VIDEO LOADSTART for ${participantId}`);
      this.resetReconnectAttempts(participantId);
    });

    // Handle canplay
    videoElement.addEventListener('canplay', () => {
      console.log(`✅ VIDEO CANPLAY for ${participantId}`);
      this.attemptVideoPlay(participantId, videoElement);
    });
  }

  // Handle video errors
  private handleVideoError(participantId: string, videoElement: HTMLVideoElement): void {
    const error = videoElement.error;
    console.error(`❌ VIDEO ERROR DETAILS for ${participantId}:`, {
      code: error?.code,
      message: error?.message,
      networkState: videoElement.networkState,
      readyState: videoElement.readyState
    });

    // Try to recover based on error type
    if (error?.code === MediaError.MEDIA_ERR_NETWORK) {
      console.log(`🔄 NETWORK ERROR: Attempting stream recovery for ${participantId}`);
      this.attemptStreamRecovery(participantId, videoElement);
    } else if (error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      console.log(`🔄 SRC ERROR: Attempting stream reset for ${participantId}`);
      this.resetVideoStream(participantId, videoElement);
    }
  }

  // Handle video stalled
  private handleVideoStalled(participantId: string, videoElement: HTMLVideoElement): void {
    setTimeout(() => {
      if (videoElement.readyState < 3) { // HAVE_FUTURE_DATA
        console.log(`🔄 VIDEO STILL STALLED: Attempting recovery for ${participantId}`);
        this.attemptStreamRecovery(participantId, videoElement);
      }
    }, 3000);
  }

  // Handle video suspended
  private handleVideoSuspended(participantId: string, videoElement: HTMLVideoElement): void {
    setTimeout(() => {
      if (videoElement.networkState === HTMLMediaElement.NETWORK_IDLE) {
        console.log(`🔄 VIDEO SUSPENDED: Attempting to resume for ${participantId}`);
        videoElement.load();
      }
    }, 2000);
  }

  // Handle video abort
  private handleVideoAbort(participantId: string, videoElement: HTMLVideoElement): void {
    console.log(`🔄 VIDEO ABORT: Attempting to restart for ${participantId}`);
    setTimeout(() => {
      if (videoElement.srcObject) {
        this.attemptVideoPlay(participantId, videoElement);
      }
    }, 1000);
  }

  // Handle video emptied
  private handleVideoEmptied(participantId: string, videoElement: HTMLVideoElement): void {
    console.log(`🔄 VIDEO EMPTIED: Stream removed for ${participantId}`);
    // This often happens when stream is being replaced
    // Wait a bit to see if new stream is assigned
    setTimeout(() => {
      if (!videoElement.srcObject) {
        console.log(`⚠️ VIDEO EMPTY: No stream assigned to ${participantId}`);
        this.requestStreamReconnection(participantId);
      }
    }, 2000);
  }

  // Attempt video play with error handling
  private async attemptVideoPlay(participantId: string, videoElement: HTMLVideoElement): Promise<void> {
    try {
      console.log(`▶️ ATTEMPTING PLAY for ${participantId}`);
      
      // Ensure video is not muted for better compatibility
      videoElement.muted = true;
      videoElement.playsInline = true;
      
      await videoElement.play();
      console.log(`✅ VIDEO PLAYING for ${participantId}`);
      
    } catch (error) {
      console.error(`❌ PLAY ERROR for ${participantId}:`, error);
      
      // Handle specific play errors
      if (error instanceof DOMException) {
        if (error.name === 'AbortError') {
          console.log(`🔄 PLAY ABORTED: Retrying for ${participantId}`);
          setTimeout(() => {
            this.attemptVideoPlay(participantId, videoElement);
          }, 1000);
        } else if (error.name === 'NotSupportedError') {
          console.log(`🔄 NOT SUPPORTED: Resetting stream for ${participantId}`);
          this.resetVideoStream(participantId, videoElement);
        }
      }
    }
  }

  // Attempt stream recovery
  private attemptStreamRecovery(participantId: string, videoElement: HTMLVideoElement): void {
    const attempts = this.streamReconnectAttempts.get(participantId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error(`❌ MAX RECOVERY ATTEMPTS REACHED for ${participantId}`);
      return;
    }

    this.streamReconnectAttempts.set(participantId, attempts + 1);
    
    console.log(`🔄 STREAM RECOVERY attempt ${attempts + 1} for ${participantId}`);
    
    // Request stream reconnection from WebRTC manager
    this.requestStreamReconnection(participantId);
    
    // If still no stream after 5 seconds, try again
    setTimeout(() => {
      if (!videoElement.srcObject || videoElement.readyState === 0) {
        this.attemptStreamRecovery(participantId, videoElement);
      }
    }, 5000);
  }

  // Reset video stream
  private resetVideoStream(participantId: string, videoElement: HTMLVideoElement): void {
    console.log(`🔄 RESETTING VIDEO STREAM for ${participantId}`);
    
    // Clear current stream
    videoElement.srcObject = null;
    
    // Request new stream
    setTimeout(() => {
      this.requestStreamReconnection(participantId);
    }, 1000);
  }

  // Request stream reconnection from WebRTC manager
  private requestStreamReconnection(participantId: string): void {
    console.log(`📡 REQUESTING STREAM RECONNECTION for ${participantId}`);
    
    // Trigger WebRTC reconnection
    import('@/utils/webrtc').then(({ forceParticipantReconnection }) => {
      forceParticipantReconnection(participantId).catch(error => {
        console.error(`❌ FORCE RECONNECTION FAILED for ${participantId}:`, error);
      });
    });
  }

  // Reset reconnect attempts
  private resetReconnectAttempts(participantId: string): void {
    this.streamReconnectAttempts.delete(participantId);
  }

  // Cleanup video element
  cleanup(participantId: string): void {
    const videoElement = this.videoElements.get(participantId);
    if (videoElement) {
      // Clear video source
      videoElement.srcObject = null;
      
      this.videoElements.delete(participantId);
      this.streamReconnectAttempts.delete(participantId);
    }
  }

  // Update video stream
  updateVideoStream(participantId: string, stream: MediaStream): void {
    const videoElement = this.videoElements.get(participantId);
    if (videoElement) {
      console.log(`📹 UPDATING VIDEO STREAM for ${participantId}:`, {
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        active: stream.active
      });
      
      videoElement.srcObject = stream;
      this.resetReconnectAttempts(participantId);
      
      // Attempt to play after stream update
      setTimeout(() => {
        this.attemptVideoPlay(participantId, videoElement);
      }, 100);
    }
  }
}

// Export singleton instance
export const videoErrorHandler = VideoErrorHandler.getInstance();