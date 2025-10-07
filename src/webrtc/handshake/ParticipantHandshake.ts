// ============= Participant WebRTC Handshake Logic (PATCHED) =============
import { unifiedWebSocketService } from "@/services/UnifiedWebSocketService";

class ParticipantHandshakeManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private pendingAnswer: RTCSessionDescriptionInit | null = null; // PATCH: buffer para answer
  private isOfferInProgress: boolean = false;
  private participantId: string | null = null;

  private handshakeTimeouts = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.setupParticipantHandlers();
  }

  // ======================== Handshake Core ========================
  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) return;
    this.isOfferInProgress = true;

    try {
      // Garantir stream local
      const stream = await this.ensureLocalStream();
      if (!stream) throw new Error("No stream available for offer");

      // Criar PeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Adicionar tracks
      stream.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          this.peerConnection!.addTrack(track, stream);
        }
      });

      // Watchdog de 8s para handshake lento
      const monitor = setTimeout(() => this._checkHandshake(hostId), 8000);
      this.handshakeTimeouts.set(hostId + "-monitor", monitor);

      // ICE candidates
      this.peerConnection.onicecandidate = (ev) => {
        if (ev.candidate) {
          unifiedWebSocketService.sendWebRTCCandidate(hostId, ev.candidate);
        }
      };

      // Monitora estados
      this.peerConnection.oniceconnectionstatechange = () => {
        const st = this.peerConnection?.iceConnectionState;
        if (st === "checking" || st === "connected" || st === "completed") {
          this._clearHandshakeMonitor(hostId); // PATCH
        }
      };
      this.peerConnection.onconnectionstatechange = () => {
        const st = this.peerConnection?.connectionState;
        if (st === "connected") this._clearHandshakeMonitor(hostId);
      };

      // Criar offer
      const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true });
      await this.peerConnection.setLocalDescription(offer);

      // PATCH: aplicar answer bufferizada (se já tiver chegado antes)
      if (this.pendingAnswer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingAnswer));
        this.pendingAnswer = null;
      }

      // Enviar offer (agora com participantId obrigatório)
      unifiedWebSocketService.emit("webrtc-offer", {
        offer,
        toUserId: hostId,
        participantId: this.participantId,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("❌ Failed to create/send offer:", err);
    } finally {
      this.isOfferInProgress = false;
    }
  }

  // ======================== Answer Handling ========================
  private setupParticipantHandlers(): void {
    unifiedWebSocketService.on("webrtc-answer", async (data: any) => {
      const hostId = data?.fromUserId || "host";
      const answer = data?.answer;

      if (!answer?.sdp) return;

      if (!this.peerConnection) {
        console.warn("⚠️ Answer received but no active PC – buffering...");
        this.pendingAnswer = answer;
        return;
      }

      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Answer applied");
        this._clearHandshakeMonitor(hostId);
      } catch (err) {
        console.error("❌ Error applying answer:", err);
      }
    });

    unifiedWebSocketService.on("webrtc-candidate", async (data: any) => {
      const candidate = data?.candidate;
      if (!candidate) return;

      if (this.peerConnection?.remoteDescription) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      } else {
        this.pendingCandidates.push(candidate);
      }
    });
  }

  // ======================== Helpers ========================
  private async ensureLocalStream(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.active) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      (window as any).__participantSharedStream = this.localStream;
      return this.localStream;
    } catch (err) {
      console.error("❌ Failed to get local stream", err);
      return null;
    }
  }

  private _checkHandshake(hostId: string) {
    const pc = this.peerConnection;
    if (!pc) return;

    if (pc.connectionState !== "connected" && pc.signalingState === "have-local-offer") {
      console.warn("⚠️ Handshake lento – solicitando renegociação (não fechar PC)");
      unifiedWebSocketService.emit("webrtc-request-offer", { toUserId: hostId, participantId: this.participantId });
      // Rechecar em mais 10s
      const retry = setTimeout(() => this._recheckHandshake(hostId), 10000);
      this.handshakeTimeouts.set(hostId + "-monitor", retry);
    }
  }

  private _recheckHandshake(hostId: string) {
    const pc = this.peerConnection;
    if (!pc) return;
    if (pc.connectionState !== "connected") {
      console.warn("⚠️ Handshake não completou – resetando PC");
      pc.close();
      this.peerConnection = null;
      this.createAndSendOffer(hostId);
    }
  }

  private _clearHandshakeMonitor(hostId: string) {
    const monitor = this.handshakeTimeouts.get(hostId + "-monitor");
    if (monitor) {
      clearTimeout(monitor);
      this.handshakeTimeouts.delete(hostId + "-monitor");
    }
  }

  setParticipantId(id: string) {
    this.participantId = id;
  }
}

export const participantHandshakeManager = new ParticipantHandshakeManager();
