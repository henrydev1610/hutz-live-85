/**
 * Polite Peer Manager - Implements WebRTC "polite peer" pattern
 * Prevents offer collision and eliminates "have-local-offer" errors
 */

interface PeerState {
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

export class PolitePeerManager {
  private peerStates: Map<string, PeerState> = new Map();
  private isPolite: boolean = true; // Participant is polite, Host is impolite
  
  constructor(isPolite: boolean = true) {
    this.isPolite = isPolite;
    console.log(`🤝 [POLITE-PEER] Initialized as ${isPolite ? 'polite' : 'impolite'} peer`);
  }

  /**
   * Initialize peer state for a participant
   */
  initializePeerState(participantId: string): void {
    this.peerStates.set(participantId, {
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false
    });
    console.log(`🤝 [POLITE-PEER] Initialized state for ${participantId}`);
  }

  /**
   * Check if can create offer (signaling state must be stable)
   */
  canCreateOffer(participantId: string, pc: RTCPeerConnection): boolean {
    const state = this.peerStates.get(participantId);
    if (!state) return false;

    const canCreate = pc.signalingState === 'stable' && !state.makingOffer;
    
    if (!canCreate) {
      console.log(`🚫 [POLITE-PEER] Cannot create offer for ${participantId}:`, {
        signalingState: pc.signalingState,
        makingOffer: state.makingOffer
      });
    }
    
    return canCreate;
  }

  /**
   * Mark that we're making an offer
   */
  setMakingOffer(participantId: string, making: boolean): void {
    const state = this.peerStates.get(participantId);
    if (state) {
      state.makingOffer = making;
      console.log(`🤝 [POLITE-PEER] ${participantId} makingOffer: ${making}`);
    }
  }

  /**
   * Handle incoming offer with polite peer logic
   */
  shouldIgnoreOffer(participantId: string, pc: RTCPeerConnection): boolean {
    const state = this.peerStates.get(participantId);
    if (!state) return false;

    // Offer collision detection
    const offerCollision = pc.signalingState !== 'stable' || state.makingOffer;
    
    if (offerCollision) {
      if (this.isPolite) {
        // Polite peer ignores the offer
        state.ignoreOffer = true;
        console.log(`🤝 [POLITE-PEER] Polite peer ignoring offer collision from ${participantId}`);
        return true;
      } else {
        // Impolite peer wins, continue with offer
        console.log(`🤝 [POLITE-PEER] Impolite peer handling offer collision from ${participantId}`);
        return false;
      }
    }

    state.ignoreOffer = false;
    return false;
  }

  /**
   * Check if should ignore answer
   */
  shouldIgnoreAnswer(participantId: string): boolean {
    const state = this.peerStates.get(participantId);
    return state ? state.ignoreOffer : false;
  }

  /**
   * Mark setting remote answer as pending
   */
  setRemoteAnswerPending(participantId: string, pending: boolean): void {
    const state = this.peerStates.get(participantId);
    if (state) {
      state.isSettingRemoteAnswerPending = pending;
    }
  }

  /**
   * Get current peer state
   */
  getPeerState(participantId: string): PeerState | null {
    return this.peerStates.get(participantId) || null;
  }

  /**
   * Reset peer state (for cleanup)
   */
  resetPeerState(participantId: string): void {
    const state = this.peerStates.get(participantId);
    if (state) {
      state.makingOffer = false;
      state.ignoreOffer = false;
      state.isSettingRemoteAnswerPending = false;
      console.log(`🤝 [POLITE-PEER] Reset state for ${participantId}`);
    }
  }

  /**
   * Clean up peer state
   */
  cleanup(participantId: string): void {
    this.peerStates.delete(participantId);
    console.log(`🤝 [POLITE-PEER] Cleaned up state for ${participantId}`);
  }

  /**
   * Clean up all peer states
   */
  cleanupAll(): void {
    this.peerStates.clear();
    console.log('🤝 [POLITE-PEER] Cleaned up all peer states');
  }

  /**
   * Log current states for debugging
   */
  logStates(): void {
    console.log('🤝 [POLITE-PEER] Current states:', 
      Object.fromEntries(this.peerStates.entries())
    );
  }
}

// Global instance
export const politePeerManager = new PolitePeerManager();