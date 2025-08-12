/**
 * FASE 1: WebRTC Message Protocol Adapter
 * 
 * Resolve incompatibilidade crítica entre protocolos:
 * - Novo: {to, sdp} (usado pelos handshake modules)
 * - Antigo: {roomId, targetUserId, offer} (esperado pelo backend)
 */

export interface LegacyWebRTCMessage {
  roomId: string;
  targetUserId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
  fromUserId: string;
}

export interface NewWebRTCMessage {
  to: string;
  sdp?: string;
  type?: string;
  candidate?: RTCIceCandidate;
  from?: string;
}

export class WebRTCMessageAdapter {
  private static currentRoomId: string | null = null;
  private static currentUserId: string | null = null;

  static setContext(roomId: string, userId: string) {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    console.log('🔧 ADAPTER: Context set:', { roomId, userId });
  }

  static convertOfferToLegacy(newMessage: NewWebRTCMessage): LegacyWebRTCMessage {
    if (!this.currentRoomId || !this.currentUserId) {
      throw new Error('WebRTC context not set. Call setContext() first.');
    }

    const legacy: LegacyWebRTCMessage = {
      roomId: this.currentRoomId,
      targetUserId: newMessage.to,
      fromUserId: this.currentUserId,
      offer: {
        type: newMessage.type as RTCSdpType,
        sdp: newMessage.sdp!
      }
    };

    console.log('🔄 ADAPTER: Offer conversion:', {
      from: { to: newMessage.to, type: newMessage.type },
      to: { roomId: legacy.roomId, targetUserId: legacy.targetUserId }
    });

    return legacy;
  }

  static convertAnswerToLegacy(newMessage: NewWebRTCMessage): LegacyWebRTCMessage {
    if (!this.currentRoomId || !this.currentUserId) {
      throw new Error('WebRTC context not set. Call setContext() first.');
    }

    const legacy: LegacyWebRTCMessage = {
      roomId: this.currentRoomId,
      targetUserId: newMessage.to,
      fromUserId: this.currentUserId,
      answer: {
        type: newMessage.type as RTCSdpType,
        sdp: newMessage.sdp!
      }
    };

    console.log('🔄 ADAPTER: Answer conversion:', {
      from: { to: newMessage.to, type: newMessage.type },
      to: { roomId: legacy.roomId, targetUserId: legacy.targetUserId }
    });

    return legacy;
  }

  static convertCandidateToLegacy(newMessage: NewWebRTCMessage): LegacyWebRTCMessage {
    if (!this.currentRoomId || !this.currentUserId) {
      throw new Error('WebRTC context not set. Call setContext() first.');
    }

    const legacy: LegacyWebRTCMessage = {
      roomId: this.currentRoomId,
      targetUserId: newMessage.to,
      fromUserId: this.currentUserId,
      candidate: newMessage.candidate!
    };

    console.log('🔄 ADAPTER: Candidate conversion:', {
      from: { to: newMessage.to, candidateType: /typ (\w+)/.exec(newMessage.candidate?.candidate || '')?.[1] },
      to: { roomId: legacy.roomId, targetUserId: legacy.targetUserId }
    });

    return legacy;
  }

  static convertLegacyToNew(legacyMessage: LegacyWebRTCMessage): NewWebRTCMessage {
    const newMessage: NewWebRTCMessage = {
      from: legacyMessage.fromUserId,
      to: legacyMessage.targetUserId
    };

    if (legacyMessage.offer) {
      newMessage.sdp = legacyMessage.offer.sdp;
      newMessage.type = legacyMessage.offer.type;
    } else if (legacyMessage.answer) {
      newMessage.sdp = legacyMessage.answer.sdp;
      newMessage.type = legacyMessage.answer.type;
    } else if (legacyMessage.candidate) {
      newMessage.candidate = legacyMessage.candidate;
    }

    console.log('🔄 ADAPTER: Legacy to new conversion:', {
      from: { roomId: legacyMessage.roomId, fromUserId: legacyMessage.fromUserId },
      to: { from: newMessage.from, hasOffer: !!newMessage.sdp }
    });

    return newMessage;
  }
}