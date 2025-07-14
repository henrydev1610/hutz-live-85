export class StreamSynchronizer {
  private streamCallbacks: Map<string, ((stream: MediaStream) => void)[]> = new Map();
  private activeStreams: Map<string, MediaStream> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();

  constructor() {
    console.log('🔄 StreamSynchronizer initialized');
  }

  // Register a callback for when a specific participant's stream becomes available
  onStreamAvailable(participantId: string, callback: (stream: MediaStream) => void): void {
    console.log(`📝 SYNC: Registering stream callback for ${participantId}`);
    
    if (!this.streamCallbacks.has(participantId)) {
      this.streamCallbacks.set(participantId, []);
    }
    
    this.streamCallbacks.get(participantId)!.push(callback);

    // If stream is already available, trigger callback immediately
    const existingStream = this.activeStreams.get(participantId);
    if (existingStream) {
      console.log(`⚡ SYNC: Immediate callback trigger for ${participantId}`);
      callback(existingStream);
    }
  }

  // Register a new stream and trigger all waiting callbacks
  registerStream(participantId: string, stream: MediaStream): void {
    console.log(`📹 SYNC: Registering stream for ${participantId}`);
    
    this.activeStreams.set(participantId, stream);
    this.recoveryAttempts.delete(participantId); // Reset recovery attempts

    // Trigger all waiting callbacks
    const callbacks = this.streamCallbacks.get(participantId);
    if (callbacks && callbacks.length > 0) {
      console.log(`🚀 SYNC: Triggering ${callbacks.length} callbacks for ${participantId}`);
      callbacks.forEach(callback => {
        try {
          callback(stream);
        } catch (error) {
          console.error(`❌ SYNC: Callback error for ${participantId}:`, error);
        }
      });
      
      // Clear callbacks after successful trigger
      this.streamCallbacks.delete(participantId);
    }

    // Start heartbeat monitoring
    this.startStreamHeartbeat(participantId, stream);
  }

  // Force synchronization - useful for recovery scenarios
  forceSynchronization(participantId: string): void {
    console.log(`🔄 SYNC: Force synchronization for ${participantId}`);
    
    const stream = this.activeStreams.get(participantId);
    if (stream) {
      this.registerStream(participantId, stream);
    } else {
      console.warn(`⚠️ SYNC: No stream available for force sync: ${participantId}`);
      this.attemptStreamRecovery(participantId);
    }
  }

  // Check if a stream is available
  hasStream(participantId: string): boolean {
    return this.activeStreams.has(participantId);
  }

  // Get stream if available
  getStream(participantId: string): MediaStream | null {
    return this.activeStreams.get(participantId) || null;
  }

  // Start heartbeat monitoring for a stream
  private startStreamHeartbeat(participantId: string, stream: MediaStream): void {
    // Clear existing heartbeat
    this.clearStreamHeartbeat(participantId);

    console.log(`💓 SYNC: Starting heartbeat for ${participantId}`);
    
    const interval = setInterval(() => {
      if (stream.active && stream.getTracks().some(track => track.readyState === 'live')) {
        console.log(`💓 SYNC: Heartbeat OK for ${participantId}`);
      } else {
        console.warn(`💔 SYNC: Stream health issue for ${participantId}`);
        this.clearStreamHeartbeat(participantId);
        this.attemptStreamRecovery(participantId);
      }
    }, 10000); // 10 second heartbeat

    this.heartbeatIntervals.set(participantId, interval);
  }

  // Clear heartbeat for a participant
  private clearStreamHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`💔 SYNC: Cleared heartbeat for ${participantId}`);
    }
  }

  // Attempt to recover a lost stream
  private attemptStreamRecovery(participantId: string): void {
    const attempts = this.recoveryAttempts.get(participantId) || 0;
    
    if (attempts >= 3) {
      console.error(`❌ SYNC: Max recovery attempts reached for ${participantId}`);
      return;
    }

    this.recoveryAttempts.set(participantId, attempts + 1);
    console.log(`🔄 SYNC: Recovery attempt ${attempts + 1} for ${participantId}`);

    // Trigger recovery callbacks after delay
    setTimeout(() => {
      const callbacks = this.streamCallbacks.get(participantId);
      if (callbacks && callbacks.length > 0) {
        console.log(`🔄 SYNC: Re-triggering callbacks for recovery: ${participantId}`);
        callbacks.forEach(callback => {
          // This will cause the system to re-request the stream
          try {
            const existingStream = this.activeStreams.get(participantId);
            if (existingStream) {
              callback(existingStream);
            }
          } catch (error) {
            console.error(`❌ SYNC: Recovery callback error for ${participantId}:`, error);
          }
        });
      }
    }, 2000 * attempts); // Exponential backoff
  }

  // Remove a participant completely
  removeParticipant(participantId: string): void {
    console.log(`🗑️ SYNC: Removing participant ${participantId}`);
    
    this.clearStreamHeartbeat(participantId);
    this.activeStreams.delete(participantId);
    this.streamCallbacks.delete(participantId);
    this.recoveryAttempts.delete(participantId);
  }

  // Cleanup all resources
  cleanup(): void {
    console.log('🧹 SYNC: Cleaning up StreamSynchronizer');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 SYNC: Cleared heartbeat for ${participantId}`);
    });
    
    this.heartbeatIntervals.clear();
    this.activeStreams.clear();
    this.streamCallbacks.clear();
    this.recoveryAttempts.clear();
  }

  // Get debug information
  getDebugInfo(): { 
    activeStreams: string[], 
    waitingCallbacks: string[], 
    heartbeats: string[],
    recoveryAttempts: Record<string, number>
  } {
    return {
      activeStreams: Array.from(this.activeStreams.keys()),
      waitingCallbacks: Array.from(this.streamCallbacks.keys()),
      heartbeats: Array.from(this.heartbeatIntervals.keys()),
      recoveryAttempts: Object.fromEntries(this.recoveryAttempts)
    };
  }
}

// Singleton instance for global use
export const streamSynchronizer = new StreamSynchronizer();