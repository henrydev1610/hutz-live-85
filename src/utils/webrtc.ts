import { io, Socket } from 'socket.io-client';
import { addParticipantToSession, updateParticipantStatus } from './sessionUtils';

const PEER_CONNECTION_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

let socket: Socket | null = null;
let activePeerConnections: { [participantId: string]: RTCPeerConnection } = {};
let activeParticipants: { [participantId: string]: boolean } = {};
let signalingSessions: { [sessionId: string]: boolean } = {};
let currentSessionId: string | null = null;
let localStream: MediaStream | null = null;
let onParticipantTrackCallback: ((participantId: string, track: MediaStreamTrack) => void) | null = null;

/**
 * Initializes the socket connection
 */
const initSocket = (sessionId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected && currentSessionId === sessionId) {
      console.log('Socket already initialized for this session.');
      resolve();
      return;
    }

    socket = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL as string);

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
      currentSessionId = sessionId;
      socket?.emit('joinSession', sessionId);
      resolve();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  });
};

/**
 * Initializes the WebRTC connection for the host
 */
export const initHostWebRTC = async (
  sessionId: string,
  onTrack: (participantId: string, track: MediaStreamTrack) => void
): Promise<void> => {
  onParticipantTrackCallback = onTrack;

  if (!localStream) {
    throw new Error('Local stream is not available. Call setLocalStream first.');
  }

  await initSocket(sessionId);

  socket?.on('userJoined', async (participantId: string) => {
    console.log(`User joined: ${participantId}`);
    activeParticipants[participantId] = true;
    createPeerConnection(participantId, true);
  });

  socket?.on('offer', async (participantId: string, description: RTCSessionDescription) => {
    console.log(`Received offer from: ${participantId}`);
    try {
      if (!activePeerConnections[participantId]) {
        createPeerConnection(participantId, false);
      }
      await activePeerConnections[participantId].setRemoteDescription(description);
      const answer = await activePeerConnections[participantId].createAnswer();
      await activePeerConnections[participantId].setLocalDescription(answer);
      socket?.emit('answer', participantId, activePeerConnections[participantId].localDescription);
    } catch (e) {
      console.error('Error handling offer:', e);
    }
  });

  socket?.on('candidate', async (participantId: string, candidate: RTCIceCandidate) => {
    console.log(`Received candidate from: ${participantId}`);
    try {
      if (candidate) {
        await activePeerConnections[participantId].addIceCandidate(candidate);
      }
    } catch (e) {
      console.error('Error handling candidate:', e);
    }
  });

  socket?.on('userLeft', (participantId: string) => {
    console.log(`User ${participantId} left`);
    closePeerConnection(participantId);
  });

  const createPeerConnection = async (participantId: string, isInitiator: boolean) => {
    console.log(`Creating peer connection for ${participantId}, isInitiator: ${isInitiator}`);
    activePeerConnections[participantId] = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

    activePeerConnections[participantId].onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('candidate', participantId, event.candidate);
      }
    };

    activePeerConnections[participantId].oniceconnectionstatechange = () => {
      console.log(`ICE Connection State Change for ${participantId}:`, activePeerConnections[participantId].iceConnectionState);
      if (activePeerConnections[participantId].iceConnectionState === 'disconnected') {
        closePeerConnection(participantId);
      }
    };

    activePeerConnections[participantId].ontrack = (event: RTCTrackEvent) => {
      console.log(`Received track for participant ${participantId}`);
      if (onParticipantTrackCallback) {
        onParticipantTrackCallback(participantId, event.track);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        activePeerConnections[participantId].addTrack(track, localStream!);
      });
    }

    if (isInitiator) {
      try {
        const offer = await activePeerConnections[participantId].createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: true
        });
        await activePeerConnections[participantId].setLocalDescription(offer);
        socket?.emit('offer', participantId, activePeerConnections[participantId].localDescription);
      } catch (e) {
        console.error('Error creating offer:', e);
      }
    }
  };

  const closePeerConnection = (participantId: string) => {
    console.log(`Closing peer connection for ${participantId}`);
    if (activePeerConnections[participantId]) {
      activePeerConnections[participantId].close();
      delete activePeerConnections[participantId];
    }
    delete activeParticipants[participantId];
  };

  signalingSessions[sessionId] = true;
};

/**
 * Initializes the WebRTC connection for a participant
 */
export const initParticipantWebRTC = async (
  sessionId: string,
  participantId: string,
  stream: MediaStream
): Promise<void> => {
  localStream = stream;

  await initSocket(sessionId);

  socket?.on('answer', async (hostId: string, description: RTCSessionDescription) => {
    console.log(`Received answer from host: ${hostId}`);
    try {
      await activePeerConnections[hostId].setRemoteDescription(description);
    } catch (e) {
      console.error('Error handling answer:', e);
    }
  });

  socket?.on('candidate', async (hostId: string, candidate: RTCIceCandidate) => {
    console.log(`Received candidate from host: ${hostId}`);
    try {
      if (candidate) {
        await activePeerConnections[hostId].addIceCandidate(candidate);
      }
    } catch (e) {
      console.error('Error handling candidate:', e);
    }
  });

  createPeerConnection(sessionId, participantId);
};

const createPeerConnection = async (sessionId: string, participantId: string) => {
  console.log(`Creating peer connection for participant ${participantId} to session ${sessionId}`);
  activePeerConnections[sessionId] = new RTCPeerConnection(PEER_CONNECTION_CONFIG);

  activePeerConnections[sessionId].onicecandidate = (event) => {
    if (event.candidate) {
      socket?.emit('candidate', sessionId, event.candidate);
    }
  };

  activePeerConnections[sessionId].oniceconnectionstatechange = () => {
    console.log(`ICE Connection State Change for Host:`, activePeerConnections[sessionId].iceConnectionState);
    if (activePeerConnections[sessionId].iceConnectionState === 'disconnected') {
      closePeerConnection(sessionId);
    }
  };

  if (localStream) {
    localStream.getTracks().forEach(track => {
      activePeerConnections[sessionId].addTrack(track, localStream!);
    });
  }

  try {
    const offer = await activePeerConnections[sessionId].createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: true
    });
    await activePeerConnections[sessionId].setLocalDescription(offer);
    socket?.emit('offer', sessionId, activePeerConnections[sessionId].localDescription);
  } catch (e) {
    console.error('Error creating offer:', e);
  }
};

/**
 * Sets the local stream
 */
export const setLocalStream = (stream: MediaStream): void => {
  localStream = stream;
};

/**
 * Ends the WebRTC session
 */
export const endWebRTC = (sessionId: string): void => {
  console.log(`Ending WebRTC session: ${sessionId}`);

  if (signalingSessions[sessionId]) {
    Object.keys(activePeerConnections).forEach(participantId => {
      closePeerConnection(participantId);
    });

    socket?.emit('leaveSession', sessionId);
    delete signalingSessions[sessionId];
  }
};

const closePeerConnection = (participantId: string) => {
  console.log(`Closing peer connection for ${participantId}`);
  if (activePeerConnections[participantId]) {
    activePeerConnections[participantId].close();
    delete activePeerConnections[participantId];
  }
  delete activeParticipants[participantId];
};

/**
 * Cleans up WebRTC connections for a specific participant or all participants
 * @param participantId Optional participant ID to clean up only that connection
 */
export const cleanupWebRTC = (participantId?: string): void => {
  // If participantId is provided, only clean up that specific connection
  if (participantId && activePeerConnections[participantId]) {
    console.log(`Cleaning up WebRTC connection for participant ${participantId}`);
    
    try {
      // Close the specific peer connection
      activePeerConnections[participantId].close();
      delete activePeerConnections[participantId];
      
      // Remove the participant from active participants
      if (activeParticipants[participantId]) {
        delete activeParticipants[participantId];
      }
    } catch (error) {
      console.error(`Error cleaning up WebRTC connection for ${participantId}:`, error);
    }
  } 
  // If no participantId is provided, clean up all connections
  else if (!participantId) {
    console.log('Cleaning up all WebRTC connections');
    
    // Close all peer connections
    Object.keys(activePeerConnections).forEach(id => {
      try {
        activePeerConnections[id].close();
      } catch (error) {
        console.error(`Error closing peer connection for ${id}:`, error);
      }
    });
    
    // Reset all state variables
    activePeerConnections = {};
    activeParticipants = {};
    signalingSessions = {};
    currentSessionId = null;
    localStream = null;
    onParticipantTrackCallback = null;
  }
};
