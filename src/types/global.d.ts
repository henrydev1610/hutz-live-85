
interface Window {
  resetGeneratingState?: () => void;
  _sessionIntervals?: {
    [key: string]: number;
  };
  _streamIntervals?: {
    [key: string]: number;
  };
}

// Fix for Timer vs Timeout type discrepancies
type NodeTimer = number | NodeJS.Timeout; // This accommodates both number and NodeJS.Timeout

// Define NodeJS namespace if it doesn't exist to fix Timeout type issues
declare namespace NodeJS {
  interface Timeout {
    [Symbol.dispose]?: () => void;
  }
}
