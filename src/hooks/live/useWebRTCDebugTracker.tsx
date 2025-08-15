import { useEffect, useRef } from 'react';

interface DebugEvent {
  type: string;
  participantId: string;
  timestamp: number;
  details: any;
}

export const useWebRTCDebugTracker = () => {
  const events = useRef<DebugEvent[]>([]);
  const maxEvents = 100; // Keep last 100 events

  useEffect(() => {
    const trackEvent = (type: string, detail: any) => {
      const event: DebugEvent = {
        type,
        participantId: detail.participantId || 'unknown',
        timestamp: Date.now(),
        details: detail
      };
      
      events.current.push(event);
      if (events.current.length > maxEvents) {
        events.current = events.current.slice(-maxEvents);
      }
      
      // Log critical events immediately
      if (['video-stream-ready', 'ontrack-received', 'video-display-ready'].includes(type)) {
        console.log(`🔍 WEBRTC-DEBUG-TRACKER: ${type}`, {
          participantId: event.participantId,
          timestamp: new Date(event.timestamp).toISOString().split('T')[1],
          details: event.details
        });
      }
    };

    // Track all critical WebRTC events
    const eventTypes = [
      'video-stream-ready',
      'participant-stream-received', 
      'ontrack-received',
      'video-display-ready',
      'participant-joined',
      'webrtc-state-change'
    ];

    const listeners = eventTypes.map(eventType => {
      const listener = (event: CustomEvent) => trackEvent(eventType, event.detail);
      window.addEventListener(eventType, listener as EventListener);
      return { eventType, listener };
    });

    // Debug function available globally
    (window as any).debugWebRTC = () => {
      console.log('🔍 WEBRTC DEBUG SUMMARY:');
      console.log('Events (last 20):', events.current.slice(-20));
      
      const participantEvents = events.current.reduce((acc, event) => {
        if (!acc[event.participantId]) acc[event.participantId] = [];
        acc[event.participantId].push(event);
        return acc;
      }, {} as Record<string, DebugEvent[]>);
      
      console.log('Events by participant:', participantEvents);
      
      // Check for missing ontrack events
      const streamReadyEvents = events.current.filter(e => e.type === 'video-stream-ready');
      const displayReadyEvents = events.current.filter(e => e.type === 'video-display-ready');
      
      console.log(`Stream ready events: ${streamReadyEvents.length}`);
      console.log(`Display ready events: ${displayReadyEvents.length}`);
      
      if (streamReadyEvents.length > displayReadyEvents.length) {
        console.error('❌ MISSING VIDEO DISPLAYS: Some streams received but not displayed!');
      }
    };

    console.log('🔍 WebRTC Debug Tracker initialized. Use debugWebRTC() in console.');

    return () => {
      listeners.forEach(({ eventType, listener }) => {
        window.removeEventListener(eventType, listener as EventListener);
      });
      delete (window as any).debugWebRTC;
    };
  }, []);

  return { events: events.current };
};