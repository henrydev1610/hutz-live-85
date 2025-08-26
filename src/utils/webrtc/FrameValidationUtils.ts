/**
 * FASE 1: Track Frame Validation Utils
 * 
 * Utilities to validate if video tracks are producing actual frames
 * before adding them to WebRTC connections.
 */

export interface FrameValidationResult {
  isValid: boolean;
  videoWidth: number;
  videoHeight: number;
  reason?: string;
}

export class FrameValidationUtils {
  /**
   * Validates if a video track is producing frames with proper dimensions
   */
  static async validateTrackFrameProduction(
    track: MediaStreamTrack, 
    timeoutMs: number = 5000
  ): Promise<FrameValidationResult> {
    if (track.kind !== 'video') {
      return { isValid: false, videoWidth: 0, videoHeight: 0, reason: 'Not a video track' };
    }

    if (track.readyState !== 'live' || !track.enabled || track.muted) {
      return { 
        isValid: false, 
        videoWidth: 0, 
        videoHeight: 0, 
        reason: `Track state invalid: readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}` 
      };
    }

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'absolute';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';

      const stream = new MediaStream([track]);
      video.srcObject = stream;

      const timeout = setTimeout(() => {
        cleanup();
        resolve({ 
          isValid: false, 
          videoWidth: 0, 
          videoHeight: 0, 
          reason: `Frame validation timeout after ${timeoutMs}ms` 
        });
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        video.srcObject = null;
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      };

      const checkFrames = () => {
        if (video.videoWidth > 2 && video.videoHeight > 2) {
          cleanup();
          console.log(`✅ FRAME-VALIDATION: Track producing frames ${video.videoWidth}x${video.videoHeight}`);
          resolve({
            isValid: true,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          });
        }
      };

      video.addEventListener('loadedmetadata', checkFrames);
      video.addEventListener('playing', checkFrames);
      video.addEventListener('canplay', checkFrames);

      // Polling fallback
      const pollInterval = setInterval(() => {
        if (video.videoWidth > 2 && video.videoHeight > 2) {
          clearInterval(pollInterval);
          checkFrames();
        }
      }, 100);

      setTimeout(() => clearInterval(pollInterval), timeoutMs);

      document.body.appendChild(video);
      video.play().catch(error => {
        console.warn('⚠️ FRAME-VALIDATION: Video play failed:', error);
      });
    });
  }

  /**
   * Validates all video tracks in a stream
   */
  static async validateStreamFrameProduction(
    stream: MediaStream, 
    timeoutMs: number = 5000
  ): Promise<{ allValid: boolean; results: FrameValidationResult[]; validTracks: MediaStreamTrack[] }> {
    const videoTracks = stream.getVideoTracks();
    
    if (videoTracks.length === 0) {
      return { 
        allValid: false, 
        results: [{ isValid: false, videoWidth: 0, videoHeight: 0, reason: 'No video tracks in stream' }],
        validTracks: []
      };
    }

    console.log(`🔍 FRAME-VALIDATION: Validating ${videoTracks.length} video tracks`);

    const results = await Promise.all(
      videoTracks.map(track => this.validateTrackFrameProduction(track, timeoutMs))
    );

    const validTracks = videoTracks.filter((_, index) => results[index].isValid);
    const allValid = results.every(result => result.isValid);

    console.log(`🔍 FRAME-VALIDATION: Results - ${validTracks.length}/${videoTracks.length} tracks valid`);

    return { allValid, results, validTracks };
  }

  /**
   * Applies constraints to ensure minimum video dimensions
   */
  static async applyMinimumConstraints(track: MediaStreamTrack): Promise<boolean> {
    if (track.kind !== 'video') return false;

    try {
      await track.applyConstraints({
        width: { min: 320 },
        height: { min: 240 },
        frameRate: { min: 15 }
      });
      
      console.log('✅ FRAME-VALIDATION: Applied minimum constraints to track');
      return true;
    } catch (error) {
      console.warn('⚠️ FRAME-VALIDATION: Failed to apply constraints:', error);
      return false;
    }
  }
}