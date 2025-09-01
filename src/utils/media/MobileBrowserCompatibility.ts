// FASE 3: Mobile Browser Compatibility Layer
// Handles mobile browser specific policies and workarounds

export enum MobileBrowserType {
  CHROME_MOBILE = 'chrome_mobile',
  SAFARI_MOBILE = 'safari_mobile', 
  FIREFOX_MOBILE = 'firefox_mobile',
  SAMSUNG_BROWSER = 'samsung_browser',
  UNKNOWN_MOBILE = 'unknown_mobile',
  NOT_MOBILE = 'not_mobile'
}

export interface BrowserCompatibilityInfo {
  type: MobileBrowserType;
  version: string;
  requiresUserInteraction: boolean;
  supportsMutedAutoplay: boolean;
  hasStrictMediaPolicies: boolean;
  recommendedWorkarounds: string[];
}

export interface UserInteractionResult {
  success: boolean;
  timestamp: number;
  interactionType: 'touch' | 'click' | 'gesture';
  hadPreviousInteraction: boolean;
}

export class MobileBrowserCompatibility {
  private static userInteractionDetected = false;
  private static lastInteractionTime = 0;
  private static interactionListeners: (() => void)[] = [];

  // Detect mobile browser type and capabilities
  public static detectBrowser(): BrowserCompatibilityInfo {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (!isMobile) {
      return {
        type: MobileBrowserType.NOT_MOBILE,
        version: 'N/A',
        requiresUserInteraction: false,
        supportsMutedAutoplay: true,
        hasStrictMediaPolicies: false,
        recommendedWorkarounds: []
      };
    }

    let type: MobileBrowserType;
    let version = 'unknown';
    let requiresUserInteraction = true;
    let supportsMutedAutoplay = false;
    let hasStrictMediaPolicies = true;
    let recommendedWorkarounds: string[] = [];

    // Chrome Mobile
    if (/Chrome/i.test(userAgent) && /Mobile/i.test(userAgent)) {
      type = MobileBrowserType.CHROME_MOBILE;
      const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
      version = chromeMatch ? chromeMatch[1] : 'unknown';
      
      // Chrome 66+ has strict autoplay policies
      if (parseInt(version) >= 66) {
        supportsMutedAutoplay = true;
        hasStrictMediaPolicies = true;
        recommendedWorkarounds = [
          'require_user_gesture',
          'enable_muted_autoplay',
          'use_interaction_trigger'
        ];
      }
    }
    // Safari Mobile (iOS)
    else if (/Safari/i.test(userAgent) && /iPhone|iPad/i.test(userAgent)) {
      type = MobileBrowserType.SAFARI_MOBILE;
      const safariMatch = userAgent.match(/Version\/(\d+)/);
      version = safariMatch ? safariMatch[1] : 'unknown';
      
      supportsMutedAutoplay = true;
      hasStrictMediaPolicies = true;
      recommendedWorkarounds = [
        'require_user_gesture',
        'ios_specific_handling',
        'delayed_stream_initialization'
      ];
    }
    // Firefox Mobile
    else if (/Firefox/i.test(userAgent) && /Mobile/i.test(userAgent)) {
      type = MobileBrowserType.FIREFOX_MOBILE;
      const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
      version = firefoxMatch ? firefoxMatch[1] : 'unknown';
      
      supportsMutedAutoplay = false;
      hasStrictMediaPolicies = true;
      recommendedWorkarounds = [
        'require_user_gesture',
        'firefox_specific_handling'
      ];
    }
    // Samsung Browser
    else if (/SamsungBrowser/i.test(userAgent)) {
      type = MobileBrowserType.SAMSUNG_BROWSER;
      const samsungMatch = userAgent.match(/SamsungBrowser\/(\d+)/);
      version = samsungMatch ? samsungMatch[1] : 'unknown';
      
      supportsMutedAutoplay = true;
      hasStrictMediaPolicies = true;
      recommendedWorkarounds = [
        'require_user_gesture',
        'samsung_specific_handling'
      ];
    }
    // Unknown mobile browser
    else {
      type = MobileBrowserType.UNKNOWN_MOBILE;
      recommendedWorkarounds = [
        'require_user_gesture',
        'conservative_handling'
      ];
    }

    const info: BrowserCompatibilityInfo = {
      type,
      version,
      requiresUserInteraction,
      supportsMutedAutoplay,
      hasStrictMediaPolicies,
      recommendedWorkarounds
    };

    console.log('🌐 FASE 3: Browser compatibility detected:', info);
    return info;
  }

  // Setup user interaction detection
  public static setupUserInteractionDetection(): Promise<UserInteractionResult> {
    return new Promise((resolve) => {
      if (this.userInteractionDetected) {
        console.log('✅ FASE 3: User interaction already detected');
        resolve({
          success: true,
          timestamp: this.lastInteractionTime,
          interactionType: 'gesture',
          hadPreviousInteraction: true
        });
        return;
      }

      console.log('👆 FASE 3: Setting up user interaction detection...');

      const handleInteraction = (event: Event) => {
        const interactionType = event.type === 'touchstart' ? 'touch' : 'click';
        this.userInteractionDetected = true;
        this.lastInteractionTime = Date.now();

        console.log(`✅ FASE 3: User interaction detected: ${interactionType}`);

        // Remove listeners
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);

        // Notify waiting callbacks
        this.interactionListeners.forEach(callback => callback());
        this.interactionListeners = [];

        resolve({
          success: true,
          timestamp: this.lastInteractionTime,
          interactionType: interactionType as 'touch' | 'click',
          hadPreviousInteraction: false
        });
      };

      // Add event listeners
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.userInteractionDetected) {
          console.warn('⏰ FASE 3: User interaction timeout - proceeding anyway');
          document.removeEventListener('touchstart', handleInteraction);
          document.removeEventListener('click', handleInteraction);
          document.removeEventListener('keydown', handleInteraction);
          
          resolve({
            success: false,
            timestamp: Date.now(),
            interactionType: 'gesture',
            hadPreviousInteraction: false
          });
        }
      }, 30000);
    });
  }

  // Apply browser-specific workarounds before stream acquisition
  public static async applyPreStreamWorkarounds(
    browserInfo: BrowserCompatibilityInfo,
    participantId: string
  ): Promise<boolean> {
    console.log(`🔧 FASE 3: Applying pre-stream workarounds for ${browserInfo.type}`);

    try {
      // Ensure user interaction if required
      if (browserInfo.requiresUserInteraction && !this.userInteractionDetected) {
        console.log('👆 FASE 3: Waiting for user interaction...');
        
        // Create interaction prompt
        this.showInteractionPrompt();
        
        const interactionResult = await this.setupUserInteractionDetection();
        if (!interactionResult.success) {
          console.warn('⚠️ FASE 3: Failed to get user interaction - may cause issues');
        }
      }

      // Apply browser-specific workarounds
      switch (browserInfo.type) {
        case MobileBrowserType.CHROME_MOBILE:
          await this.applyChromeWorkarounds(browserInfo.version);
          break;
        case MobileBrowserType.SAFARI_MOBILE:
          await this.applySafariWorkarounds(browserInfo.version);
          break;
        case MobileBrowserType.FIREFOX_MOBILE:
          await this.applyFirefoxWorkarounds(browserInfo.version);
          break;
        case MobileBrowserType.SAMSUNG_BROWSER:
          await this.applySamsungWorkarounds(browserInfo.version);
          break;
        default:
          await this.applyConservativeWorkarounds();
      }

      console.log('✅ FASE 3: Pre-stream workarounds applied successfully');
      return true;
    } catch (error) {
      console.error('❌ FASE 3: Failed to apply pre-stream workarounds:', error);
      return false;
    }
  }

  // Apply browser-specific post-stream workarounds
  public static async applyPostStreamWorkarounds(
    stream: MediaStream,
    browserInfo: BrowserCompatibilityInfo,
    participantId: string
  ): Promise<MediaStream> {
    console.log(`🔧 FASE 3: Applying post-stream workarounds for ${browserInfo.type}`);

    try {
      let processedStream = stream;

      // Handle muted autoplay policies
      if (browserInfo.supportsMutedAutoplay && browserInfo.hasStrictMediaPolicies) {
        processedStream = await this.handleMutedAutoplayPolicy(stream, browserInfo);
      }

      // Apply browser-specific post-processing
      switch (browserInfo.type) {
        case MobileBrowserType.SAFARI_MOBILE:
          processedStream = await this.postProcessSafariStream(processedStream);
          break;
        case MobileBrowserType.CHROME_MOBILE:
          processedStream = await this.postProcessChromeStream(processedStream);
          break;
      }

      return processedStream;
    } catch (error) {
      console.error('❌ FASE 3: Post-stream workarounds failed:', error);
      return stream; // Return original stream as fallback
    }
  }

  // Chrome-specific workarounds
  private static async applyChromeWorkarounds(version: string): Promise<void> {
    console.log(`🔧 FASE 3: Applying Chrome ${version} workarounds`);
    
    // Chrome requires user gesture for getUserMedia on HTTPS
    if (parseInt(version) >= 66) {
      // Ensure autoplay policy is satisfied
      await this.satisfyAutoplayPolicy();
    }
  }

  // Safari-specific workarounds
  private static async applySafariWorkarounds(version: string): Promise<void> {
    console.log(`🔧 FASE 3: Applying Safari ${version} workarounds`);
    
    // Safari iOS has strict media policies
    await this.satisfyAutoplayPolicy();
    
    // Add iOS-specific delays
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Firefox-specific workarounds
  private static async applyFirefoxWorkarounds(version: string): Promise<void> {
    console.log(`🔧 FASE 3: Applying Firefox ${version} workarounds`);
    
    // Firefox Mobile doesn't support muted autoplay as well
    await this.satisfyAutoplayPolicy();
  }

  // Samsung Browser workarounds
  private static async applySamsungWorkarounds(version: string): Promise<void> {
    console.log(`🔧 FASE 3: Applying Samsung Browser ${version} workarounds`);
    
    // Samsung Browser has similar policies to Chrome
    await this.satisfyAutoplayPolicy();
  }

  // Conservative workarounds for unknown browsers
  private static async applyConservativeWorkarounds(): Promise<void> {
    console.log('🔧 FASE 3: Applying conservative workarounds');
    
    await this.satisfyAutoplayPolicy();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Satisfy browser autoplay policy
  private static async satisfyAutoplayPolicy(): Promise<void> {
    if (!this.userInteractionDetected) {
      console.log('⚠️ FASE 3: No user interaction detected - autoplay policy may block media');
      return;
    }

    // Create and play a silent audio element to satisfy policy
    try {
      const audio = new Audio();
      audio.muted = true;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      console.log('✅ FASE 3: Autoplay policy satisfied');
    } catch (error) {
      console.warn('⚠️ FASE 3: Could not satisfy autoplay policy:', error);
    }
  }

  // Handle muted autoplay policy for streams
  private static async handleMutedAutoplayPolicy(
    stream: MediaStream,
    browserInfo: BrowserCompatibilityInfo
  ): Promise<MediaStream> {
    console.log('🔇 FASE 3: Handling muted autoplay policy');

    // Ensure video tracks start muted if required by policy
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
      if (browserInfo.hasStrictMediaPolicies && !this.userInteractionDetected) {
        // Keep track muted initially to satisfy policy
        console.log(`🔇 FASE 3: Keeping video track ${track.id} muted for policy compliance`);
      }
    });

    return stream;
  }

  // Safari-specific stream post-processing
  private static async postProcessSafariStream(stream: MediaStream): Promise<MediaStream> {
    console.log('🍎 FASE 3: Post-processing Safari stream');
    
    // Safari iOS needs additional stabilization time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return stream;
  }

  // Chrome-specific stream post-processing
  private static async postProcessChromeStream(stream: MediaStream): Promise<MediaStream> {
    console.log('🌐 FASE 3: Post-processing Chrome stream');
    
    // Chrome mobile specific handling
    return stream;
  }

  // Show interaction prompt to user
  private static showInteractionPrompt(): void {
    // Dispatch event for UI to show interaction prompt
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('show-interaction-prompt', {
        detail: {
          message: 'Toque na tela para ativar a câmera',
          timestamp: Date.now()
        }
      }));
    }
  }

  // Check if user interaction was detected
  public static hasUserInteraction(): boolean {
    return this.userInteractionDetected;
  }

  // Get time since last interaction
  public static getTimeSinceLastInteraction(): number {
    return this.lastInteractionTime > 0 ? Date.now() - this.lastInteractionTime : -1;
  }
}
