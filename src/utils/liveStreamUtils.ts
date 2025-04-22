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
  const backupChannel = new BroadcastChannel(`live-session-${sessionId}-backup`);
  
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
      localStorage.setItem(`live-heartbeat-${sessionId}`, Date.now().toString());
    } catch (e) {
      console.warn("Error updating localStorage heartbeat:", e);
    }
  }, 5000);
  
  // Handle session join via localStorage fallback
  const checkLocalStorageFallback = setInterval(() => {
    try {
      // Check for join requests in localStorage
      const joinKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`live-join-${sessionId}`) || 
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
              localStorage.setItem(`live-ack-${sessionId}-${joinData.id}`, JSON.stringify({
                type: 'host-acknowledge',
                participantId: joinData.id,
                timestamp: Date.now()
              }));
              
              // Add participant to session storage
              addParticipantToSession(sessionId, joinData.id, joinData.name || '');
              
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
      
      // Also check for video stream info in localStorage
      try {
        const streamInfoKeys = Object.keys(localStorage).filter(key => 
          key.startsWith(`live-stream-info-${sessionId}`)
        );
        
        streamInfoKeys.forEach(key => {
          try {
            const streamInfoStr = localStorage.getItem(key);
            if (streamInfoStr) {
              const streamInfo = JSON.parse(streamInfoStr);
              if (streamInfo && streamInfo.id && streamInfo.type === 'video-stream-info') {
                console.log('Found stream info via localStorage:', streamInfo.id);
                
                // Update participant status with video info
                updateParticipantStatus(sessionId, streamInfo.id, { 
                  active: true,
                  lastActive: Date.now(),
                  hasVideo: streamInfo.hasStream && streamInfo.videoTracks && streamInfo.videoTracks.length > 0
                });
                
                // Acknowledge the stream info
                localStorage.setItem(`live-stream-ack-${sessionId}-${streamInfo.id}`, JSON.stringify({
                  type: 'host-stream-acknowledge',
                  participantId: streamInfo.id,
                  timestamp: Date.now()
                }));
              }
            }
            
            // Don't remove the stream info as it should persist
          } catch (e) {
            console.warn("Error processing localStorage stream info:", e);
          }
        });
      } catch (e) {
        console.warn("Error checking localStorage stream info:", e);
      }
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
      addParticipantToSession(sessionId, data.id, data.name || '');
      
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
        localStorage.setItem(`live-ack-${sessionId}-${data.id}`, JSON.stringify({
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
    // Handle video stream data for participants
    else if (data.type === 'video-stream-info') {
      console.log('Received video stream info from participant:', data.id);
      
      // Update participant with video information
      updateParticipantStatus(sessionId, data.id, { 
        active: true,
        lastActive: Date.now(),
        hasVideo: data.hasStream && data.videoTracks && data.videoTracks.length > 0
      });
      
      // Forward this information to all channels to ensure all components are updated
      channel.postMessage(data);
      backupChannel.postMessage(data);
    }
  };
  
  // Listen for backup channel messages
  backupChannel.onmessage = (event) => {
    const { data } = event;
    
    if (data.type === 'participant-join') {
      console.log('Participant joined via backup channel:', data.id);
      
      // Add participant to session storage
      addParticipantToSession(sessionId, data.id, data.name || '');
      
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
        localStorage.setItem(`live-ack-${sessionId}-${data.id}`, JSON.stringify({
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
    // Handle video stream data for participants
    else if (data.type === 'video-stream-info') {
      console.log('Received video stream info from participant (backup):', data.id);
      
      // Update participant with video information
      updateParticipantStatus(sessionId, data.id, { 
        active: true,
        lastActive: Date.now(),
        hasVideo: data.hasStream && data.videoTracks && data.videoTracks.length > 0
      });
      
      // Forward this information to all channels to ensure all components are updated
      backupChannel.postMessage(data);
      channel.postMessage(data);
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
export const initializeParticipantSession = (sessionId: string, participantId: string, participantName: string, autoSelect: boolean = false) => {
  console.log(`Initializing participant session: ${sessionId}, ${participantId}, autoSelect: ${autoSelect}`);
  
  // Set up broadcast channel for this session
  const channel = new BroadcastChannel(`live-session-${sessionId}`);
  
  // Also set up a backup channel for reliability
  const backupChannel = new BroadcastChannel(`live-session-${sessionId}-backup`);
  
  // Use localStorage as well for maximum reliability
  try {
    localStorage.setItem(`live-join-${sessionId}-${Date.now()}`, JSON.stringify({
      type: 'participant-join',
      id: participantId,
      name: participantName,
      autoSelect,
      timestamp: Date.now(),
      connectionTime: Date.now()
    }));
  } catch (e) {
    console.warn("Error using localStorage join:", e);
  }
  
  // Send join message on primary channel
  channel.postMessage({
    type: 'participant-join',
    id: participantId,
    name: participantName,
    autoSelect,
    timestamp: Date.now(),
    connectionTime: Date.now()
  });
  
  // Send join message on backup channel too
  backupChannel.postMessage({
    type: 'participant-join',
    id: participantId,
    name: participantName,
    autoSelect,
    timestamp: Date.now(),
    connectionTime: Date.now()
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
  
  // Set up function to send video stream info
  const sendVideoStreamInfo = (stream: MediaStream | null) => {
    if (!stream) return;
    
    const videoTrackInfo = stream.getVideoTracks().map(track => ({
      id: track.id,
      enabled: track.enabled,
      readyState: track.readyState,
      kind: track.kind,
      label: track.label
    }));
    
    const streamInfo = {
      type: 'video-stream-info',
      id: participantId,
      timestamp: Date.now(),
      hasStream: stream.getVideoTracks().length > 0 && stream.getVideoTracks().some(track => track.enabled && track.readyState === 'live'),
      videoTracks: videoTrackInfo,
      audioTrackCount: stream.getAudioTracks().length
    };
    
    console.log('Sending video stream info:', streamInfo);
    
    // Send on both channels
    channel.postMessage(streamInfo);
    backupChannel.postMessage(streamInfo);
    
    // Also store in localStorage for maximum reliability
    try {
      localStorage.setItem(`live-stream-info-${sessionId}-${participantId}`, JSON.stringify(streamInfo));
    } catch (e) {
      console.warn("Error storing stream info in localStorage:", e);
    }
  };
  
  // Function to handle when user media is obtained
  const handleUserMedia = (stream: MediaStream) => {
    console.log('Got user media stream with tracks:', 
      stream.getTracks().map(t => `${t.kind}:${t.label} (${t.readyState})`));
    
    // Send initial stream info
    sendVideoStreamInfo(stream);
    
    // Set up periodic stream info updates - using a lower frequency to avoid flickering
    const streamInfoInterval = setInterval(() => {
      sendVideoStreamInfo(stream);
    }, 10000); // Reduced frequency to 10 seconds to avoid flickering
    
    // Clean up interval when window unloads
    window.addEventListener('beforeunload', () => {
      clearInterval(streamInfoInterval);
    });
    
    // Return cleanup function
    return () => {
      clearInterval(streamInfoInterval);
    };
  };
  
  // Try to get user media for video and send stream info
  // Using a more stable approach that reduces flickering
  const initializeCamera = async () => {
    try {
      // Try first with ideal settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: true 
      });
      
      // Wait a short moment to stabilize camera initialization
      setTimeout(() => {
        const cleanup = handleUserMedia(stream);
        
        // Save the cleanup function for later
        window.addEventListener('beforeunload', cleanup);
      }, 1000);
    } catch (err) {
      console.error('Error getting high-quality media:', err);
      
      // Try with just video as fallback, with minimal constraints to reduce flickering
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: true
        });
        
        // Wait a short moment to stabilize camera initialization
        setTimeout(() => {
          const cleanup = handleUserMedia(fallbackStream);
          
          // Save the cleanup function for later
          window.addEventListener('beforeunload', cleanup);
        }, 1000);
      } catch (videoErr) {
        console.error('Error getting video-only media:', videoErr);
      }
    }
  };
  
  // Delay initializing camera until after connection is established
  // This helps reduce flickering by not starting the camera until we're sure we need it
  let cameraInitTimeout: NodeJS.Timeout | null = null;
  
  // Listen for acknowledgment
  const channelMessageHandler = (event: MessageEvent) => {
    const { data } = event;
    if (data.type === 'host-acknowledge' && data.participantId === participantId) {
      console.log("Join acknowledged by host");
      acknowledgedJoin = true;
      clearJoinInterval();
      
      // Start camera after a short delay to ensure the connection is stable
      if (cameraInitTimeout) {
        clearTimeout(cameraInitTimeout);
      }
      
      cameraInitTimeout = setTimeout(() => {
        initializeCamera();
      }, 500) as unknown as NodeJS.Timeout;
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
      const ackKey = `live-ack-${sessionId}-${participantId}`;
      const ackData = localStorage.getItem(ackKey);
      if (ackData) {
        try {
          console.log("Found acknowledgement via localStorage");
          localStorage.removeItem(ackKey);
          acknowledgedJoin = true;
          clearJoinInterval();
          
          // Start camera after acknowledgment
          if (cameraInitTimeout) {
            clearTimeout(cameraInitTimeout);
          }
          
          cameraInitTimeout = setTimeout(() => {
            initializeCamera();
          }, 500) as unknown as NodeJS.Timeout;
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
        name: participantName,
        autoSelect,
        timestamp: Date.now(),
        connectionTime: Date.now()
      });
      
      // Send via backup channel
      backupChannel.postMessage({
        type: 'participant-join',
        id: participantId,
        name: participantName,
        autoSelect,
        timestamp: Date.now(),
        connectionTime: Date.now()
      });
      
      // Also try localStorage
      try {
        localStorage.setItem(`live-join-${sessionId}-${Date.now()}`, JSON.stringify({
          type: 'participant-join',
          id: participantId,
          name: participantName,
          autoSelect,
          timestamp: Date.now(),
          connectionTime: Date.now()
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
      localStorage.setItem(`live-heartbeat-${sessionId}-${participantId}`, Date.now().toString());
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
      localStorage.setItem(`live-leave-${sessionId}-${participantId}`, JSON.stringify({
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
    
    if (cameraInitTimeout) {
      clearTimeout(cameraInitTimeout);
    }
    
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
    const backupChannel = new BroadcastChannel(`live-session-${sessionId}-backup`);
    
    const endMessage = {
      type: 'session-end',
      timestamp: Date.now()
    };
    
    primaryChannel.postMessage(endMessage);
    backupChannel.postMessage(endMessage);
    
    // Also set session end in localStorage
    try {
      localStorage.setItem(`live-session-end-${sessionId}`, Date.now().toString());
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
