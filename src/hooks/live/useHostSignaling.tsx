// src/hooks/live/useHostSignaling.ts
import { useEffect } from 'react';
import UnifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { handleOfferFromParticipant, handleRemoteCandidate } from '@/webrtc/handshake/HostHandshake';

type Opts = {
  sessionId: string | null;
  onRemoteTrack: (id: string, stream: MediaStream) => void;
};

export function useHostSignaling({ sessionId, onRemoteTrack }: Opts) {
  useEffect(() => {
    if (!sessionId) return;

    const offOffer = UnifiedWebSocketService.on('webrtc-offer', (msg: any) => {
      // msg esperado: { roomId, fromUserId, offer: {sdp, type}, ... }
      if (!msg?.fromUserId || !msg?.offer) return;
      handleOfferFromParticipant({ fromUserId: msg.fromUserId, offer: msg.offer }, onRemoteTrack);
    });

    const offCand = UnifiedWebSocketService.on('webrtc-candidate', (msg: any) => {
      // msg esperado: { fromUserId, candidate }
      if (!msg?.fromUserId || !msg?.candidate) return;
      handleRemoteCandidate({ fromUserId: msg.fromUserId, candidate: msg.candidate });
    });

    return () => {
      offOffer?.();
      offCand?.();
    };
  }, [sessionId, onRemoteTrack]);
}
