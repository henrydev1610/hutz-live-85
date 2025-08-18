
interface Window {
  resetGeneratingState?: () => void;
  _sessionIntervals?: {
    [key: string]: number;
  };
  _streamIntervals?: {
    [key: string]: number;
  };
  _healthCheckIntervals?: {
    [key: string]: number;
  };
  _fallbackChannels?: {
    [key: string]: BroadcastChannel;
  };
  
  // ✅ ADICIONADO: WebRTC and WebSocket debug properties
  hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
  getParticipantStream?: (participantId: string) => MediaStream | null;
  __mlStreams__?: Map<string, MediaStream>;
  webrtcDebugUI?: {
    forceReconnect: () => void;
    getConnectionState: () => any;
    clearWebRTCCache: () => void;
  };
  wsDebug?: {
    getState: () => any;
    getStats: () => any;
    forceReconnect: () => void;
    resetService: () => void;
  };
}

// Define NodeJS namespace if it doesn't exist to fix Timeout type issues
declare namespace NodeJS {
  interface Timeout {
    // Add Symbol.dispose method to match browser timer cleanup API if needed
    [Symbol.dispose]?: () => void;
  }
}
