/**
 * Send-Only Transceiver Manager
 * Handles video-only sendonly transceivers with track replacement
 */

interface TransceiverConfig {
  participantId: string;
  peerConnection: RTCPeerConnection;
  track: MediaStreamTrack;
}

interface SenderReference {
  sender: RTCRtpSender;
  transceiver: RTCRtpTransceiver;
  participantId: string;
  trackId: string;
}

export class SendOnlyTransceiver {
  private senderReferences: Map<string, SenderReference> = new Map();
  
  /**
   * Add video track with sendonly transceiver
   */
  async addVideoTrack(config: TransceiverConfig): Promise<RTCRtpSender> {
    const { participantId, peerConnection, track } = config;
    
    console.log(`📤 [SEND-ONLY] Adding video track for ${participantId}:`, {
      trackId: track.id,
      kind: track.kind,
      readyState: track.readyState,
      muted: track.muted,
      enabled: track.enabled
    });

    // Check if we already have a sender for this participant
    const existingRef = this.senderReferences.get(participantId);
    if (existingRef) {
      console.log(`🔄 [SEND-ONLY] Replacing existing track for ${participantId}`);
      return await this.replaceTrack(participantId, track);
    }

    // Add transceiver with sendonly direction
    const transceiver = peerConnection.addTransceiver(track, {
      direction: 'sendonly',
      streams: []
    });

    const sender = transceiver.sender;
    
    // Store sender reference
    this.senderReferences.set(participantId, {
      sender,
      transceiver,
      participantId,
      trackId: track.id
    });

    console.log(`✅ [SEND-ONLY] Added sendonly transceiver for ${participantId}:`, {
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection,
      senderId: sender ? 'present' : 'null'
    });

    return sender;
  }

  /**
   * Replace track in existing sender (avoids connection recreation)
   */
  async replaceTrack(participantId: string, newTrack: MediaStreamTrack): Promise<RTCRtpSender> {
    const senderRef = this.senderReferences.get(participantId);
    if (!senderRef) {
      throw new Error(`No sender found for participant: ${participantId}`);
    }

    console.log(`🔄 [SEND-ONLY] Replacing track for ${participantId}:`, {
      oldTrackId: senderRef.trackId,
      newTrackId: newTrack.id,
      newTrackState: {
        readyState: newTrack.readyState,
        muted: newTrack.muted,
        enabled: newTrack.enabled
      }
    });

    try {
      // Replace the track
      await senderRef.sender.replaceTrack(newTrack);
      
      // Update reference
      senderRef.trackId = newTrack.id;
      
      console.log(`✅ [SEND-ONLY] Track replaced successfully for ${participantId}`);
      return senderRef.sender;
    } catch (error) {
      console.error(`❌ [SEND-ONLY] Failed to replace track for ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Handle track ended event (recapture and replace)
   */
  async handleTrackEnded(participantId: string, onRecapture: () => Promise<MediaStreamTrack>): Promise<void> {
    const senderRef = this.senderReferences.get(participantId);
    if (!senderRef) {
      console.warn(`⚠️ [SEND-ONLY] No sender found for ended track: ${participantId}`);
      return;
    }

    console.log(`🔄 [SEND-ONLY] Track ended for ${participantId}, recapturing...`);

    try {
      // Get new track through recapture
      const newTrack = await onRecapture();
      
      // Replace with new track
      await this.replaceTrack(participantId, newTrack);
      
      console.log(`✅ [SEND-ONLY] Track recovered and replaced for ${participantId}`);
    } catch (error) {
      console.error(`❌ [SEND-ONLY] Failed to recover track for ${participantId}:`, error);
    }
  }

  /**
   * Get sender for participant
   */
  getSender(participantId: string): RTCRtpSender | null {
    const senderRef = this.senderReferences.get(participantId);
    return senderRef ? senderRef.sender : null;
  }

  /**
   * Get transceiver for participant
   */
  getTransceiver(participantId: string): RTCRtpTransceiver | null {
    const senderRef = this.senderReferences.get(participantId);
    return senderRef ? senderRef.transceiver : null;
  }

  /**
   * Check if participant has active sender
   */
  hasSender(participantId: string): boolean {
    return this.senderReferences.has(participantId);
  }

  /**
   * Get all sender references (for debugging)
   */
  getAllSenders(): Map<string, SenderReference> {
    return new Map(this.senderReferences);
  }

  /**
   * Validate that all transceivers are sendonly
   */
  validateSendOnlyDirection(peerConnection: RTCPeerConnection): boolean {
    const transceivers = peerConnection.getTransceivers();
    const sendOnlyCount = transceivers.filter(t => t.direction === 'sendonly').length;
    
    console.log(`🔍 [SEND-ONLY] Validation:`, {
      totalTransceivers: transceivers.length,
      sendOnlyTransceivers: sendOnlyCount,
      allSendOnly: sendOnlyCount === transceivers.length
    });

    return sendOnlyCount === transceivers.length;
  }

  /**
   * Clean up sender reference
   */
  cleanup(participantId: string): void {
    const senderRef = this.senderReferences.get(participantId);
    if (senderRef) {
      // Stop the track if it exists
      const track = senderRef.sender.track;
      if (track) {
        track.stop();
      }
      
      this.senderReferences.delete(participantId);
      console.log(`🧹 [SEND-ONLY] Cleaned up sender for ${participantId}`);
    }
  }

  /**
   * Clean up all sender references
   */
  cleanupAll(): void {
    this.senderReferences.forEach((senderRef, participantId) => {
      const track = senderRef.sender.track;
      if (track) {
        track.stop();
      }
    });
    
    this.senderReferences.clear();
    console.log('🧹 [SEND-ONLY] Cleaned up all senders');
  }
}