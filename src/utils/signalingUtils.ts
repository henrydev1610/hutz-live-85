/**
 * Signaling utilities for WebRTC communication
 * This file contains functions to handle signaling between WebRTC peers
 */

// Create a signaling channel for a specific session
export function createSignalingChannel(sessionId: string, participantId: string): BroadcastChannel {
  try {
    return new BroadcastChannel(`webrtc-signaling-${sessionId}-${participantId}`);
  } catch (error) {
    console.error('Error creating signaling channel:', error);
    throw error;
  }
}

// Send an ICE candidate through the signaling channel
export function sendICECandidate(
  channel: BroadcastChannel, 
  candidate: RTCIceCandidate, 
  participantId: string
): void {
  try {
    channel.postMessage({
      type: 'ice-candidate',
      participantId,
      candidate,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending ICE candidate:', error);
  }
}

// Send an SDP offer through the signaling channel
export function sendOffer(
  channel: BroadcastChannel, 
  offer: RTCSessionDescriptionInit, 
  participantId: string
): void {
  try {
    channel.postMessage({
      type: 'offer',
      participantId,
      offer,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending SDP offer:', error);
  }
}

// Send an SDP answer through the signaling channel
export function sendAnswer(
  channel: BroadcastChannel, 
  answer: RTCSessionDescriptionInit, 
  participantId: string
): void {
  try {
    channel.postMessage({
      type: 'answer',
      participantId,
      answer,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending SDP answer:', error);
  }
}

// Send a connection status update
export function sendConnectionStatus(
  channel: BroadcastChannel,
  participantId: string,
  status: 'connecting' | 'connected' | 'disconnected'
): void {
  try {
    channel.postMessage({
      type: 'connection-status',
      participantId,
      status,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending connection status:', error);
  }
}

// Send a heartbeat message to keep the connection alive
export function sendHeartbeat(channel: BroadcastChannel, participantId: string): void {
  try {
    channel.postMessage({
      type: 'heartbeat',
      participantId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error sending heartbeat:', error);
  }
}

// Request an ICE restart when the connection seems to be failing
export function requestICERestart(channel: BroadcastChannel, participantId: string): void {
  try {
    channel.postMessage({
      type: 'ice-restart-request',
      participantId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error requesting ICE restart:', error);
  }
}

// Setup periodic heartbeats to maintain connection awareness
export function setupHeartbeat(
  channel: BroadcastChannel, 
  participantId: string, 
  interval = 15000
): () => void {
  // Send initial heartbeat
  sendHeartbeat(channel, participantId);
  
  // Setup interval for regular heartbeats
  const heartbeatInterval = setInterval(() => {
    sendHeartbeat(channel, participantId);
  }, interval);
  
  // Return cleanup function
  return () => {
    clearInterval(heartbeatInterval);
  };
}

// Process incoming signaling messages
export function setupSignalingMessageHandler(
  channel: BroadcastChannel,
  participantId: string,
  handlers: {
    onIceCandidate?: (candidate: RTCIceCandidate) => void;
    onOffer?: (offer: RTCSessionDescriptionInit) => void;
    onAnswer?: (answer: RTCSessionDescriptionInit) => void;
    onICERestartRequest?: () => void;
    onConnectionStatus?: (status: 'connecting' | 'connected' | 'disconnected') => void;
    onHeartbeat?: () => void;
  }
): () => void {
  const messageHandler = (event: MessageEvent) => {
    const { type, participantId: senderId, timestamp } = event.data;
    
    // Ignore old messages (more than 30 seconds old)
    if (timestamp && Date.now() - timestamp > 30000) {
      return;
    }
    
    // Handle different message types
    switch (type) {
      case 'ice-candidate':
        if (event.data.candidate && handlers.onIceCandidate) {
          handlers.onIceCandidate(event.data.candidate);
        }
        break;
        
      case 'offer':
        if (event.data.offer && handlers.onOffer) {
          handlers.onOffer(event.data.offer);
        }
        break;
        
      case 'answer':
        if (event.data.answer && handlers.onAnswer) {
          handlers.onAnswer(event.data.answer);
        }
        break;
        
      case 'ice-restart-request':
        if (handlers.onICERestartRequest) {
          handlers.onICERestartRequest();
        }
        break;
        
      case 'connection-status':
        if (event.data.status && handlers.onConnectionStatus) {
          handlers.onConnectionStatus(event.data.status);
        }
        break;
        
      case 'heartbeat':
        if (handlers.onHeartbeat) {
          handlers.onHeartbeat();
        }
        // Always respond to heartbeats
        sendHeartbeat(channel, participantId);
        break;
    }
  };
  
  channel.addEventListener('message', messageHandler);
  
  // Return cleanup function
  return () => {
    channel.removeEventListener('message', messageHandler);
  };
}
