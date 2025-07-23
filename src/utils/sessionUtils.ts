/**
 * Generates a random session ID for live streaming
 */
export const generateSessionId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

/**
 * Generates a random room code for Twilio rooms
 */
export const generateRoomCode = (): string => {
  return `room-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Checks if a session is active by verifying local storage and broadcast channels
 * Enhanced with multi-method checks for cross-browser compatibility
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
    
    // Final check with browsers that support BroadcastChannel
    try {
      const isBroadcastSupported = typeof BroadcastChannel !== 'undefined';
      if (isBroadcastSupported) {
        // Create a temporary broadcast channel to check if anyone is listening
        const tempChannel = new BroadcastChannel(`live-session-${sessionId}`);
        
        // Return a Promise for async operation in Firefox/Opera environments
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
      }
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
 * Enhanced with multiple notification channels for cross-browser compatibility
 */
export const notifyParticipants = (sessionId: string, message: any): void => {
  try {
    // Try BroadcastChannel first (Chrome, Edge)
    try {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage(message);
      setTimeout(() => channel.close(), 500);
    } catch (error) {
      console.warn("BroadcastChannel not supported for participant notification");
    }
    
    // Backup method: store in localStorage with timestamp for Firefox/Opera
    try {
      const notifyKey = `notify-${sessionId}-${Date.now()}`;
      localStorage.setItem(notifyKey, JSON.stringify({
        ...message,
        notifyTimestamp: Date.now()
      }));
      
      // Clean up after a few seconds
      setTimeout(() => localStorage.removeItem(notifyKey), 10000);
      
      // Try to dispatch storage event manually for Firefox
      try {
        const storageEvent = document.createEvent('StorageEvent');
        storageEvent.initStorageEvent('storage', false, false, notifyKey, null, 
                                    JSON.stringify(message), window.location.href, window.localStorage);
        window.dispatchEvent(storageEvent);
      } catch (e) {
        console.warn("Could not dispatch storage event manually:", e);
      }
    } catch (storageError) {
      console.error("Error using localStorage for notification:", storageError);
    }
  } catch (e) {
    console.error("Error notifying participants:", e);
  }
};

/**
 * Add a new participant to the session
 * Enhanced with browser detection and multi-method communication
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
    
    // Detect browser type
    const browserType = detectBrowserType();
    
    // Check if participant already exists
    const existingParticipant = sessionData.participants.find((p: any) => p.id === participantId);
    if (existingParticipant) {
      // Update participation timestamp
      existingParticipant.lastActive = Date.now();
      existingParticipant.active = true;
      existingParticipant.hasVideo = true; // Assume they have video for now
      existingParticipant.browserType = browserType; // Update browser type
      
      // Send acknowledgement of existing participant through multiple channels
      sendAcknowledgement(sessionId, participantId);
    } else {
      // Add new participant - not auto-selected by default
      sessionData.participants.push({
        id: participantId,
        name: participantName || `Participante ${sessionData.participants.length + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        connectedAt: Date.now(),
        active: true,
        selected: false, // Participants are not selected by default
        hasVideo: true, // Assume they have video for now
        browserType: browserType // Store browser type
      });
    }
    
    localStorage.setItem(`live-session-${sessionId}`, JSON.stringify(sessionData));
    
    // Notify through multiple channels
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
 * Helper function to detect browser type for better compatibility handling
 */
const detectBrowserType = (): string => {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.indexOf('firefox') > -1) {
    return 'firefox';
  } else if (ua.indexOf('opr') > -1 || ua.indexOf('opera') > -1) {
    return 'opera';
  } else if (ua.indexOf('edge') > -1 || ua.indexOf('edg') > -1) {
    return 'edge';
  } else if (ua.indexOf('chrome') > -1) {
    return 'chrome';
  } else if (ua.indexOf('safari') > -1) {
    return 'safari';
  } else {
    return 'unknown';
  }
};

/**
 * Helper function to send acknowledgement through multiple channels
 */
const sendAcknowledgement = (sessionId: string, participantId: string): void => {
  try {
    // Try BroadcastChannel first
    try {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'host-acknowledge',
        participantId: participantId,
        timestamp: Date.now()
      });
      
      const responseChannel = new BroadcastChannel(`response-${sessionId}`);
      responseChannel.postMessage({
        type: 'host-ack',
        targetId: participantId,
        timestamp: Date.now()
      });
      
      setTimeout(() => {
        channel.close();
        responseChannel.close();
      }, 500);
    } catch (e) {
      console.warn("Error sending acknowledgement via broadcast channel:", e);
    }
    
    // Also use localStorage for Firefox/Opera
    try {
      const ackKey = `ack-${sessionId}-${participantId}-${Date.now()}`;
      localStorage.setItem(ackKey, JSON.stringify({
        type: 'host-ack',
        targetId: participantId,
        timestamp: Date.now()
      }));
      
      const responseKey = `response-${sessionId}-${participantId}-${Date.now()}`;
      localStorage.setItem(responseKey, JSON.stringify({
        type: 'host-ack',
        targetId: participantId,
        timestamp: Date.now()
      }));
      
      // Clean up after a few seconds
      setTimeout(() => {
        localStorage.removeItem(ackKey);
        localStorage.removeItem(responseKey);
      }, 10000);
      
      // Try to dispatch storage event manually for Firefox
      try {
        const storageEvent = document.createEvent('StorageEvent');
        storageEvent.initStorageEvent('storage', false, false, responseKey, null, 
                                    JSON.stringify({
                                      type: 'host-ack',
                                      targetId: participantId,
                                      timestamp: Date.now()
                                    }), 
                                    window.location.href, window.localStorage);
        window.dispatchEvent(storageEvent);
      } catch (e) {
        console.warn("Could not dispatch storage event manually:", e);
      }
    } catch (e) {
      console.error("Error using localStorage for acknowledgement:", e);
    }
  } catch (e) {
    console.error("Error sending acknowledgement:", e);
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

/**
 * Handle participant video stream with enhanced cross-browser compatibility
 */
export const handleParticipantVideo = (sessionId: string, participantId: string, stream: MediaStream) => {
  try {
    console.log(`Handling video stream for participant ${participantId}`);
    
    // Detect browser
    const browserType = detectBrowserType();
    
    // Update participant status to indicate they have video
    updateParticipantStatus(sessionId, participantId, {
      hasVideo: true,
      lastActive: Date.now(),
      browserType
    });
    
    // Broadcast stream info through multiple channels for redundancy
    try {
      // BroadcastChannel method (primary for Chrome, Edge)
      try {
        // Main channel
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'video-stream',
          participantId,
          hasStream: true,
          browserType,
          trackIds: stream.getTracks().map(track => track.id),
          timestamp: Date.now()
        });
        
        // Backup channel
        const backupChannel = new BroadcastChannel(`stream-info-${sessionId}`);
        backupChannel.postMessage({
          type: 'video-stream',
          participantId,
          hasStream: true,
          browserType,
          trackIds: stream.getTracks().map(track => track.id),
          timestamp: Date.now()
        });
        
        setTimeout(() => {
          channel.close();
          backupChannel.close();
        }, 500);
      } catch (e) {
        console.error("Error broadcasting stream info via BroadcastChannel:", e);
      }
      
      // localStorage method (for Firefox/Opera)
      try {
        const streamInfoKey = `stream-info-${sessionId}-${participantId}-${Date.now()}`;
        localStorage.setItem(streamInfoKey, JSON.stringify({
          type: 'video-stream',
          participantId,
          hasStream: true,
          browserType,
          trackIds: stream.getTracks().map(track => track.id),
          timestamp: Date.now()
        }));
        
        // Try to dispatch storage event manually for Firefox
        try {
          const storageEvent = document.createEvent('StorageEvent');
          storageEvent.initStorageEvent('storage', false, false, streamInfoKey, null, 
                                      JSON.stringify({
                                        type: 'video-stream',
                                        participantId,
                                        hasStream: true,
                                        browserType,
                                        trackIds: stream.getTracks().map(track => track.id),
                                        timestamp: Date.now()
                                      }), 
                                      window.location.href, window.localStorage);
          window.dispatchEvent(storageEvent);
        } catch (e) {
          console.warn("Could not dispatch storage event manually:", e);
        }
        
        // Clean up after a few seconds
        setTimeout(() => localStorage.removeItem(streamInfoKey), 30000);
      } catch (e) {
        console.error("Error storing stream info in localStorage:", e);
      }
    } catch (e) {
      console.error("Error sharing stream info:", e);
    }
  } catch (e) {
    console.error("Error handling participant video:", e);
  }
};

// Declare the window._sessionIntervals property for TypeScript
declare global {
  interface Window {
    _sessionIntervals?: {
      [key: string]: number;
    };
    _streamIntervals?: {
      [key: string]: number;
    };
  }
}
