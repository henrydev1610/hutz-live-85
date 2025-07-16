
import { initParticipantWebRTC as initParticipantWebRTCCore, initHostWebRTC, cleanupWebRTC } from './webrtc';

// Global state for WebRTC
let currentWebRTC: any = null;
let currentLocalStream: MediaStream | null = null;

// Initialize participant WebRTC with better error handling
export const setupParticipantWebRTC = async (
  sessionId: string, 
  participantId: string, 
  stream: MediaStream
): Promise<void> => {
  try {
    console.log('🔗 Setting up participant WebRTC...', {
      sessionId,
      participantId,
      streamTracks: stream.getTracks().length
    });
    
    // Store the local stream globally
    currentLocalStream = stream;
    
    // Try to initialize WebRTC connection with the stream
    try {
      const result = await initParticipantWebRTCCore(sessionId, participantId, stream);
      if (result && result.webrtc) {
        currentWebRTC = result.webrtc;
        console.log('✅ WebRTC connection established successfully');
      } else {
        console.log('⚠️ WebRTC returned unexpected result, working in local mode');
      }
    } catch (webrtcError) {
      console.warn('⚠️ WebRTC connection failed, but stream is available for local preview:', webrtcError);
      // Don't throw - we can still use the stream locally
    }
    
    console.log('✅ Participant setup completed (stream available)');
  } catch (error) {
    console.error('❌ Error in setupParticipantWebRTC:', error);
    // Don't throw error if we have a stream - local preview should still work
    if (stream && stream.getTracks().length > 0) {
      console.log('⚠️ Continuing with local stream only');
      currentLocalStream = stream;
    } else {
      throw error;
    }
  }
};

// Set local stream with better logging
export const setLocalStream = (stream: MediaStream) => {
  console.log('📹 Setting local stream:', {
    streamId: stream.id,
    tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
  });
  
  currentLocalStream = stream;
  
  // Update video element if it exists
  const videoElement = document.querySelector('video') as HTMLVideoElement;
  if (videoElement && videoElement.srcObject !== stream) {
    console.log('📹 Updating video element with new stream');
    videoElement.srcObject = stream;
    
    // Ensure video plays
    videoElement.play().catch(err => {
      console.warn('⚠️ Video play warning:', err);
    });
  }
};

// Get local stream
export const getLocalStream = (): MediaStream | null => {
  return currentLocalStream;
};

// End WebRTC session with proper cleanup
export const endWebRTC = () => {
  console.log('🛑 Ending WebRTC session');
  
  // Stop all tracks in current stream
  if (currentLocalStream) {
    currentLocalStream.getTracks().forEach(track => {
      track.stop();
      console.log(`Stopped track: ${track.kind} (${track.id})`);
    });
    currentLocalStream = null;
  }
  
  // Cleanup WebRTC manager
  if (currentWebRTC) {
    try {
      cleanupWebRTC();
      currentWebRTC = null;
      console.log('✅ WebRTC cleanup completed');
    } catch (error) {
      console.error('❌ Error during WebRTC cleanup:', error);
    }
  }
};

// Check if WebRTC is connected
export const isWebRTCConnected = (): boolean => {
  return currentWebRTC !== null;
};

// Check if local stream is available
export const hasLocalStream = (): boolean => {
  return currentLocalStream !== null && currentLocalStream.getTracks().length > 0;
};
