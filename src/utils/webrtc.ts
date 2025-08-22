// Minimal stub for backwards compatibility - DEPRECATED, use Twilio Video Rooms
export const setupParticipantWebRTC = async (sessionId: string, participantId: string, stream: MediaStream) => {
  console.log('⚠️ DEPRECATED: Use Twilio Video Rooms instead');
  return { webrtc: null };
};

export const initParticipantWebRTC = async (sessionId: string, participantId: string, stream: MediaStream) => {
  console.log('⚠️ DEPRECATED: Use Twilio Video Rooms instead');  
  return { webrtc: null };
};

export const initHostWebRTC = () => {
  console.log('⚠️ DEPRECATED: Use Twilio Video Rooms instead');
  return null;
};

export const getWebRTCManager = () => null;
export const cleanupWebRTC = () => {};
export const endWebRTC = () => {};
export const isWebRTCConnected = () => false;
export const hasLocalStream = () => false;
export const getLocalStream = () => null;
export const setLocalStream = () => {};
export const getWebRTCManagerInstance = () => null;