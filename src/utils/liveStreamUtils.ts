
import { cleanupWebRTC, initHostWebRTC, activeParticipants, setLocalStream, startScreenShare, stopScreenShare } from './webrtc';

/**
 * Initializes the host session for live streaming
 */
export const initializeHostSession = (sessionId: string, callbacks = {}) => {
  const {
    onParticipantJoin = () => {},
    onParticipantLeave = () => {},
    onParticipantHeartbeat = () => {}
  } = callbacks;

  console.log("Initializing host session:", sessionId);
  
  // Set up a BroadcastChannel to receive events from the transmission window
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  
  const handleChannelMessage = (event) => {
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

export { setLocalStream, startScreenShare, stopScreenShare };
