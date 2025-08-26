/**
 * FASE 4: Enhanced Error Recovery and Stuck State Detection
 * 
 * Detects and recovers from stuck WebRTC connection states,
 * particularly "have-local-offer" and connection failures.
 */

export interface ConnectionState {
  signalingState: RTCSignalingState;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  timestamp: number;
}

export interface RecoveryOptions {
  maxStuckTime: number;
  maxRecoveryAttempts: number;
  onRecoveryAttempt?: (attempt: number, reason: string) => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: (reason: string) => void;
}

export class ConnectionStateRecovery {
  private stateHistory: ConnectionState[] = [];
  private lastStateChange: number = 0;
  private recoveryAttempts: number = 0;
  private isRecovering: boolean = false;
  private stuckStateTimer: NodeJS.Timeout | null = null;

  constructor(private options: RecoveryOptions) {}

  /**
   * Monitor connection state and detect stuck states
   */
  monitorConnection(peerConnection: RTCPeerConnection): void {
    const currentState: ConnectionState = {
      signalingState: peerConnection.signalingState,
      connectionState: peerConnection.connectionState,
      iceConnectionState: peerConnection.iceConnectionState,
      timestamp: Date.now()
    };

    // Check if state actually changed
    const previousState = this.stateHistory[this.stateHistory.length - 1];
    if (previousState && this.statesEqual(currentState, previousState)) {
      return; // No change, continue monitoring
    }

    this.stateHistory.push(currentState);
    this.lastStateChange = Date.now();

    console.log(`🔍 CONNECTION-RECOVERY: State change detected`, {
      signaling: currentState.signalingState,
      connection: currentState.connectionState,
      ice: currentState.iceConnectionState
    });

    // Clear existing stuck timer and start new one
    this.clearStuckTimer();
    this.startStuckTimer(peerConnection);

    // Check for immediate problematic states
    this.checkForProblematicStates(peerConnection, currentState);
  }

  /**
   * Check for states that require immediate intervention
   */
  private checkForProblematicStates(peerConnection: RTCPeerConnection, state: ConnectionState): void {
    // "have-local-offer" stuck for too long
    if (state.signalingState === 'have-local-offer') {
      console.warn(`⚠️ CONNECTION-RECOVERY: Detected have-local-offer state`);
    }

    // Connection failed
    if (state.connectionState === 'failed' || state.iceConnectionState === 'failed') {
      console.warn(`❌ CONNECTION-RECOVERY: Connection failed - initiating recovery`);
      this.initiateRecovery(peerConnection, 'Connection failed');
    }

    // ICE disconnected for extended period
    if (state.iceConnectionState === 'disconnected') {
      console.warn(`📤 CONNECTION-RECOVERY: ICE disconnected - monitoring for recovery`);
    }
  }

  /**
   * Start timer to detect stuck states
   */
  private startStuckTimer(peerConnection: RTCPeerConnection): void {
    this.stuckStateTimer = setTimeout(() => {
      const timeSinceLastChange = Date.now() - this.lastStateChange;
      
      if (timeSinceLastChange >= this.options.maxStuckTime) {
        const currentState = {
          signalingState: peerConnection.signalingState,
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
          timestamp: Date.now()
        };

        console.warn(`⏰ CONNECTION-RECOVERY: Stuck state detected`, {
          state: currentState,
          stuckDuration: timeSinceLastChange
        });

        this.initiateRecovery(peerConnection, `Stuck in ${currentState.signalingState} for ${timeSinceLastChange}ms`);
      }
    }, this.options.maxStuckTime);
  }

  /**
   * Clear stuck state timer
   */
  private clearStuckTimer(): void {
    if (this.stuckStateTimer) {
      clearTimeout(this.stuckStateTimer);
      this.stuckStateTimer = null;
    }
  }

  /**
   * Initiate recovery process
   */
  private async initiateRecovery(peerConnection: RTCPeerConnection, reason: string): Promise<void> {
    if (this.isRecovering) {
      console.log(`🔄 CONNECTION-RECOVERY: Recovery already in progress`);
      return;
    }

    if (this.recoveryAttempts >= this.options.maxRecoveryAttempts) {
      console.error(`🛑 CONNECTION-RECOVERY: Max recovery attempts reached`);
      this.options.onRecoveryFailed?.(reason);
      return;
    }

    this.isRecovering = true;
    this.recoveryAttempts++;
    
    console.log(`🚑 CONNECTION-RECOVERY: Initiating recovery attempt ${this.recoveryAttempts}/${this.options.maxRecoveryAttempts}`, {
      reason,
      currentState: {
        signaling: peerConnection.signalingState,
        connection: peerConnection.connectionState,
        ice: peerConnection.iceConnectionState
      }
    });

    this.options.onRecoveryAttempt?.(this.recoveryAttempts, reason);

    try {
      // Recovery strategy based on current state
      await this.executeRecoveryStrategy(peerConnection);
      
      // Monitor for recovery success
      setTimeout(() => {
        if (peerConnection.connectionState === 'connected' || 
            peerConnection.iceConnectionState === 'connected' ||
            peerConnection.iceConnectionState === 'completed') {
          
          console.log(`✅ CONNECTION-RECOVERY: Recovery successful after attempt ${this.recoveryAttempts}`);
          this.options.onRecoverySuccess?.();
          this.resetRecovery();
        } else {
          console.warn(`⚠️ CONNECTION-RECOVERY: Recovery attempt ${this.recoveryAttempts} did not establish connection`);
        }
        
        this.isRecovering = false;
      }, 5000); // Give 5 seconds to establish connection

    } catch (error) {
      console.error(`❌ CONNECTION-RECOVERY: Recovery attempt ${this.recoveryAttempts} failed:`, error);
      this.isRecovering = false;
      
      // Schedule next attempt if not at max
      if (this.recoveryAttempts < this.options.maxRecoveryAttempts) {
        setTimeout(() => {
          this.initiateRecovery(peerConnection, `Previous recovery failed: ${error}`);
        }, 2000 * this.recoveryAttempts); // Exponential backoff
      } else {
        this.options.onRecoveryFailed?.(reason);
      }
    }
  }

  /**
   * Execute recovery strategy based on current state
   */
  private async executeRecoveryStrategy(peerConnection: RTCPeerConnection): Promise<void> {
    const state = peerConnection.signalingState;
    
    console.log(`🔧 CONNECTION-RECOVERY: Executing recovery for state: ${state}`);

    switch (state) {
      case 'have-local-offer':
        // Stuck with local offer - restart negotiation
        console.log(`🔄 CONNECTION-RECOVERY: Restarting negotiation from have-local-offer`);
        await this.restartNegotiation(peerConnection);
        break;
        
      case 'stable':
        // In stable state but connection issues - restart ICE
        console.log(`🧊 CONNECTION-RECOVERY: Restarting ICE gathering`);
        await peerConnection.restartIce();
        break;
        
      default:
        // Generic recovery - close and signal for reconnection
        console.log(`🔄 CONNECTION-RECOVERY: Generic recovery - signaling reconnection`);
        this.signalReconnectionNeeded();
        break;
    }
  }

  /**
   * Restart negotiation by clearing local description
   */
  private async restartNegotiation(peerConnection: RTCPeerConnection): Promise<void> {
    // This will trigger the participant to restart the offer process
    this.signalReconnectionNeeded();
  }

  /**
   * Signal that a full reconnection is needed
   */
  private signalReconnectionNeeded(): void {
    window.dispatchEvent(new CustomEvent('webrtc-reconnection-needed', {
      detail: {
        reason: 'Connection recovery failed',
        timestamp: Date.now(),
        recoveryAttempt: this.recoveryAttempts
      }
    }));
  }

  /**
   * Reset recovery state after successful connection
   */
  private resetRecovery(): void {
    this.recoveryAttempts = 0;
    this.isRecovering = false;
    this.clearStuckTimer();
    this.stateHistory = this.stateHistory.slice(-5); // Keep last 5 states for history
  }

  /**
   * Check if two connection states are equal
   */
  private statesEqual(state1: ConnectionState, state2: ConnectionState): boolean {
    return state1.signalingState === state2.signalingState &&
           state1.connectionState === state2.connectionState &&
           state1.iceConnectionState === state2.iceConnectionState;
  }

  /**
   * Get current recovery status
   */
  getRecoveryStatus(): {
    isRecovering: boolean;
    recoveryAttempts: number;
    lastStateChange: number;
    stateHistory: ConnectionState[];
  } {
    return {
      isRecovering: this.isRecovering,
      recoveryAttempts: this.recoveryAttempts,
      lastStateChange: this.lastStateChange,
      stateHistory: [...this.stateHistory]
    };
  }

  /**
   * Cleanup recovery monitoring
   */
  cleanup(): void {
    this.clearStuckTimer();
    this.stateHistory = [];
    this.resetRecovery();
  }
}