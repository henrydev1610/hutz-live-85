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
    // First check the localStorage
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (sessionDataString) {
      try {
        const sessionData = JSON.parse(sessionDataString);
        // Check if session is still valid (not expired)
        if (sessionData && sessionData.timestamp) {
          const currentTime = Date.now();
          const sessionTime = sessionData.timestamp;
          // Session is valid for 24 hours
          return (currentTime - sessionTime) < 24 * 60 * 60 * 1000;
        }
      } catch (e) {
        console.error("Error parsing session data:", e);
      }
    }

    // Also check for heartbeat which may be more recent
    const heartbeatString = localStorage.getItem(`live-heartbeat-${sessionId}`);
    if (heartbeatString) {
      try {
        const heartbeatTime = parseInt(heartbeatString);
        if (!isNaN(heartbeatTime)) {
          const currentTime = Date.now();
          // Heartbeat is valid for 5 minutes
          return (currentTime - heartbeatTime) < 5 * 60 * 1000;
        }
      } catch (e) {
        console.error("Error parsing heartbeat data:", e);
      }
    }
    
    // Final check - if the host has a newer browser with broadcast channel support
    try {
      // Create a temporary broadcast channel to check if anyone is listening
      const tempChannel = new BroadcastChannel(`live-session-${sessionId}`);
      
      // We must use a promise to handle async nature of broadcast channels
      return new Promise<boolean>((resolve) => {
        // Set up a timeout to resolve as false if no response within 2 seconds
        const timeout = setTimeout(() => {
          tempChannel.close();
          resolve(false);
        }, 2000);
        
        // Send a ping message
        tempChannel.postMessage({ type: 'ping', timestamp: Date.now() });
        
        // Listen for pong response
        tempChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'pong') {
            clearTimeout(timeout);
            tempChannel.close();
            resolve(true);
          }
        };
      }) as unknown as boolean; // Type coercion needed due to sync function with async behavior
    } catch (error) {
      console.warn("BroadcastChannel not supported, falling back to localStorage only");
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
    // Check if session already exists to prevent recreating it
    const existingSession = localStorage.getItem(`live-session-${sessionId}`);
    if (existingSession) {
      console.log("Session already exists, not recreating:", sessionId);
      return;
    }
    
    const sessionData = {
      timestamp: Date.now(),
      status: 'active',
      participants: []
    };
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Also set a heartbeat to keep the session active
    const intervalId = window.setInterval(() => {
      try {
        // Get existing data to preserve participants
        const existingDataString = localStorage.getItem(`live-session-${sessionId}`);
        if (!existingDataString) {
          // Session was deleted, stop the heartbeat
          clearInterval(intervalId);
          return;
        }
        
        const existingData = JSON.parse(existingDataString);
        
        const updatedData = {
          timestamp: Date.now(),
          status: 'active',
          participants: existingData.participants || []
        };
        localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(updatedData));
        localStorage.setItem(`live-heartbeat-${sessionId}`, Date.now().toString());
      } catch (e) {
        console.error("Error updating heartbeat:", e);
      }
    }, 10000); // Update every 10 seconds
    
    // Store the interval ID to clean it up later
    window._sessionIntervals = window._sessionIntervals || {};
    window._sessionIntervals[sessionId] = intervalId;
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
    localStorage.removeItem(`live-heartbeat-${sessionId}`);
    
    // Also set an explicit leave marker to help clients detect disconnection
    localStorage.setItem(`live-leave-*-${sessionId}`, Date.now().toString());
    
    // Clean up the heartbeat interval
    if (window._sessionIntervals && window._sessionIntervals[sessionId]) {
      clearInterval(window._sessionIntervals[sessionId]);
      delete window._sessionIntervals[sessionId];
    }
    
    // Try to notify through broadcast channel
    try {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'participant-leave',
        id: sessionId,
        timestamp: Date.now()
      });
      setTimeout(() => channel.close(), 1000);
    } catch (error) {
      console.warn("BroadcastChannel not supported for disconnect notification");
    }
  } catch (e) {
    console.error("Error ending session:", e);
  }
};

/**
 * Helper function to notify connected participants
 */
export const notifyParticipants = (sessionId: string, message: any): void => {
  try {
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    channel.postMessage(message);
    setTimeout(() => channel.close(), 500);
  } catch (error) {
    console.warn("BroadcastChannel not supported for participant notification");
  }
};

/**
 * Add a new participant to the session
 */
export const addParticipantToSession = (sessionId: string, participantId: string, participantName: string = ''): boolean => {
  try {
    let sessionData;
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    
    if (sessionDataString) {
      try {
        sessionData = JSON.parse(sessionDataString);
      } catch (e) {
        console.error("Error parsing session data:", e);
        sessionData = {
          timestamp: Date.now(),
          status: 'active',
          participants: []
        };
      }
    } else {
      // If no session exists yet (possible race condition with host), create one
      sessionData = {
        timestamp: Date.now(),
        status: 'active',
        participants: []
      };
    }
    
    if (!sessionData.participants) {
      sessionData.participants = [];
    }
    
    // Check if participant already exists
    const existingParticipant = sessionData.participants.find((p: any) => p.id === participantId);
    if (existingParticipant) {
      // Update participation timestamp
      existingParticipant.lastActive = Date.now();
      existingParticipant.active = true;
      existingParticipant.hasVideo = true; // Assume they have video for now
      
      // Send acknowledgement of existing participant
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'host-acknowledge',
          participantId: participantId,
          timestamp: Date.now()
        });
        setTimeout(() => channel.close(), 500);
      } catch (e) {
        console.warn("Error sending acknowledgement via broadcast channel:", e);
      }
    } else {
      // Add new participant - not auto-selected by default
      sessionData.participants.push({
        id: participantId,
        name: participantName || `Participante ${sessionData.participants.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        connectedAt: Date.now(),
        active: true,
        selected: false,
        hasVideo: true // Assume they have video for now
      });
    }
    
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Notify through broadcast channel
    notifyParticipants(sessionId, {
      type: 'participant-update',
      participants: sessionData.participants,
      timestamp: Date.now()
    });
    
    return true;
  } catch (e) {
    console.error("Error adding participant to session:", e);
    return false;
  }
};

/**
 * Get all participants in a session
 */
export const getSessionParticipants = (sessionId: string): any[] => {
  try {
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (!sessionDataString) {
      return [];
    }
    
    const sessionData = JSON.parse(sessionDataString);
    return sessionData.participants || [];
  } catch (e) {
    console.error("Error getting session participants:", e);
    return [];
  }
};

/**
 * Update participant status in a session
 */
export const updateParticipantStatus = (sessionId: string, participantId: string, updates: any): boolean => {
  try {
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (!sessionDataString) {
      return false;
    }
    
    const sessionData = JSON.parse(sessionDataString);
    if (!sessionData.participants) {
      return false;
    }
    
    const participantIndex = sessionData.participants.findIndex((p: any) => p.id === participantId);
    if (participantIndex === -1) {
      return false;
    }
    
    // Update the participant
    sessionData.participants[participantIndex] = {
      ...sessionData.participants[participantIndex],
      ...updates,
      lastActive: Date.now()
    };
    
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Notify through broadcast channel
    notifyParticipants(sessionId, {
      type: 'participant-update',
      participants: sessionData.participants,
      timestamp: Date.now()
    });
    
    return true;
  } catch (e) {
    console.error("Error updating participant status:", e);
    return false;
  }
};

/**
 * Get the session final action
 */
export const getSessionFinalAction = (sessionId: string) => {
  try {
    const sessions = JSON.parse(localStorage.getItem('live-sessions') || '{}');
    const session = sessions[sessionId];
    
    if (!session) return null;
    
    const { finalAction, finalActionImage, finalActionLink, finalActionCoupon } = session;
    
    if (!finalAction || finalAction === 'none') return null;
    
    return {
      type: finalAction as 'none' | 'image' | 'coupon',
      image: finalActionImage || null,
      link: finalActionLink || null,
      coupon: finalActionCoupon || null
    };
  } catch (error) {
    console.error("Error getting session final action:", error);
    return null;
  }
};

// Declare the window._sessionIntervals property for TypeScript
declare global {
  interface Window {
    _sessionIntervals?: {
      [key: string]: number;
    };
  }
}
