import { MEDIA_CONSTRAINTS } from './WebRTCConfig';

interface MobileOptimizations {
  constraints: MediaStreamConstraints;
  connectionConfig: RTCConfiguration;
  timeouts: {
    initialization: number;
    connection: number;
    stream: number;
  };
  retrySettings: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

export class MobileOptimizer {
  private static isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private static isIOSDevice(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  static getOptimizedSettings(): MobileOptimizations {
    const isMobile = this.isMobileDevice();
    const isIOS = this.isIOSDevice();

    if (!isMobile) {
      return {
        constraints: MEDIA_CONSTRAINTS,
        connectionConfig: {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        },
        timeouts: {
          initialization: 15000,
          connection: 20000,
          stream: 10000
        },
        retrySettings: {
          maxRetries: 5,
          baseDelay: 1000,
          maxDelay: 30000
        }
      };
    }

    // Mobile optimizations
    const mobileConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 15, max: 30 },
        facingMode: 'environment' // Start with rear camera for better quality
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 44100 }
      }
    };

    // iOS-specific adjustments
    if (isIOS && mobileConstraints.video && typeof mobileConstraints.video === 'object') {
      mobileConstraints.video = {
        ...mobileConstraints.video,
        frameRate: { ideal: 12, max: 24 } // Lower frame rate for iOS stability
      };
    }

    return {
      constraints: mobileConstraints,
      connectionConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      },
      timeouts: {
        initialization: 30000, // Longer for mobile
        connection: 45000,     // Much longer for mobile connection
        stream: 20000          // Longer stream timeout
      },
      retrySettings: {
        maxRetries: 8,    // More retries for mobile
        baseDelay: 2000,  // Longer base delay
        maxDelay: 60000   // Much longer max delay
      }
    };
  }

  static optimizeStreamForMobile(stream: MediaStream): MediaStream {
    if (!this.isMobileDevice()) return stream;

    console.log('📱 OPTIMIZER: Applying mobile optimizations to stream');

    // Apply track optimizations
    stream.getVideoTracks().forEach(track => {
      const capabilities = track.getCapabilities();
      const settings = track.getSettings();
      
      console.log('📱 OPTIMIZER: Video track capabilities:', capabilities);
      console.log('📱 OPTIMIZER: Current settings:', settings);

      // Apply mobile-optimized constraints if supported
      if (track.applyConstraints) {
        track.applyConstraints({
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 }
        }).catch(error => {
          console.warn('📱 OPTIMIZER: Failed to apply constraints:', error);
        });
      }
    });

    return stream;
  }

  static async validateMobileStream(stream: MediaStream): Promise<boolean> {
    if (!this.isMobileDevice()) return true;

    console.log('📱 VALIDATOR: Validating mobile stream');

    if (!stream || !stream.active) {
      console.error('📱 VALIDATOR: Stream is not active');
      return false;
    }

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    if (videoTracks.length === 0) {
      console.warn('📱 VALIDATOR: No video tracks found');
      return false;
    }

    // Check track states
    for (const track of videoTracks) {
      if (track.readyState !== 'live') {
        console.error('📱 VALIDATOR: Video track not in live state:', track.readyState);
        return false;
      }
    }

    // Additional mobile-specific validations
    if (this.isIOSDevice()) {
      // iOS-specific checks
      const settings = videoTracks[0].getSettings();
      if (!settings.width || !settings.height) {
        console.warn('📱 VALIDATOR: iOS video track missing dimensions');
        return false;
      }
    }

    console.log('✅ VALIDATOR: Mobile stream validation passed');
    return true;
  }

  static getDeviceInfo() {
    return {
      isMobile: this.isMobileDevice(),
      isIOS: this.isIOSDevice(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor
    };
  }
}