
/**
 * Generates a random session ID for live streaming
 */
export const generateSessionId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

/**
 * Checks if a session is active by verifying local storage and broadcast channels
 */
export const isSessionActive = (sessionId: string): boolean => {
  try {
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (sessionDataString) {
      const sessionData = JSON.parse(sessionDataString);
      // Check if session is still valid (not expired)
      if (sessionData && sessionData.timestamp) {
        const currentTime = Date.now();
        const sessionTime = sessionData.timestamp;
        // Session is valid for 24 hours
        return (currentTime - sessionTime) < 24 * 60 * 60 * 1000;
      }
    }
    return false;
  } catch (e) {
    console.error("Error checking session status:", e);
    return false;
  }
};

/**
 * Creates a new live session and stores in localStorage
 */
export const createSession = (sessionId: string): void => {
  try {
    const sessionData = {
      timestamp: Date.now(),
      status: 'active'
    };
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
  } catch (e) {
    console.error("Error creating session:", e);
  }
};

/**
 * Ends a live session
 */
export const endSession = (sessionId: string): void => {
  try {
    localStorage.removeItem(`live-session-${sessionId}`);
  } catch (e) {
    console.error("Error ending session:", e);
  }
};
