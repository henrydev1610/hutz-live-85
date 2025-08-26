/**
 * FASE 3: ICE Candidate Buffering System
 * 
 * Manages ICE candidates to ensure they're only sent/applied
 * at the appropriate time in the WebRTC signaling sequence.
 */

export interface BufferedCandidate {
  candidate: RTCIceCandidate;
  timestamp: number;
  fromParticipant: string;
  toParticipant: string;
}

export class ICECandidateBuffer {
  private participantBuffer: BufferedCandidate[] = [];
  private hostBuffer: Map<string, BufferedCandidate[]> = new Map();
  private isParticipantAnswerReceived: boolean = false;
  private hostRemoteDescriptions: Set<string> = new Set();

  // PARTICIPANT-SIDE: Buffer ICE until answer received
  bufferParticipantICE(candidate: RTCIceCandidate, toHost: string): void {
    const buffered: BufferedCandidate = {
      candidate,
      timestamp: Date.now(),
      fromParticipant: 'participant',
      toParticipant: toHost
    };

    this.participantBuffer.push(buffered);
    console.log(`📦 ICE-BUFFER: Participant buffered ICE candidate (total: ${this.participantBuffer.length})`);
  }

  // PARTICIPANT-SIDE: Mark answer received and flush buffered ICE
  markParticipantAnswerReceived(): BufferedCandidate[] {
    this.isParticipantAnswerReceived = true;
    const candidates = [...this.participantBuffer];
    this.participantBuffer = [];
    
    console.log(`🚀 ICE-BUFFER: Flushing ${candidates.length} buffered participant ICE candidates`);
    return candidates;
  }

  // PARTICIPANT-SIDE: Check if we should send ICE immediately
  shouldSendParticipantICE(): boolean {
    return this.isParticipantAnswerReceived;
  }

  // HOST-SIDE: Buffer ICE until peer connection ready
  bufferHostICE(candidate: RTCIceCandidate, fromParticipant: string): void {
    if (!this.hostBuffer.has(fromParticipant)) {
      this.hostBuffer.set(fromParticipant, []);
    }

    const buffered: BufferedCandidate = {
      candidate,
      timestamp: Date.now(),
      fromParticipant,
      toParticipant: 'host'
    };

    this.hostBuffer.get(fromParticipant)!.push(buffered);
    console.log(`📦 ICE-BUFFER: Host buffered ICE from ${fromParticipant} (total: ${this.hostBuffer.get(fromParticipant)!.length})`);
  }

  // HOST-SIDE: Mark remote description set and flush buffered ICE
  markHostRemoteDescriptionSet(participantId: string): BufferedCandidate[] {
    this.hostRemoteDescriptions.add(participantId);
    
    const candidates = this.hostBuffer.get(participantId) || [];
    this.hostBuffer.set(participantId, []);
    
    console.log(`🚀 ICE-BUFFER: Flushing ${candidates.length} buffered host ICE candidates for ${participantId}`);
    return candidates;
  }

  // HOST-SIDE: Check if we should apply ICE immediately
  shouldApplyHostICE(participantId: string): boolean {
    return this.hostRemoteDescriptions.has(participantId);
  }

  // Clean up for specific participant
  cleanup(participantId: string): void {
    this.hostBuffer.delete(participantId);
    this.hostRemoteDescriptions.delete(participantId);
    
    if (participantId === 'participant') {
      this.participantBuffer = [];
      this.isParticipantAnswerReceived = false;
    }
    
    console.log(`🧹 ICE-BUFFER: Cleaned up buffers for ${participantId}`);
  }

  // Get buffer status for debugging
  getBufferStatus(): {
    participantBuffered: number;
    participantAnswerReceived: boolean;
    hostBuffered: Map<string, number>;
    hostReadyConnections: string[];
  } {
    const hostBuffered = new Map<string, number>();
    this.hostBuffer.forEach((candidates, participantId) => {
      hostBuffered.set(participantId, candidates.length);
    });

    return {
      participantBuffered: this.participantBuffer.length,
      participantAnswerReceived: this.isParticipantAnswerReceived,
      hostBuffered,
      hostReadyConnections: Array.from(this.hostRemoteDescriptions)
    };
  }
}

// Global instance for participant and host use
export const iceBuffer = new ICECandidateBuffer();