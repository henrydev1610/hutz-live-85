
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

    // Also check for active broadcast channel
    try {
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      const isActive = true;
      channel.close();
      return isActive;
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
    const sessionData = {
      timestamp: Date.now(),
      status: 'active',
      participants: []
    };
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Also set a heartbeat to keep the session active
    setInterval(() => {
      try {
        // Get existing data to preserve participants
        const existingDataString = localStorage.getItem(`live-session-${sessionId}`);
        const existingData = existingDataString ? JSON.parse(existingDataString) : { participants: [] };
        
        const updatedData = {
          timestamp: Date.now(),
          status: 'active',
          participants: existingData.participants || []
        };
        localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(updatedData));
        localStorage.setItem(`telao-heartbeat-${sessionId}`, Date.now().toString());
      } catch (e) {
        console.error("Error updating heartbeat:", e);
      }
    }, 10000); // Update every 10 seconds
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
    localStorage.removeItem(`telao-heartbeat-${sessionId}`);
    
    // Also set an explicit leave marker to help clients detect disconnection
    localStorage.setItem(`telao-leave-*-${sessionId}`, Date.now().toString());
    
    // Try to notify through broadcast channel
    try {
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
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
    const channel = new BroadcastChannel(`telao-session-${sessionId}`);
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
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (!sessionDataString) {
      return false;
    }
    
    const sessionData = JSON.parse(sessionDataString);
    if (!sessionData.participants) {
      sessionData.participants = [];
    }
    
    // Check if participant already exists
    const existingParticipant = sessionData.participants.find((p: any) => p.id === participantId);
    if (existingParticipant) {
      // Update participation timestamp
      existingParticipant.lastActive = Date.now();
      existingParticipant.active = true;
    } else {
      // Add new participant - not auto-selected by default
      sessionData.participants.push({
        id: participantId,
        name: participantName || `Participante ${sessionData.participants.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: true,
        selected: false // Don't auto-select participants
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
