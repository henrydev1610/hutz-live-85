
import { initParticipantWebRTC as initParticipantWebRTCCore, initHostWebRTC, cleanupWebRTC } from './webrtc';

// Global state for WebRTC
let currentWebRTC: any = null;
let currentLocalStream: MediaStream | null = null;

// Initialize participant WebRTC
export const initializeParticipantWebRTC = async (
  sessionId: string, 
  participantId: string, 
  stream: MediaStream
): Promise<void> => {
  try {
    console.log('Initializing participant WebRTC with stream:', stream);
    
    // Store the local stream globally
    currentLocalStream = stream;
    
    // Initialize WebRTC connection
    const result = await initParticipantWebRTCCore(sessionId);
    currentWebRTC = result.webrtc;
    
    console.log('✅ Participant WebRTC initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing participant WebRTC:', error);
    throw error;
  }
};

// Set local stream
export const setLocalStream = (stream: MediaStream) => {
  console.log('Setting local stream:', stream);
  currentLocalStream = stream;
  
  // Update video element if it exists
  const videoElement = document.querySelector('video') as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
};

// Get local stream
export const getLocalStream = (): MediaStream | null => {
  return currentLocalStream;
};

// End WebRTC session
export const endWebRTC = () => {
  console.log('Ending WebRTC session');
  
  // Stop all tracks in current stream
  if (currentLocalStream) {
    currentLocalStream.getTracks().forEach(track => {
      track.stop();
      console.log(`Stopped track: ${track.kind}`);
    });
    currentLocalStream = null;
  }
  
  // Cleanup WebRTC manager
  if (currentWebRTC) {
    cleanupWebRTC();
    currentWebRTC = null;
  }
};

// Check if WebRTC is connected
export const isWebRTCConnected = (): boolean => {
  return currentWebRTC !== null;
};
