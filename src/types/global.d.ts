
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
type NodeTimer = any; // This accommodates both NodeJS.Timeout and number
