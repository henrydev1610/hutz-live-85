
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
  transmissionWindow?: boolean;
  isKeepAliveActive?: boolean;
  localPlaceholderStream?: MediaStream;
  sharedParticipantStreams?: {[id: string]: MediaStream};
}

// Define NodeJS namespace if it doesn't exist to fix Timeout type issues
declare namespace NodeJS {
  interface Timeout {
    // Add Symbol.dispose method to match browser timer cleanup API if needed
    [Symbol.dispose]?: () => void;
  }
}
