// Global type declarations for the window object and debugging utilities

declare global {
  interface Window {
    // WebRTC Debug Functions
    getWebRTCManager?: () => import('@/utils/webrtc/UnifiedWebRTCManager').UnifiedWebRTCManager | null;
    debugWebRTC?: () => void;
    resetWebRTC?: () => void;
    breakWebRTCLoops?: () => void;
    
    // Participant Management Debug
    debugParticipants?: () => void;
    getParticipantStream?: (participantId: string) => MediaStream | null;
    
    // Connection Health Debug  
    debugConnectionHealth?: () => void;
    forceConnectionRecovery?: () => void;
    
    // Auto Retry Debug
    debugAutoRetry?: () => void;
    
    // Circuit Breaker Debug
    debugCircuitBreaker?: () => void;
    
    // Environment Debug
    debugEnvironment?: () => void;
    
    // Stream Debug
    debugStreams?: () => void;
    
    // Connection Bridge Debug
    debugConnectionBridge?: () => void;
    
    // Host-specific functions
    hostStreamCallback?: (participantId: string, stream: MediaStream) => void;
    
    // Transmission window reference
    transmissionWindow?: Window | null;
    
    // Flag to prevent duplicate handler setup
    __hostHandlersSetup?: boolean;
    
    // Legacy properties for compatibility
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
    
    // WebRTC streams debug map
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
}

// Define NodeJS namespace if it doesn't exist to fix Timeout type issues
declare namespace NodeJS {
  interface Timeout {
    [Symbol.dispose]?: () => void;
  }
}

export {};