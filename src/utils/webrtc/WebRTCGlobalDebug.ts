// Global WebRTC Debug Utilities
import { getHostConnectionsState } from '../../webrtc/handshake/HostHandshake';
import { getLocalStream } from '../../webrtc/handshake/ParticipantHandshake';

export interface WebRTCDebugState {
  timestamp: number;
  hostConnections: any;
  participantStream: boolean;
  environment: {
    hasRTCPeerConnection: boolean;
    hasGetUserMedia: boolean;
    hasWebSocket: boolean;
    userAgent: string;
    location: string;
  };
  streams: {
    activeStreams: number;
    participantStreams: any[];
  };
}

class WebRTCGlobalDebugger {
  private static instance: WebRTCGlobalDebugger;
  private debugHistory: WebRTCDebugState[] = [];
  private maxHistorySize = 50;

  static getInstance(): WebRTCGlobalDebugger {
    if (!WebRTCGlobalDebugger.instance) {
      WebRTCGlobalDebugger.instance = new WebRTCGlobalDebugger();
    }
    return WebRTCGlobalDebugger.instance;
  }

  getCurrentState(): WebRTCDebugState {
    const state: WebRTCDebugState = {
      timestamp: Date.now(),
      hostConnections: getHostConnectionsState(),
      participantStream: !!getLocalStream(),
      environment: {
        hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        hasWebSocket: typeof WebSocket !== 'undefined',
        userAgent: navigator.userAgent,
        location: window.location.href
      },
      streams: {
        activeStreams: 0,
        participantStreams: []
      }
    };

    // Add to history
    this.debugHistory.push(state);
    if (this.debugHistory.length > this.maxHistorySize) {
      this.debugHistory.shift();
    }

    return state;
  }

  getDebugHistory(): WebRTCDebugState[] {
    return [...this.debugHistory];
  }

  logCurrentState(): void {
    const state = this.getCurrentState();
    console.log('🔍 WEBRTC GLOBAL DEBUG:', state);
  }

  exposeGlobalFunctions(): void {
    // Expose global debug functions
    (window as any).__webrtcDebug = () => {
      this.logCurrentState();
      return this.getCurrentState();
    };

    (window as any).__webrtcHistory = () => {
      console.log('📚 WEBRTC DEBUG HISTORY:', this.getDebugHistory());
      return this.getDebugHistory();
    };

    (window as any).__webrtcClear = () => {
      this.debugHistory = [];
      console.log('🧹 WEBRTC DEBUG HISTORY CLEARED');
    };

    (window as any).__webrtcHeartbeat = () => {
      console.log('💓 WEBRTC HEARTBEAT:', {
        timestamp: new Date().toISOString(),
        hostConnections: getHostConnectionsState(),
        participantStream: !!getLocalStream(),
        totalConnections: Object.keys(getHostConnectionsState() || {}).length
      });
    };

    console.log('✅ WEBRTC Global debug functions exposed:');
    console.log('  - window.__webrtcDebug() - Current state');
    console.log('  - window.__webrtcHistory() - Debug history');
    console.log('  - window.__webrtcClear() - Clear history');
    console.log('  - window.__webrtcHeartbeat() - Heartbeat check');
  }

  startHeartbeat(intervalMs: number = 10000): void {
    setInterval(() => {
      if ((window as any).__webrtcHeartbeat) {
        (window as any).__webrtcHeartbeat();
      }
    }, intervalMs);
    console.log(`💓 WEBRTC Heartbeat iniciado (${intervalMs}ms)`);
  }
}

export const webrtcGlobalDebugger = WebRTCGlobalDebugger.getInstance();