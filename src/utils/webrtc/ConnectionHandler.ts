import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getActiveWebRTCConfig } from '@/utils/webrtc/WebRTCConfig';
import { detectRestrictiveNetwork, prioritizeIceServers } from './ConnectionHandlerMethods';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
  }

  async initiateHandshake(participantId: string): Promise<void> {
    console.log(`🤝 [WRTC] Initiating handshake: ${participantId}`);
    const peerConnection = this.createPeerConnection(participantId);
    await this.initiateCall(participantId);
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 [WRTC] Creating peer connection: ${participantId}`);

    const config = getActiveWebRTCConfig();
    if (detectRestrictiveNetwork()) {
      config.iceTransportPolicy = 'relay';
    }
    if (config.iceServers) {
      config.iceServers = prioritizeIceServers(config.iceServers);
    }

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, pc);

    // ✅ ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };

    // ✅ connection states
    pc.onconnectionstatechange = () => {
      console.log(`🔗 [WRTC] Connection state ${participantId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected' && this.participantJoinCallback) {
        this.participantJoinCallback(participantId);
      }
    };

    // ✅ ICE state
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 [WRTC] ICE state ${participantId}: ${pc.iceConnectionState}`);
    };

    // ✅ ontrack + fallback
    let onTrackReceived = false;
    const onTrackTimeout = setTimeout(async () => {
      if (!onTrackReceived) {
        console.error(`❌ [WRTC] CRÍTICO: ontrack nunca disparou para ${participantId}`);
        const stats = await pc.getStats();
        let framesDecoded = 0;
        let packetsReceived = 0;
        stats.forEach((r) => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            framesDecoded += r.framesDecoded || 0;
            packetsReceived += r.packetsReceived || 0;
          }
        });
        if (framesDecoded > 0 || packetsReceived > 0) {
          console.log(`🎉 [WRTC] Fallback: fluxo detectado via getStats para ${participantId}`);
          const receivers = pc.getReceivers();
          const tracks = receivers.map(r => r.track).filter(Boolean) as MediaStreamTrack[];
          if (tracks.length > 0) {
            const synthetic = new MediaStream(tracks);
            this.handleTrackReceived(participantId, synthetic);
          }
        }
      }
    }, 8000);

    pc.ontrack = (event) => {
      onTrackReceived = true;
      clearTimeout(onTrackTimeout);
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.handleTrackReceived(participantId, stream);
    };

    // ✅ Adicionar tracks locais (se participante)
    const localStream = this.getLocalStream();
    if (localStream && localStream.getTracks().length > 0) {
      localStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          pc.addTrack(track, localStream);
        }
      });
    } else {
      // Host recvonly
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    return pc;
  }

  private handleTrackReceived(participantId: string, stream: MediaStream): void {
    console.log(`🎥 [WRTC] Track recebido de ${participantId}`, {
      id: stream.id,
      tracks: stream.getTracks().map(t => ({ kind: t.kind, state: t.readyState }))
    });
    this.streamCallback?.(participantId, stream);

    window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
      detail: { participantId, stream, timestamp: Date.now() }
    }));
  }

  async handleOffer(participantId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(participantId) || this.createPeerConnection(participantId);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    unifiedWebSocketService.sendAnswer(participantId, answer);
  }

  async handleAnswer(participantId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(participantId);
    if (pc) await pc.setRemoteDescription(answer);
  }

  async handleIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(participantId);
    if (pc) await pc.addIceCandidate(candidate);
  }

  async initiateCall(participantId: string): Promise<void> {
    const pc = this.peerConnections.get(participantId);
    if (!pc) throw new Error(`No RTCPeerConnection for ${participantId}`);

    // ✅ Patch: validar tracks antes
    const local = this.getLocalStream();
    const hasTracks = local && local.getTracks().some(t => t.readyState === 'live');
    if (!hasTracks) {
      console.warn(`⚠️ [WRTC] Nenhuma track ativa para ${participantId}, abortando offer`);
      return;
    }

    const offer = await pc.createOffer();
    if (!offer.sdp || !offer.sdp.includes('m=video')) {
      console.error(`❌ [WRTC] Offer inválido (sem m=video) para ${participantId}`);
      return;
    }

    await pc.setLocalDescription(offer);
    unifiedWebSocketService.sendOffer(participantId, offer);
  }

  closePeerConnection(participantId: string): void {
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
    }
  }
}
