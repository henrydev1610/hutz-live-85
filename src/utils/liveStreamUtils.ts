import { createSession, endSession, addParticipantToSession, updateParticipantStatus, notifyParticipants } from './sessionUtils';

interface ParticipantCallbacks {
  onParticipantJoin: (id: string) => void;
  onParticipantLeave: (id: string) => void;
  onParticipantHeartbeat: (id: string) => void;
}

/**
 * Initialize a host session for live streaming
 */
export const initializeHostSession = (sessionId: string, callbacks: ParticipantCallbacks) => {
  console.log("Initializing host session:", sessionId);
  
  // Create the session record
  createSession(sessionId);
  
  // Set up broadcast channel for this session
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  
  // Also listen on a secondary channel for connection issues
  const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
  
  // Set up heartbeat to keep session alive
  const heartbeatInterval = setInterval(() => {
    channel.postMessage({
      type: 'host-heartbeat',
      timestamp: Date.now()
    });
    
    // Also post to the backup channel
    try {
      backupChannel.postMessage({
        type: 'host-heartbeat',
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn("Error sending backup heartbeat:", e);
    }
    
    // Update localStorage heartbeat for even more reliability
    try {
      localStorage.setItem(`telao-heartbeat-${sessionId}`, Date.now().toString());
    } catch (e) {
      console.warn("Error updating localStorage heartbeat:", e);
    }
  }, 5000);
  
  // Handle session join via localStorage fallback
  const checkLocalStorageFallback = setInterval(() => {
    try {
      // Check for join requests in localStorage
      const joinKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`telao-join-${sessionId}`) || 
        key.startsWith(`join-${sessionId}`)
      );
      
      joinKeys.forEach(key => {
        try {
          const joinDataStr = localStorage.getItem(key);
          if (joinDataStr) {
            const joinData = JSON.parse(joinDataStr);
            if (joinData && joinData.id && joinData.type === 'participant-join') {
              console.log('Found participant join via localStorage:', joinData.id);
              
              // Acknowledge the join via localStorage
              localStorage.setItem(`telao-ack-${sessionId}-${joinData.id}`, JSON.stringify({
                type: 'host-acknowledge',
                participantId: joinData.id,
                timestamp: Date.now()
              }));
              
              // Add participant to session storage
              addParticipantToSession(sessionId, joinData.id);
              
              // Notify the callback
              callbacks.onParticipantJoin(joinData.id);
            }
          }
          
          // Clean up this join request
          localStorage.removeItem(key);
        } catch (e) {
          console.warn("Error processing localStorage join:", e);
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn("Error checking localStorage joins:", e);
    }
  }, 1000);
  
  // Listen for participant events on primary channel
  channel.onmessage = (event) => {
    const { data } = event;
    console.log("Host received message:", data.type, data.id);
    
    if (data.type === 'participant-join') {
      console.log('Participant joined:', data.id);
      
      // Add participant to session storage
      addParticipantToSession(sessionId, data.id);
      
      // Acknowledge the participant join
      channel.postMessage({
        type: 'host-acknowledge',
        participantId: data.id,
        timestamp: Date.now()
      });
      
      // Also acknowledge via backup channel
      try {
        backupChannel.postMessage({
          type: 'host-acknowledge',
          participantId: data.id,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending backup acknowledgment:", e);
      }
      
      // Also acknowledge via localStorage for maximum reliability
      try {
        localStorage.setItem(`telao-ack-${sessionId}-${data.id}`, JSON.stringify({
          type: 'host-acknowledge',
          participantId: data.id,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("Error setting localStorage acknowledgment:", e);
      }
      
      // Notify the callback
      callbacks.onParticipantJoin(data.id);
    } 
    else if (data.type === 'participant-leave') {
      console.log('Participant left:', data.id);
      // Update participant status
      updateParticipantStatus(sessionId, data.id, { active: false });
      callbacks.onParticipantLeave(data.id);
    }
    else if (data.type === 'participant-heartbeat') {
      updateParticipantStatus(sessionId, data.id, { active: true, lastActive: Date.now() });
      callbacks.onParticipantHeartbeat(data.id);
    }
    else if (data.type === 'ping') {
      // Respond to ping with pong
      channel.postMessage({
        type: 'pong',
        timestamp: Date.now()
      });
    }
  };
  
  // Listen for backup channel messages
  backupChannel.onmessage = (event) => {
    const { data } = event;
    
    if (data.type === 'participant-join') {
      console.log('Participant joined via backup channel:', data.id);
      
      // Add participant to session storage
      addParticipantToSession(sessionId, data.id);
      
      // Acknowledge the participant join on both channels
      backupChannel.postMessage({
        type: 'host-acknowledge',
        participantId: data.id,
        timestamp: Date.now()
      });
      
      channel.postMessage({
        type: 'host-acknowledge',
        participantId: data.id,
        timestamp: Date.now()
      });
      
      // Also acknowledge via localStorage
      try {
        localStorage.setItem(`telao-ack-${sessionId}-${data.id}`, JSON.stringify({
          type: 'host-acknowledge',
          participantId: data.id,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn("Error setting localStorage acknowledgment:", e);
      }
      
      // Notify the callback
      callbacks.onParticipantJoin(data.id);
    }
    else if (data.type === 'participant-leave') {
      updateParticipantStatus(sessionId, data.id, { active: false });
      callbacks.onParticipantLeave(data.id);
    }
    else if (data.type === 'participant-heartbeat') {
      updateParticipantStatus(sessionId, data.id, { active: true, lastActive: Date.now() });
      callbacks.onParticipantHeartbeat(data.id);
    }
    else if (data.type === 'ping') {
      // Respond to ping with pong on both channels
      backupChannel.postMessage({
        type: 'pong',
        timestamp: Date.now()
      });
    }
  };
  
  // Return cleanup function
  return () => {
    clearInterval(heartbeatInterval);
    clearInterval(checkLocalStorageFallback);
    channel.close();
    backupChannel.close();
    console.log("Host session cleanup for:", sessionId);
  };
};

/**
 * Initialize a participant session for live streaming
 */
export const initializeParticipantSession = (sessionId: string, participantId: string) => {
  console.log("Initializing participant session:", sessionId, "participant:", participantId);
  
  // Set up broadcast channel for this session
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  
  // Also set up a backup channel for cross-compatibility
  const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
  
  // Use localStorage as well for maximum reliability
  try {
    localStorage.setItem(`telao-join-${sessionId}-${Date.now()}`, JSON.stringify({
      type: 'participant-join',
      id: participantId,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn("Error using localStorage join:", e);
  }
  
  // Send join message on primary channel
  channel.postMessage({
    type: 'participant-join',
    id: participantId,
    timestamp: Date.now()
  });
  
  // Send join message on backup channel too
  backupChannel.postMessage({
    type: 'participant-join',
    id: participantId,
    timestamp: Date.now()
  });
  
  // Set up periodic join message until acknowledged
  let joinInterval: any = null;
  let acknowledgedJoin = false;
  
  const clearJoinInterval = () => {
    if (joinInterval) {
      clearInterval(joinInterval);
      joinInterval = null;
    }
  };
  
  // Listen for acknowledgment
  const channelMessageHandler = (event: MessageEvent) => {
    const { data } = event;
    if (data.type === 'host-acknowledge' && data.participantId === participantId) {
      console.log("Join acknowledged by host");
      acknowledgedJoin = true;
      clearJoinInterval();
    }
    
    // Also respond to pings
    if (data.type === 'ping') {
      channel.postMessage({
        type: 'pong',
        id: participantId,
        timestamp: Date.now()
      });
    }
  };
  
  channel.addEventListener('message', channelMessageHandler);
  backupChannel.addEventListener('message', channelMessageHandler);
  
  // Check localStorage for acknowledgment as well
  const checkLocalStorageAck = () => {
    try {
      const ackKey = `telao-ack-${sessionId}-${participantId}`;
      const ackData = localStorage.getItem(ackKey);
      if (ackData) {
        try {
          console.log("Found acknowledgement via localStorage");
          localStorage.removeItem(ackKey);
          acknowledgedJoin = true;
          clearJoinInterval();
        } catch (e) {
          console.warn("Error processing localStorage ack:", e);
        }
      }
    } catch (e) {
      console.warn("Error checking localStorage ack:", e);
    }
  };
  
  // Set up recurring checks
  const localStorageCheckInterval = setInterval(checkLocalStorageAck, 1000);
  
  // Set up periodic retry for join message
  joinInterval = setInterval(() => {
    if (!acknowledgedJoin) {
      console.log("Retrying join message...");
      
      // Send via BroadcastChannel
      channel.postMessage({
        type: 'participant-join',
        id: participantId,
        timestamp: Date.now()
      });
      
      // Send via backup channel
      backupChannel.postMessage({
        type: 'participant-join',
        id: participantId,
        timestamp: Date.now()
      });
      
      // Also try localStorage
      try {
        localStorage.setItem(`telao-join-${sessionId}-${Date.now()}`, JSON.stringify({
          type: 'participant-join',
          id: participantId,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore localStorage errors
      }
      
      checkLocalStorageAck();
    } else {
      clearJoinInterval();
    }
  }, 2000);
  
  // Automatically stop retry after 60 seconds regardless
  setTimeout(clearJoinInterval, 60000);
  
  // Set up heartbeat to indicate participant is still active
  const heartbeatInterval = setInterval(() => {
    // Primary channel heartbeat
    channel.postMessage({
      type: 'participant-heartbeat',
      id: participantId,
      timestamp: Date.now()
    });
    
    // Backup channel heartbeat
    backupChannel.postMessage({
      type: 'participant-heartbeat',
      id: participantId,
      timestamp: Date.now()
    });
    
    // Also use localStorage for heartbeat
    try {
      localStorage.setItem(`telao-heartbeat-${sessionId}-${participantId}`, Date.now().toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, 5000);
  
  // Return cleanup function
  return () => {
    // Send leave message
    channel.postMessage({
      type: 'participant-leave',
      id: participantId,
      timestamp: Date.now()
    });
    
    backupChannel.postMessage({
      type: 'participant-leave',
      id: participantId,
      timestamp: Date.now()
    });
    
    // Set leave marker in localStorage
    try {
      localStorage.setItem(`telao-leave-${sessionId}-${participantId}`, JSON.stringify({
        type: 'participant-leave',
        id: participantId,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore localStorage errors
    }
    
    clearInterval(heartbeatInterval);
    clearInterval(joinInterval);
    clearInterval(localStorageCheckInterval);
    
    channel.removeEventListener('message', channelMessageHandler);
    backupChannel.removeEventListener('message', channelMessageHandler);
    
    channel.close();
    backupChannel.close();
    
    console.log("Participant session cleanup for:", participantId);
  };
};

/**
 * Clean up a session completely
 */
export const cleanupSession = (sessionId: string) => {
  console.log("Cleaning up session:", sessionId);
  
  // End the session in storage
  endSession(sessionId);
  
  // Notify all participants that the session has ended
  try {
    // Use both channels to ensure all participants get the message
    const primaryChannel = new BroadcastChannel(`live-session-${sessionId}`);
    const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
    
    const endMessage = {
      type: 'session-end',
      timestamp: Date.now()
    };
    
    primaryChannel.postMessage(endMessage);
    backupChannel.postMessage(endMessage);
    
    // Also set session end in localStorage
    try {
      localStorage.setItem(`telao-session-end-${sessionId}`, Date.now().toString());
    } catch (e) {
      console.warn("Error setting session end in localStorage:", e);
    }
    
    // Close the channels after a short delay
    setTimeout(() => {
      try {
        primaryChannel.close();
        backupChannel.close();
      } catch (e) {
        console.error("Error closing channels:", e);
      }
    }, 1000);
  } catch (e) {
    console.error("Error cleaning up session:", e);
  }
  
  // Notify all participants via all available methods
  notifyParticipants(sessionId, {
    type: 'session-end',
    timestamp: Date.now()
  });
};
