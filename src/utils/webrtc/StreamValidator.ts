export interface StreamValidationResult {
  isValid: boolean;
  score: number; // 0-100 quality score
  issues: string[];
  recommendations: string[];
}

export class StreamValidator {
  private static readonly MIN_DIMENSIONS = { width: 160, height: 120 };
  private static readonly IDEAL_DIMENSIONS = { width: 640, height: 480 };
  private static readonly MIN_FRAME_RATE = 5;
  private static readonly IDEAL_FRAME_RATE = 15;

  static async validateStream(stream: MediaStream): Promise<StreamValidationResult> {
    console.log('🔍 VALIDATOR: Starting stream validation');

    const result: StreamValidationResult = {
      isValid: false,
      score: 0,
      issues: [],
      recommendations: []
    };

    if (!stream) {
      result.issues.push('Stream is null or undefined');
      return result;
    }

    if (!stream.active) {
      result.issues.push('Stream is not active');
      return result;
    }

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    // Basic track validation
    if (videoTracks.length === 0) {
      result.issues.push('No video tracks found');
    } else {
      result.score += 40; // Base score for having video
    }

    if (audioTracks.length === 0) {
      result.issues.push('No audio tracks found');
    } else {
      result.score += 20; // Additional score for audio
    }

    // Video track quality validation
    if (videoTracks.length > 0) {
      const videoTrack = videoTracks[0];
      const settings = videoTrack.getSettings();
      const capabilities = videoTrack.getCapabilities();

      console.log('🔍 VALIDATOR: Video track settings:', settings);
      console.log('🔍 VALIDATOR: Video track capabilities:', capabilities);

      // Check track state
      if (videoTrack.readyState !== 'live') {
        result.issues.push(`Video track not live: ${videoTrack.readyState}`);
      } else {
        result.score += 10;
      }

      if (videoTrack.enabled === false) {
        result.issues.push('Video track is disabled');
      } else {
        result.score += 5;
      }

      if (videoTrack.muted) {
        result.issues.push('Video track is muted');
      } else {
        result.score += 5;
      }

      // Dimension validation
      if (settings.width && settings.height) {
        if (settings.width < this.MIN_DIMENSIONS.width || settings.height < this.MIN_DIMENSIONS.height) {
          result.issues.push(`Resolution too low: ${settings.width}x${settings.height}`);
        } else {
          result.score += 10;
          
          if (settings.width >= this.IDEAL_DIMENSIONS.width && settings.height >= this.IDEAL_DIMENSIONS.height) {
            result.score += 5;
          }
        }
      } else {
        result.issues.push('Video dimensions not available');
      }

      // Frame rate validation
      if (settings.frameRate) {
        if (settings.frameRate < this.MIN_FRAME_RATE) {
          result.issues.push(`Frame rate too low: ${settings.frameRate}fps`);
        } else {
          result.score += 5;
          
          if (settings.frameRate >= this.IDEAL_FRAME_RATE) {
            result.score += 5;
          }
        }
      }

      // Device orientation and facing mode
      if (settings.facingMode) {
        console.log('📱 VALIDATOR: Camera facing mode:', settings.facingMode);
        if (settings.facingMode === 'environment') {
          result.score += 5; // Bonus for rear camera (usually better quality)
        }
      }
    }

    // Audio track validation
    if (audioTracks.length > 0) {
      const audioTrack = audioTracks[0];
      const settings = audioTrack.getSettings();

      if (audioTrack.readyState !== 'live') {
        result.issues.push(`Audio track not live: ${audioTrack.readyState}`);
      }

      if (audioTrack.enabled === false) {
        result.issues.push('Audio track is disabled');
      }

      if (audioTrack.muted) {
        result.issues.push('Audio track is muted');
      }
    }

    // Generate recommendations
    this.generateRecommendations(result, videoTracks, audioTracks);

    // Final validation
    result.isValid = result.issues.length === 0 && result.score >= 50;

    console.log('🔍 VALIDATOR: Validation complete:', {
      isValid: result.isValid,
      score: result.score,
      issuesCount: result.issues.length,
      recommendationsCount: result.recommendations.length
    });

    return result;
  }

  private static generateRecommendations(
    result: StreamValidationResult,
    videoTracks: MediaStreamTrack[],
    audioTracks: MediaStreamTrack[]
  ) {
    if (videoTracks.length === 0) {
      result.recommendations.push('Enable camera access for video streaming');
    } else {
      const videoTrack = videoTracks[0];
      const settings = videoTrack.getSettings();

      if (settings.width && settings.height) {
        if (settings.width < this.IDEAL_DIMENSIONS.width) {
          result.recommendations.push('Consider using a higher resolution camera');
        }
      }

      if (settings.frameRate && settings.frameRate < this.IDEAL_FRAME_RATE) {
        result.recommendations.push('Increase frame rate for smoother video');
      }

      if (settings.facingMode === 'user') {
        result.recommendations.push('Switch to rear camera for better quality');
      }
    }

    if (audioTracks.length === 0) {
      result.recommendations.push('Enable microphone for audio streaming');
    }

    if (result.score < 70) {
      result.recommendations.push('Check device capabilities and permissions');
    }
  }

  static async testStreamPlayback(stream: MediaStream): Promise<boolean> {
    console.log('🎥 VALIDATOR: Testing stream playback');

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('🎥 VALIDATOR: Playback test timeout');
          resolve(false);
        }
      }, 5000);

      video.addEventListener('loadedmetadata', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log('✅ VALIDATOR: Stream playback test passed');
          resolve(true);
        }
      });

      video.addEventListener('error', (e) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.error('❌ VALIDATOR: Stream playback test failed:', e);
          resolve(false);
        }
      });

      video.srcObject = stream;
    });
  }

  static getStreamMetrics(stream: MediaStream) {
    if (!stream) return null;

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    return {
      streamId: stream.id,
      active: stream.active,
      videoTracks: videoTracks.map(track => ({
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
        capabilities: track.getCapabilities?.() || {}
      })),
      audioTracks: audioTracks.map(track => ({
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings()
      }))
    };
  }
}