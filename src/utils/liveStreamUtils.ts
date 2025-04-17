
import { createSession, endSession, addParticipantToSession, updateParticipantStatus } from './sessionUtils';

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
  
  // Set up heartbeat to keep session alive
  const heartbeatInterval = setInterval(() => {
    channel.postMessage({
      type: 'host-heartbeat',
      timestamp: Date.now()
    });
  }, 5000);
  
  // Listen for participant events
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
  };
  
  // Return cleanup function
  return () => {
    clearInterval(heartbeatInterval);
    channel.close();
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
  
  // Join the session
  channel.postMessage({
    type: 'participant-join',
    id: participantId,
    timestamp: Date.now()
  });
  
  // Set up heartbeat to indicate participant is still active
  const heartbeatInterval = setInterval(() => {
    channel.postMessage({
      type: 'participant-heartbeat',
      id: participantId,
      timestamp: Date.now()
    });
  }, 5000);
  
  // Return cleanup function
  return () => {
    // Send leave message
    channel.postMessage({
      type: 'participant-leave',
      id: participantId,
      timestamp: Date.now()
    });
    
    clearInterval(heartbeatInterval);
    channel.close();
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
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    
    channel.postMessage({
      type: 'session-end',
      timestamp: Date.now()
    });
    
    // Close the channel
    setTimeout(() => {
      channel.close();
    }, 1000);
  } catch (e) {
    console.error("Error cleaning up session:", e);
  }
};
