
import { cleanupWebRTC, initHostWebRTC, activeParticipants, setLocalStream, startScreenShare, stopScreenShare, initParticipantWebRTC } from './webrtc';
import { addParticipantToSession } from './sessionUtils';

// Define the callback types
interface HostSessionCallbacks {
  onParticipantJoin?: (participantId: string) => void;
  onParticipantLeave?: (participantId: string) => void;
  onParticipantHeartbeat?: (participantId: string) => void;
}

/**
 * Initializes the host session for live streaming
 */
export const initializeHostSession = (sessionId: string, callbacks: HostSessionCallbacks = {}) => {
  const {
    onParticipantJoin = () => {},
    onParticipantLeave = () => {},
    onParticipantHeartbeat = () => {}
  } = callbacks;

  console.log("Initializing host session:", sessionId);
  
  // Set up a BroadcastChannel to receive events from the transmission window
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  
  const handleChannelMessage = (event: MessageEvent) => {
    const { type, id } = event.data;
    
    if (type === 'participant-join') {
      console.log('Participant joined via broadcast channel:', id);
      onParticipantJoin(id);
    }
    else if (type === 'participant-leave') {
      console.log('Participant left via broadcast channel:', id);
      onParticipantLeave(id);
    }
    else if (type === 'participant-heartbeat') {
      console.log('Participant heartbeat via broadcast channel:', id);
      onParticipantHeartbeat(id);
    }
  };
  
  channel.addEventListener('message', handleChannelMessage);
  
  // Start WebRTC connection as host
  try {
    initHostWebRTC(sessionId, (participantId, track) => {
      console.log(`Received track from participant ${participantId}:`, track.kind);
      onParticipantJoin(participantId);
    });
  } catch (err) {
    console.error("Error initializing WebRTC:", err);
  }
  
  // Set up interval to monitor active participants
  const intervalId = setInterval(() => {
    Object.keys(activeParticipants).forEach(participantId => {
      if (activeParticipants[participantId]) {
        onParticipantHeartbeat(participantId);
      }
    });
  }, 5000);
  
  return () => {
    clearInterval(intervalId);
    channel.removeEventListener('message', handleChannelMessage);
    channel.close();
    cleanupSession(sessionId);
  };
};

// Define the interface for participant session callbacks
interface ParticipantSessionCallbacks {
  onHostHeartbeat?: () => void;
  onHostDisconnect?: () => void;
}

/**
 * Initializes the participant session for live streaming
 */
export const initializeParticipantSession = (
  sessionId: string, 
  participantId: string, 
  participantName: string,
  callbacks: ParticipantSessionCallbacks = {}
) => {
  const {
    onHostHeartbeat = () => {},
    onHostDisconnect = () => {}
  } = callbacks;

  console.log("Initializing participant session:", sessionId, "for participant:", participantId);
  
  // Set up BroadcastChannel to communicate with host
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
  
  // Send join message
  const joinMessage = {
    type: 'participant-join',
    id: participantId,
    name: participantName,
    timestamp: Date.now()
  };
  
  channel.postMessage(joinMessage);
  backupChannel.postMessage(joinMessage);
  
  // Set up heartbeat interval
  const heartbeatInterval = setInterval(() => {
    const heartbeatMessage = {
      type: 'participant-heartbeat',
      id: participantId,
      timestamp: Date.now()
    };
    
    channel.postMessage(heartbeatMessage);
    backupChannel.postMessage(heartbeatMessage);
  }, 10000);
  
  // Listen for host messages
  const handleHostMessage = (event: MessageEvent) => {
    const { type } = event.data;
    
    if (type === 'host-heartbeat') {
      onHostHeartbeat();
    } else if (type === 'host-disconnect') {
      onHostDisconnect();
    }
  };
  
  channel.addEventListener('message', handleHostMessage);
  backupChannel.addEventListener('message', handleHostMessage);
  
  // Return cleanup function
  return () => {
    // Send leave message
    const leaveMessage = {
      type: 'participant-leave',
      id: participantId,
      timestamp: Date.now()
    };
    
    try {
      channel.postMessage(leaveMessage);
      backupChannel.postMessage(leaveMessage);
    } catch (e) {
      console.error("Error sending leave message:", e);
    }
    
    // Cleanup resources
    clearInterval(heartbeatInterval);
    channel.removeEventListener('message', handleHostMessage);
    backupChannel.removeEventListener('message', handleHostMessage);
    
    try {
      channel.close();
      backupChannel.close();
    } catch (e) {
      console.error("Error closing channels:", e);
    }
  };
};

/**
 * Clean up resources for a session
 */
export const cleanupSession = (sessionId: string) => {
  console.log("Cleaning up session:", sessionId);
  cleanupWebRTC();
  
  try {
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    channel.close();
  } catch (e) {
    console.error("Error closing broadcast channel:", e);
  }
};

export { setLocalStream, startScreenShare, stopScreenShare, initParticipantWebRTC };
