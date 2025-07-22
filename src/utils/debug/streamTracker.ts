
// Sistema de rastreamento completo de streams
interface StreamEvent {
  type: 'capture' | 'callback_set' | 'webrtc_add' | 'transmitted' | 'received' | 'displayed';
  participantId: string;
  streamId: string;
  timestamp: number;
  details: any;
}

class StreamTracker {
  private events: StreamEvent[] = [];
  private maxEvents = 100;

  logEvent(event: Omit<StreamEvent, 'timestamp'>) {
    const fullEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    this.events.unshift(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Log crítico para debug
    console.log(`🔍 STREAM TRACKER [${event.type.toUpperCase()}]:`, {
      participantId: event.participantId,
      streamId: event.streamId,
      details: event.details,
      timestamp: new Date(fullEvent.timestamp).toISOString()
    });

    // Dispatch para dashboard em tempo real
    window.dispatchEvent(new CustomEvent('streamTrackerUpdate', {
      detail: fullEvent
    }));
  }

  getEventsForParticipant(participantId: string): StreamEvent[] {
    return this.events.filter(e => e.participantId === participantId);
  }

  getLastEventOfType(participantId: string, type: StreamEvent['type']): StreamEvent | null {
    return this.events.find(e => e.participantId === participantId && e.type === type) || null;
  }

  hasCompletePath(participantId: string): boolean {
    const events = this.getEventsForParticipant(participantId);
    const requiredEvents: StreamEvent['type'][] = ['capture', 'callback_set', 'webrtc_add', 'transmitted'];
    
    return requiredEvents.every(type => 
      events.some(e => e.type === type)
    );
  }

  findMissingStep(participantId: string): string | null {
    const events = this.getEventsForParticipant(participantId);
    
    if (!events.some(e => e.type === 'capture')) return 'Stream not captured';
    if (!events.some(e => e.type === 'callback_set')) return 'Stream callback not set';
    if (!events.some(e => e.type === 'webrtc_add')) return 'Stream not added to WebRTC';
    if (!events.some(e => e.type === 'transmitted')) return 'Stream not transmitted';
    if (!events.some(e => e.type === 'received')) return 'Stream not received by host';
    if (!events.some(e => e.type === 'displayed')) return 'Stream not displayed in video element';
    
    return null;
  }

  exportDebugReport(): string {
    return JSON.stringify({
      events: this.events,
      summary: this.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }, null, 2);
  }
}

export const streamTracker = new StreamTracker();

// Make available globally for debugging
(window as any).streamTracker = streamTracker;
