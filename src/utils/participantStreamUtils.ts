
/**
 * Utility functions for handling participant streams
 */

// Function to connect to a participant stream via broadcast channels
export const requestParticipantStream = (sessionId: string, participantId: string) => {
  if (!sessionId) return;
  
  try {
    // Create a broadcast channel
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    
    // Send a direct request for this participant's stream
    channel.postMessage({
      type: 'request-stream',
      target: participantId,
      requestId: Date.now(),
    });
    
    // Close the channel after sending
    setTimeout(() => channel.close(), 100);
  } catch (e) {
    console.error("Error requesting participant stream:", e);
  }
};

// Function to broadcast a stream is available
export const broadcastStreamAvailable = (sessionId: string, participantId: string) => {
  if (!sessionId) return;
  
  try {
    // Create broadcast channels (use multiple for redundancy)
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
    
    // Send a message that this participant has a stream
    const message = {
      type: 'stream-available',
      participantId,
      timestamp: Date.now(),
    };
    
    channel.postMessage(message);
    backupChannel.postMessage(message);
    
    // Close the channels after sending
    setTimeout(() => {
      channel.close();
      backupChannel.close();
    }, 100);
  } catch (e) {
    console.error("Error broadcasting stream availability:", e);
  }
};

// Set up listener for stream requests
export const listenForStreamRequests = (
  sessionId: string, 
  participantId: string, 
  onRequestReceived: () => void
) => {
  if (!sessionId) return () => {};
  
  try {
    const channel = new BroadcastChannel(`live-session-${sessionId}`);
    
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;
      
      // Check if this is a request for all streams or specifically for this participant
      if (
        (data.type === 'request-participant-streams') || 
        (data.type === 'request-stream' && data.target === participantId)
      ) {
        console.log("Received stream request, responding...");
        onRequestReceived();
      }
    };
    
    channel.addEventListener('message', handleMessage);
    
    // Return cleanup function
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  } catch (e) {
    console.error("Error setting up stream request listener:", e);
    return () => {};
  }
};

// Send regular heartbeats to indicate participant is still connected
export const startParticipantHeartbeat = (sessionId: string, participantId: string) => {
  if (!sessionId) return () => {};
  
  const intervalId = setInterval(() => {
    try {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'participant-heartbeat',
        participantId,
        timestamp: Date.now(),
      });
      setTimeout(() => channel.close(), 100);
    } catch (e) {
      console.error("Error sending heartbeat:", e);
    }
  }, 2000);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};
