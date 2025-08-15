// CRITICAL: Centralized ontrack handler to prevent conflicts
class OnTrackCentralizer {
  private static instance: OnTrackCentralizer;
  private handlers = new Map<string, Set<(event: RTCTrackEvent) => void>>();
  private processedEvents = new Map<string, number>();

  static getInstance(): OnTrackCentralizer {
    if (!OnTrackCentralizer.instance) {
      OnTrackCentralizer.instance = new OnTrackCentralizer();
    }
    return OnTrackCentralizer.instance;
  }

  registerHandler(participantId: string, handler: (event: RTCTrackEvent) => void): void {
    if (!this.handlers.has(participantId)) {
      this.handlers.set(participantId, new Set());
    }
    this.handlers.get(participantId)!.add(handler);
    console.log(`🎯 ONTRACK-CENTRALIZER: Handler registered for ${participantId}`);
  }

  unregisterHandler(participantId: string, handler: (event: RTCTrackEvent) => void): void {
    if (this.handlers.has(participantId)) {
      this.handlers.get(participantId)!.delete(handler);
      if (this.handlers.get(participantId)!.size === 0) {
        this.handlers.delete(participantId);
      }
    }
  }

  processOnTrackEvent(participantId: string, event: RTCTrackEvent): void {
    const eventKey = `${participantId}-${event.track.id}-${Date.now()}`;
    
    // Prevent duplicate processing
    if (this.processedEvents.has(eventKey)) {
      console.log(`🔄 ONTRACK-CENTRALIZER: Duplicate event prevented for ${participantId}`);
      return;
    }
    
    this.processedEvents.set(eventKey, Date.now());
    
    // Clean old processed events (keep last 50)
    if (this.processedEvents.size > 50) {
      const oldestKeys = Array.from(this.processedEvents.keys()).slice(0, 25);
      oldestKeys.forEach(key => this.processedEvents.delete(key));
    }

    console.log(`🎥 ONTRACK-CENTRALIZER: Processing event for ${participantId}`, {
      trackKind: event.track.kind,
      streamCount: event.streams?.length || 0,
      trackId: event.track.id.substring(0, 8)
    });

    // CRITICAL: Single centralized processing
    if (event.streams && event.streams.length > 0) {
      const stream = event.streams[0];
      
      console.log(`✅ ONTRACK-CENTRALIZER: Valid stream for ${participantId}`, {
        streamId: stream.id.substring(0, 8),
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // Send to display manager (single event)
      window.dispatchEvent(new CustomEvent('video-stream-ready', {
        detail: { 
          participantId, 
          stream,
          timestamp: Date.now(),
          source: 'centralizer'
        }
      }));

    } else {
      console.warn(`⚠️ ONTRACK-CENTRALIZER: No streams for ${participantId}`);
      
      // Create synthetic stream if track is available
      if (event.track && event.track.readyState === 'live') {
        const syntheticStream = new MediaStream([event.track]);
        console.log(`🔄 ONTRACK-CENTRALIZER: Created synthetic stream for ${participantId}`);
        
        window.dispatchEvent(new CustomEvent('video-stream-ready', {
          detail: { 
            participantId, 
            stream: syntheticStream,
            timestamp: Date.now(),
            source: 'centralizer-synthetic'
          }
        }));
      }
    }

    // Execute registered handlers (if any - for compatibility)
    const handlerSet = this.handlers.get(participantId);
    if (handlerSet && handlerSet.size > 0) {
      console.log(`📞 ONTRACK-CENTRALIZER: Executing ${handlerSet.size} handlers for ${participantId}`);
      handlerSet.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`❌ ONTRACK-CENTRALIZER: Handler error for ${participantId}:`, error);
        }
      });
    }
  }

  cleanup(participantId?: string): void {
    if (participantId) {
      this.handlers.delete(participantId);
      console.log(`🧹 ONTRACK-CENTRALIZER: Cleaned up ${participantId}`);
    } else {
      this.handlers.clear();
      this.processedEvents.clear();
      console.log(`🧹 ONTRACK-CENTRALIZER: Full cleanup`);
    }
  }

  getStats(): { handlerCount: number; processedEvents: number } {
    const handlerCount = Array.from(this.handlers.values())
      .reduce((total, set) => total + set.size, 0);
    
    return {
      handlerCount,
      processedEvents: this.processedEvents.size
    };
  }
}

export const onTrackCentralizer = OnTrackCentralizer.getInstance();
