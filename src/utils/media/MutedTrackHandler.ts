// FASE 1: Smart Muted Track Handling
// Handles muted tracks and attempts to unmute them for WebRTC transmission

export interface MutedTrackStatus {
  trackId: string;
  kind: 'video' | 'audio';
  isMuted: boolean;
  readyState: RTCDataChannelState | 'live' | 'ended';
  enabled: boolean;
  isValidForWebRTC: boolean;
  lastUnmuteAttempt?: number;
}

export interface MutedTrackConfig {
  unmuteTimeoutMs: number;
  maxUnmuteAttempts: number;
  retryIntervalMs: number;
  forceUnmuteAfterMs: number;
}

const DEFAULT_CONFIG: MutedTrackConfig = {
  unmuteTimeoutMs: 3000,    // Wait 3s for browser auto-unmute
  maxUnmuteAttempts: 3,     // Try 3 times maximum
  retryIntervalMs: 1000,    // 1s between attempts
  forceUnmuteAfterMs: 5000  // Force unmute after 5s
};

export class MutedTrackHandler {
  private config: MutedTrackConfig;
  private mutedTracks: Map<string, MutedTrackStatus> = new Map();
  private unmuteTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, AbortController> = new Map();

  constructor(config?: Partial<MutedTrackConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('🔇 FASE 1: MutedTrackHandler initialized', this.config);
  }

  // Monitor track and attempt smart unmute
  public async handleMutedTrack(
    track: MediaStreamTrack,
    participantId: string
  ): Promise<{ success: boolean; track: MediaStreamTrack; wasMuted: boolean }> {
    const trackId = track.id;
    const wasMuted = track.muted;
    
    console.log(`🔇 FASE 1: Handling ${track.kind} track ${trackId} - muted: ${wasMuted}`);

    // Register track status
    const status: MutedTrackStatus = {
      trackId,
      kind: track.kind as 'video' | 'audio',
      isMuted: track.muted,
      readyState: track.readyState as any,
      enabled: track.enabled,
      isValidForWebRTC: this.isTrackValidForWebRTC(track),
      lastUnmuteAttempt: Date.now()
    };

    this.mutedTracks.set(trackId, status);

    if (!track.muted) {
      console.log(`✅ FASE 1: Track ${trackId} not muted - ready for WebRTC`);
      return { success: true, track, wasMuted: false };
    }

    // Setup event listeners for unmute detection
    this.setupTrackEventListeners(track, participantId);

    // Start smart unmute process
    const result = await this.attemptSmartUnmute(track, participantId);
    
    return {
      success: result.success,
      track: result.track,
      wasMuted
    };
  }

  // Wait for browser auto-unmute or force unmute
  private async attemptSmartUnmute(
    track: MediaStreamTrack, 
    participantId: string
  ): Promise<{ success: boolean; track: MediaStreamTrack }> {
    const trackId = track.id;
    
    console.log(`🔄 FASE 1: Attempting smart unmute for ${trackId}`);

    // Phase 1: Wait for browser auto-unmute
    const autoUnmuteResult = await this.waitForAutoUnmute(track);
    if (autoUnmuteResult) {
      console.log(`✅ FASE 1: Browser auto-unmuted ${trackId}`);
      return { success: true, track };
    }

    // Phase 2: Attempt programmatic unmute
    const programmaticResult = await this.attemptProgrammaticUnmute(track);
    if (programmaticResult) {
      console.log(`✅ FASE 1: Programmatic unmute succeeded for ${trackId}`);
      return { success: true, track };
    }

    // Phase 3: Check if track is still valid despite being muted
    if (this.isTrackValidForWebRTC(track)) {
      console.log(`⚠️ FASE 1: Track ${trackId} muted but valid - proceeding anyway`);
      return { success: true, track };
    }

    console.error(`❌ FASE 1: Failed to unmute ${trackId} - track invalid`);
    return { success: false, track };
  }

  // Wait for browser to automatically unmute
  private async waitForAutoUnmute(track: MediaStreamTrack): Promise<boolean> {
    return new Promise((resolve) => {
      const trackId = track.id;
      let resolved = false;

      // Set timeout for waiting
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(`⏰ FASE 1: Auto-unmute timeout for ${trackId}`);
          resolve(false);
        }
      }, this.config.unmuteTimeoutMs);

      // Listen for unmute event
      const handleUnmute = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.log(`🔊 FASE 1: Auto-unmute detected for ${trackId}`);
          resolve(true);
        }
      };

      track.addEventListener('unmute', handleUnmute, { once: true });

      // Also check immediately if already unmuted
      if (!track.muted) {
        handleUnmute();
      }
    });
  }

  // Attempt programmatic unmute
  private async attemptProgrammaticUnmute(track: MediaStreamTrack): Promise<boolean> {
    const trackId = track.id;
    
    for (let attempt = 1; attempt <= this.config.maxUnmuteAttempts; attempt++) {
      console.log(`🔧 FASE 1: Programmatic unmute attempt ${attempt}/${this.config.maxUnmuteAttempts} for ${trackId}`);
      
      try {
        // Try to enable track programmatically
        track.enabled = false;
        await new Promise(resolve => setTimeout(resolve, 100));
        track.enabled = true;
        
        // Wait for effect
        await new Promise(resolve => setTimeout(resolve, this.config.retryIntervalMs));
        
        if (!track.muted) {
          console.log(`✅ FASE 1: Programmatic unmute succeeded on attempt ${attempt}`);
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ FASE 1: Programmatic unmute attempt ${attempt} failed:`, error);
      }
    }

    return false;
  }

  // Check if track is valid for WebRTC despite being muted
  private isTrackValidForWebRTC(track: MediaStreamTrack): boolean {
    const isValid = track.readyState === 'live' && track.enabled;
    
    console.log(`🔍 FASE 1: Track validation for ${track.id}:`, {
      readyState: track.readyState,
      enabled: track.enabled,
      muted: track.muted,
      isValid
    });

    return isValid;
  }

  // Setup event listeners for track state changes
  private setupTrackEventListeners(track: MediaStreamTrack, participantId: string): void {
    const trackId = track.id;
    const controller = new AbortController();
    
    this.eventListeners.set(trackId, controller);

    track.addEventListener('unmute', () => {
      console.log(`🔊 FASE 1: Track ${trackId} unmuted`);
      const status = this.mutedTracks.get(trackId);
      if (status) {
        status.isMuted = false;
        status.isValidForWebRTC = this.isTrackValidForWebRTC(track);
        this.mutedTracks.set(trackId, status);
      }
    }, { signal: controller.signal });

    track.addEventListener('mute', () => {
      console.log(`🔇 FASE 1: Track ${trackId} muted`);
      const status = this.mutedTracks.get(trackId);
      if (status) {
        status.isMuted = true;
        status.isValidForWebRTC = this.isTrackValidForWebRTC(track);
        this.mutedTracks.set(trackId, status);
      }
    }, { signal: controller.signal });

    track.addEventListener('ended', () => {
      console.log(`🔚 FASE 1: Track ${trackId} ended`);
      this.cleanup(trackId);
    }, { signal: controller.signal });
  }

  // Get current status of all tracked muted tracks
  public getMutedTracksStatus(): Map<string, MutedTrackStatus> {
    return new Map(this.mutedTracks);
  }

  // Check if any tracks are currently muted but recoverable
  public hasRecoverableMutedTracks(): boolean {
    for (const status of this.mutedTracks.values()) {
      if (status.isMuted && status.isValidForWebRTC) {
        return true;
      }
    }
    return false;
  }

  // Cleanup track monitoring
  private cleanup(trackId: string): void {
    const controller = this.eventListeners.get(trackId);
    if (controller) {
      controller.abort();
      this.eventListeners.delete(trackId);
    }

    const timeout = this.unmuteTimeouts.get(trackId);
    if (timeout) {
      clearTimeout(timeout);
      this.unmuteTimeouts.delete(trackId);
    }

    this.mutedTracks.delete(trackId);
  }

  // Cleanup all resources
  public destroy(): void {
    console.log('🧹 FASE 1: Destroying MutedTrackHandler');
    
    this.eventListeners.forEach(controller => controller.abort());
    this.eventListeners.clear();
    
    this.unmuteTimeouts.forEach(timeout => clearTimeout(timeout));
    this.unmuteTimeouts.clear();
    
    this.mutedTracks.clear();
  }
}