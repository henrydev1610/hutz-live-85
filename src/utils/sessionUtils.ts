
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
        localStorage.setItem(`telao-heartbeat-${sessionId}`, Date.now().toString());
        
        // Update connectivity status for each participant
        checkParticipantsConnectivity(sessionId, updatedData.participants);
      } catch (e) {
        console.error("Error updating heartbeat:", e);
      }
    }, 5000); // Update every 5 seconds
    
    // Store the interval ID to clean it up later
    window._sessionIntervals = window._sessionIntervals || {};
    window._sessionIntervals[sessionId] = intervalId;
  } catch (e) {
    console.error("Error creating session:", e);
  }
};

/**
 * Check the connectivity status of each participant
 */
const checkParticipantsConnectivity = (sessionId: string, participants: any[]): void => {
  if (!participants || !Array.isArray(participants)) return;
  
  let changed = false;
  
  // Process each participant
  participants.forEach(participant => {
    if (!participant || !participant.id) return;
    
    // Check for recent heartbeats
    try {
      const heartbeatKey = `telao-heartbeat-${sessionId}-${participant.id}`;
      const heartbeat = localStorage.getItem(heartbeatKey);
      
      const wasActive = participant.active;
      
      if (heartbeat) {
        const heartbeatTime = parseInt(heartbeat, 10);
        const timeSinceHeartbeat = Date.now() - heartbeatTime;
        
        // Consider the participant active if heartbeat is less than 30 seconds old
        if (timeSinceHeartbeat < 30000) {
          participant.active = true;
          participant.lastActive = Date.now();
          changed = changed || !wasActive;
        } else if (timeSinceHeartbeat > 60000) {
          // Mark as inactive after no heartbeat for 60 seconds
          participant.active = false;
          changed = changed || wasActive;
        }
      } else {
        // Also check for WebRTC connection status
        const peerConnections = (window as any)._peerConnections || {};
        const pc = Object.values(peerConnections).find((connection: any) => 
          connection && 
          (connection._participantId === participant.id || 
           connection.participantId === participant.id)
        ) as RTCPeerConnection | undefined;
        
        if (pc && ['connected', 'completed'].includes(pc.iceConnectionState)) {
          participant.active = true;
          participant.lastActive = Date.now();
          participant.hasVideo = true;
          changed = changed || !wasActive;
        } else if (!pc && (Date.now() - (participant.lastActive || 0) > 30000)) {
          // No connection and no recent activity
          participant.active = false;
          changed = changed || wasActive;
        }
      }
    } catch (e) {
      console.warn(`Error checking participant ${participant.id} connectivity:`, e);
    }
  });
  
  // If there were changes, update the storage
  if (changed) {
    try {
      const existingDataString = localStorage.getItem(`live-session-${sessionId}`);
      if (existingDataString) {
        const existingData = JSON.parse(existingDataString);
        existingData.participants = participants;
        localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(existingData));
        
        // Notify about participant updates
        notifyParticipants(sessionId, {
          type: 'participant-update',
          participants: participants,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.error("Error updating participants after connectivity check:", e);
    }
  }
};

/**
 * Ends a live session
 */
export const endSession = (sessionId: string): void => {
  try {
    // Get the participants to notify them
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    let participants: any[] = [];
    
    if (sessionDataString) {
      try {
        const sessionData = JSON.parse(sessionDataString);
        participants = sessionData.participants || [];
      } catch (e) {
        console.warn("Error parsing session data:", e);
      }
    }
    
    localStorage.removeItem(`live-session-${sessionId}`);
    localStorage.removeItem(`telao-heartbeat-${sessionId}`);
    
    // Set an explicit leave marker to help clients detect disconnection
    localStorage.setItem(`telao-leave-*-${sessionId}`, Date.now().toString());
    
    // Notify each participant individually
    participants.forEach(participant => {
      if (participant && participant.id) {
        try {
          localStorage.setItem(`telao-leave-${sessionId}-${participant.id}`, Date.now().toString());
        } catch (e) {
          // Ignore errors
        }
      }
    });
    
    // Clean up the heartbeat interval
    if (window._sessionIntervals && window._sessionIntervals[sessionId]) {
      clearInterval(window._sessionIntervals[sessionId]);
      delete window._sessionIntervals[sessionId];
    }
    
    // Try to notify through broadcast channel
    try {
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      channel.postMessage({
        type: 'session-end',
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
    console.log(`Adding participant ${participantId} to session ${sessionId}`);
    
    const sessionDataString = localStorage.getItem(`live-session-${sessionId}`);
    if (!sessionDataString) {
      console.warn(`Session ${sessionId} does not exist`);
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
      existingParticipant.hasVideo = true; // Assume they have video for now
      
      console.log(`Updated existing participant ${participantId}`);
    } else {
      // Add new participant - not auto-selected by default
      const newParticipant = {
        id: participantId,
        name: participantName || `Participante ${sessionData.participants.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: true,
        selected: false,
        hasVideo: true // Assume they have video for now
      };
      
      sessionData.participants.push(newParticipant);
      console.log(`Added new participant ${participantId}`);
    }
    
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Acknowledge the participant connection
    try {
      console.log(`Sending acknowledgment to participant ${participantId}`);
      
      // Via BroadcastChannel
      const ackChannel = new BroadcastChannel(`telao-session-${sessionId}`);
      ackChannel.postMessage({
        type: 'host-acknowledge',
        participantId: participantId,
        timestamp: Date.now()
      });
      setTimeout(() => ackChannel.close(), 500);
      
      // Via localStorage as fallback
      localStorage.setItem(`telao-ack-${sessionId}-${participantId}`, JSON.stringify({
        type: 'host-acknowledge',
        participantId: participantId,
        timestamp: Date.now()
      }));
      
      // Clean up after a short time
      setTimeout(() => {
        try {
          localStorage.removeItem(`telao-ack-${sessionId}-${participantId}`);
        } catch (e) {
          // Ignore errors
        }
      }, 30000);
    } catch (e) {
      console.warn(`Error acknowledging participant ${participantId}:`, e);
    }
    
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

// Declare the window._sessionIntervals property for TypeScript
declare global {
  interface Window {
    _sessionIntervals?: {
      [key: string]: number;
    };
  }
}
