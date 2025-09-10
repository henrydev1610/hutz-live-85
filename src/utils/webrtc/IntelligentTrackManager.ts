// FASE 4: Intelligent WebRTC Track Management
// Manages tracks in PeerConnection with support for muted track handling

import { MutedTrackHandler } from '../media/MutedTrackHandler';

export interface TrackManagementResult {
  success: boolean;
  trackId: string;
  wasReplaced: boolean;
  wasMuted: boolean;
  senderAdded: boolean;
  error?: string;
}

export interface TrackRecoveryStatus {
  trackId: string;
  kind: 'video' | 'audio';
  needsRecovery: boolean;
  recoveryAttempts: number;
  lastRecoveryTime: number;
  currentSender?: RTCRtpSender;
}

export class IntelligentTrackManager {
  private mutedTrackHandler: MutedTrackHandler;
  private trackRecoveryStatus: Map<string, TrackRecoveryStatus> = new Map();
  private trackMonitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private senderTrackMap: Map<string, RTCRtpSender> = new Map();

  constructor() {
    this.mutedTrackHandler = new MutedTrackHandler();
    console.log('🎯 FASE 4: IntelligentTrackManager initialized');
  }

  // Add track to PeerConnection with intelligent muted track handling
  public async addTrackToPeerConnection(
    track: MediaStreamTrack,
    stream: MediaStream,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<TrackManagementResult> {
    const trackId = track.id;
    
    console.log(`🎯 FASE 4: Adding ${track.kind} track ${trackId} to PeerConnection`);

    try {
      // PHASE 1: Handle muted tracks intelligently
      const mutedTrackResult = await this.mutedTrackHandler.handleMutedTrack(track, participantId);
      
      if (!mutedTrackResult.success) {
        console.error(`❌ FASE 4: Muted track handling failed for ${trackId}`);
        return {
          success: false,
          trackId,
          wasReplaced: false,
          wasMuted: mutedTrackResult.wasMuted,
          senderAdded: false,
          error: 'Muted track handling failed'
        };
      }

      // PHASE 2: Add track to PeerConnection
      const sender = peerConnection.addTrack(mutedTrackResult.track, stream);
      this.senderTrackMap.set(trackId, sender);

      console.log(`✅ FASE 4: Track ${trackId} added to PeerConnection successfully`);

      // PHASE 3: Setup real-time monitoring
      this.setupTrackMonitoring(mutedTrackResult.track, sender, peerConnection, participantId);

      // PHASE 4: Register recovery status
      this.trackRecoveryStatus.set(trackId, {
        trackId,
        kind: track.kind as 'video' | 'audio',
        needsRecovery: mutedTrackResult.wasMuted,
        recoveryAttempts: 0,
        lastRecoveryTime: Date.now(),
        currentSender: sender
      });

      return {
        success: true,
        trackId,
        wasReplaced: false,
        wasMuted: mutedTrackResult.wasMuted,
        senderAdded: true
      };

    } catch (error) {
      console.error(`❌ FASE 4: Failed to add track ${trackId} to PeerConnection:`, error);
      return {
        success: false,
        trackId,
        wasReplaced: false,
        wasMuted: track.muted,
        senderAdded: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Replace muted track with unmuted version
  public async replaceTrackInPeerConnection(
    oldTrackId: string,
    newTrack: MediaStreamTrack,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<TrackManagementResult> {
    console.log(`🔄 FASE 4: Replacing track ${oldTrackId} with ${newTrack.id}`);

    const sender = this.senderTrackMap.get(oldTrackId);
    if (!sender) {
      console.error(`❌ FASE 4: No sender found for track ${oldTrackId}`);
      return {
        success: false,
        trackId: newTrack.id,
        wasReplaced: false,
        wasMuted: newTrack.muted,
        senderAdded: false,
        error: 'Sender not found'
      };
    }

    try {
      // Handle the new track through muted track handler
      const mutedTrackResult = await this.mutedTrackHandler.handleMutedTrack(newTrack, participantId);
      
      if (!mutedTrackResult.success) {
        console.error(`❌ FASE 4: New track handling failed for ${newTrack.id}`);
        return {
          success: false,
          trackId: newTrack.id,
          wasReplaced: false,
          wasMuted: mutedTrackResult.wasMuted,
          senderAdded: false,
          error: 'New track handling failed'
        };
      }

      // Replace the track in the sender
      await sender.replaceTrack(mutedTrackResult.track);

      console.log(`✅ FASE 4: Track replaced successfully: ${oldTrackId} → ${newTrack.id}`);

      // Update mappings
      this.senderTrackMap.delete(oldTrackId);
      this.senderTrackMap.set(newTrack.id, sender);

      // Setup monitoring for new track
      this.setupTrackMonitoring(mutedTrackResult.track, sender, peerConnection, participantId);

      // Update recovery status
      const recoveryStatus = this.trackRecoveryStatus.get(oldTrackId);
      if (recoveryStatus) {
        this.trackRecoveryStatus.delete(oldTrackId);
        this.trackRecoveryStatus.set(newTrack.id, {
          ...recoveryStatus,
          trackId: newTrack.id,
          recoveryAttempts: recoveryStatus.recoveryAttempts + 1,
          lastRecoveryTime: Date.now(),
          currentSender: sender
        });
      }

      return {
        success: true,
        trackId: newTrack.id,
        wasReplaced: true,
        wasMuted: mutedTrackResult.wasMuted,
        senderAdded: false // Track was replaced, not newly added
      };

    } catch (error) {
      console.error(`❌ FASE 4: Failed to replace track ${oldTrackId}:`, error);
      return {
        success: false,
        trackId: newTrack.id,
        wasReplaced: false,
        wasMuted: newTrack.muted,
        senderAdded: false,
        error: error instanceof Error ? error.message : 'Track replacement failed'
      };
    }
  }

  // Setup real-time track monitoring
  private setupTrackMonitoring(
    track: MediaStreamTrack,
    sender: RTCRtpSender,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): void {
    const trackId = track.id;
    
    console.log(`📊 FASE 4: Setting up monitoring for track ${trackId}`);

    // Clear existing monitoring
    const existingInterval = this.trackMonitoringIntervals.get(trackId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Monitor track health every 5 seconds
    const monitoringInterval = setInterval(async () => {
      await this.checkTrackHealth(track, sender, peerConnection, participantId);
    }, 5000);

    this.trackMonitoringIntervals.set(trackId, monitoringInterval);

    // Setup event listeners
    track.addEventListener('mute', () => {
      console.warn(`🔇 FASE 4: Track ${trackId} muted during transmission`);
      this.handleTrackMutedDuringTransmission(track, sender, peerConnection, participantId);
    });

    track.addEventListener('unmute', () => {
      console.log(`🔊 FASE 4: Track ${trackId} unmuted during transmission`);
      this.handleTrackUnmutedDuringTransmission(track, participantId);
    });

    track.addEventListener('ended', () => {
      console.error(`🔚 FASE 4: Track ${trackId} ended during transmission`);
      this.handleTrackEndedDuringTransmission(track, sender, peerConnection, participantId);
    });
  }

  // Check track health and trigger recovery if needed
  private async checkTrackHealth(
    track: MediaStreamTrack,
    sender: RTCRtpSender,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<void> {
    const trackId = track.id;
    
    // Check track status
    const isHealthy = track.readyState === 'live' && track.enabled;
    const isMuted = track.muted;
    
    if (!isHealthy) {
      console.warn(`⚠️ FASE 4: Track ${trackId} health check failed - readyState: ${track.readyState}, enabled: ${track.enabled}`);
      await this.attemptTrackRecovery(track, sender, peerConnection, participantId);
    } else if (isMuted) {
      console.log(`🔇 FASE 4: Track ${trackId} is muted during health check`);
      // Track is muted but alive - this might be normal for mobile browsers
    } else {
      // Track is healthy
      console.log(`✅ FASE 4: Track ${trackId} health check passed`);
    }
  }

  // Handle track muted during transmission
  private async handleTrackMutedDuringTransmission(
    track: MediaStreamTrack,
    sender: RTCRtpSender,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<void> {
    console.log(`🔇 FASE 4: Handling track muted during transmission: ${track.id}`);

    // Try to recover the track through muted track handler
    const mutedTrackResult = await this.mutedTrackHandler.handleMutedTrack(track, participantId);
    
    if (mutedTrackResult.success && !mutedTrackResult.track.muted) {
      console.log(`✅ FASE 4: Successfully recovered muted track ${track.id}`);
    } else {
      console.warn(`⚠️ FASE 4: Track ${track.id} remains muted but is still valid for transmission`);
    }
  }

  // Handle track unmuted during transmission
  private handleTrackUnmutedDuringTransmission(track: MediaStreamTrack, participantId: string): void {
    console.log(`🔊 FASE 4: Track ${track.id} unmuted - updating recovery status`);
    
    const recoveryStatus = this.trackRecoveryStatus.get(track.id);
    if (recoveryStatus) {
      recoveryStatus.needsRecovery = false;
      this.trackRecoveryStatus.set(track.id, recoveryStatus);
    }
  }

  // Handle track ended during transmission
  private async handleTrackEndedDuringTransmission(
    track: MediaStreamTrack,
    sender: RTCRtpSender,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<void> {
    console.error(`🔚 FASE 4: Track ${track.id} ended - attempting recovery`);
    
    await this.attemptTrackRecovery(track, sender, peerConnection, participantId);
  }

  // Attempt to recover a problematic track
  private async attemptTrackRecovery(
    track: MediaStreamTrack,
    sender: RTCRtpSender,
    peerConnection: RTCPeerConnection,
    participantId: string
  ): Promise<void> {
    const trackId = track.id;
    const recoveryStatus = this.trackRecoveryStatus.get(trackId);
    
    if (!recoveryStatus) {
      console.error(`❌ FASE 4: No recovery status found for track ${trackId}`);
      return;
    }

    const maxRecoveryAttempts = 3;
    if (recoveryStatus.recoveryAttempts >= maxRecoveryAttempts) {
      console.error(`❌ FASE 4: Max recovery attempts reached for track ${trackId}`);
      return;
    }

    console.log(`🔄 FASE 4: Attempting recovery ${recoveryStatus.recoveryAttempts + 1}/${maxRecoveryAttempts} for track ${trackId}`);

    try {
      // Try to get a new track of the same kind
      const constraints: MediaStreamConstraints = {};
      if (track.kind === 'video') {
        constraints.video = { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
      } else if (track.kind === 'audio') {
        constraints.audio = true;
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTracks = track.kind === 'video' ? newStream.getVideoTracks() : newStream.getAudioTracks();
      
      if (newTracks.length > 0) {
        const newTrack = newTracks[0];
        const replaceResult = await this.replaceTrackInPeerConnection(trackId, newTrack, peerConnection, participantId);
        
        if (replaceResult.success) {
          console.log(`✅ FASE 4: Track recovery successful for ${trackId}`);
        } else {
          console.error(`❌ FASE 4: Track recovery failed for ${trackId}:`, replaceResult.error);
        }
      }
    } catch (error) {
      console.error(`❌ FASE 4: Track recovery attempt failed for ${trackId}:`, error);
      
      // Update recovery status
      recoveryStatus.recoveryAttempts++;
      recoveryStatus.lastRecoveryTime = Date.now();
      this.trackRecoveryStatus.set(trackId, recoveryStatus);
    }
  }

  // Get current recovery status for all tracks
  public getTrackRecoveryStatus(): Map<string, TrackRecoveryStatus> {
    return new Map(this.trackRecoveryStatus);
  }

  // Check if any tracks need recovery
  public hasTracksNeedingRecovery(): boolean {
    for (const status of this.trackRecoveryStatus.values()) {
      if (status.needsRecovery) {
        return true;
      }
    }
    return false;
  }

  // Cleanup track monitoring
  public cleanup(): void {
    console.log('🧹 FASE 4: Cleaning up IntelligentTrackManager');
    
    // Clear monitoring intervals
    this.trackMonitoringIntervals.forEach(interval => clearInterval(interval));
    this.trackMonitoringIntervals.clear();
    
    // Clear mappings
    this.senderTrackMap.clear();
    this.trackRecoveryStatus.clear();
    
    // Cleanup muted track handler
    this.mutedTrackHandler.destroy();
  }
}