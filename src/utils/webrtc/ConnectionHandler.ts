// Complete stub for backwards compatibility - DEPRECATED
export class ConnectionHandler {
  constructor() {}
  
  async createPeerConnection(participantId: string) {
    console.log('⚠️ DEPRECATED: createPeerConnection - Use Twilio Video Rooms instead');
    return null;
  }
  
  setStreamCallback(callback: any) {}
  setParticipantJoinCallback(callback: any) {}
  closePeerConnection(userId: string) {}
}