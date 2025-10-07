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
      // FASE 1: Garantir stream local ANTES de criar PeerConnection
      const stream = await this.ensureLocalStream();
      if (!stream) throw new Error("No stream available for offer");

      // VALIDAÇÃO CRÍTICA: Stream deve ter video tracks
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error("Stream has no video tracks");
      }

      if (videoTracks[0].readyState !== 'live') {
        throw new Error(`Video track not live: ${videoTracks[0].readyState}`);
      }

      console.log('✅ PARTICIPANT: Stream validated before PeerConnection', {
        streamId: stream.id,
        videoTracks: videoTracks.length,
        audioTracks: stream.getAudioTracks().length,
        videoReadyState: videoTracks[0].readyState
      });

      // Criar PeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ],
      });

      // FASE 2: Adicionar TODOS os tracks do stream ao PeerConnection
      console.log('📤 PARTICIPANT: Adding tracks to PeerConnection...');
      let addedTracks = 0;
      
      stream.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          const sender = this.peerConnection!.addTrack(track, stream);
          addedTracks++;
          console.log(`✅ PARTICIPANT: Added ${track.kind} track`, {
            trackId: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
            sender: !!sender
          });
        } else {
          console.warn(`⚠️ PARTICIPANT: Skipped ${track.kind} track - not live:`, track.readyState);
        }
      });

      // VALIDAÇÃO: Verificar que tracks foram adicionados
      const senders = this.peerConnection!.getSenders();
      console.log(`📊 PARTICIPANT: PeerConnection senders:`, {
        sendersCount: senders.length,
        addedTracks,
        senderDetails: senders.map(s => ({
          kind: s.track?.kind,
          enabled: s.track?.enabled,
          readyState: s.track?.readyState
        }))
      });

      if (senders.length === 0) {
        throw new Error("No tracks were added to PeerConnection");
      }

      // Armazenar PeerConnection globalmente para depuração
      (window as any).__participantPeerConnection = this.peerConnection;

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

      // FASE 3: Criar offer
      console.log('📝 PARTICIPANT: Creating offer...');
      const offer = await this.peerConnection.createOffer({ 
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      // VALIDAÇÃO CRÍTICA: Offer deve conter m=video
      if (!offer.sdp || !offer.sdp.includes('m=video')) {
        console.error('❌ PARTICIPANT: Offer missing m=video section!');
        console.error('SDP:', offer.sdp);
        throw new Error("Offer SDP missing video - reinitialize media");
      }

      console.log('✅ PARTICIPANT: Offer contains m=video');

      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ PARTICIPANT: Local description set');

      // PATCH: aplicar answer bufferizada (se já tiver chegado antes)
      if (this.pendingAnswer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingAnswer));
        this.pendingAnswer = null;
        console.log('✅ PARTICIPANT: Applied buffered answer');
      }

      // FASE 4: Enviar offer (agora com participantId obrigatório)
      console.log('📤 PARTICIPANT: Sending offer to host...');
      unifiedWebSocketService.emit("webrtc-offer", {
        offer,
        toUserId: hostId,
        participantId: this.participantId,
        timestamp: Date.now(),
        roomId: sessionStorage.getItem('currentRoomId') || undefined
      });
      
      console.log('✅ PARTICIPANT: Offer sent successfully');
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
    // FASE 1: Primeiro verificar se já existe stream compartilhado
    const existingStream = (window as any).__participantSharedStream;
    
    if (existingStream && existingStream.active) {
      const videoTracks = existingStream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        console.log('✅ PARTICIPANT: Reusing existing shared stream', {
          streamId: existingStream.id,
          videoTracks: videoTracks.length,
          audioTracks: existingStream.getAudioTracks().length
        });
        this.localStream = existingStream;
        return existingStream;
      } else {
        console.warn('⚠️ PARTICIPANT: Existing stream invalid, recreating...');
      }
    }

    // FASE 2: Criar novo stream com validação
    try {
      console.log('🎥 PARTICIPANT: Requesting new media stream...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: true 
      });

      // Validar stream ANTES de armazenar
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('getUserMedia returned stream without video tracks');
      }

      if (videoTracks[0].readyState !== 'live') {
        throw new Error(`Video track not live: ${videoTracks[0].readyState}`);
      }

      console.log('✅ PARTICIPANT: New stream created and validated', {
        streamId: stream.id,
        videoTracks: videoTracks.length,
        audioTracks: stream.getAudioTracks().length,
        videoReadyState: videoTracks[0].readyState
      });

      // Armazenar IMEDIATAMENTE
      this.localStream = stream;
      (window as any).__participantSharedStream = stream;

      // Validar que foi armazenado
      const stored = (window as any).__participantSharedStream;
      if (!stored || stored.id !== stream.id) {
        throw new Error('Failed to store stream globally');
      }

      return stream;
    } catch (err) {
      console.error("❌ Failed to get local stream", err);
      return null;
    }
  }

  private _checkHandshake(hostId: string) {
    const pc = this.peerConnection;
    if (!pc) return;

    // FASE 5: Não resetar se está connecting - apenas aguardar
    if (pc.connectionState === 'connecting') {
      console.log('🔄 PARTICIPANT: Handshake in progress (connecting), waiting...');
      const retry = setTimeout(() => this._checkHandshake(hostId), 5000);
      this.handshakeTimeouts.set(hostId + "-monitor", retry);
      return;
    }

    if (pc.connectionState !== "connected" && pc.signalingState === "have-local-offer") {
      console.warn("⚠️ Handshake lento – tentando iceRestart");
      
      // FASE 5: Primeiro tentar iceRestart antes de destruir PC
      this.peerConnection!.restartIce();
      console.log('🔄 PARTICIPANT: ICE restart initiated');
      
      // Rechecar em 10s se iceRestart resolveu
      const retry = setTimeout(() => this._recheckHandshake(hostId), 10000);
      this.handshakeTimeouts.set(hostId + "-monitor", retry);
    }
  }

  private _recheckHandshake(hostId: string) {
    const pc = this.peerConnection;
    if (!pc) return;
    
    // FASE 5: Evitar reset prematuro
    const state = pc.connectionState;
    if (state === 'connecting' || state === 'connected') {
      console.log('✅ PARTICIPANT: Connection recovered, clearing monitor');
      this._clearHandshakeMonitor(hostId);
      return;
    }
    
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      console.warn("⚠️ Handshake não completou após iceRestart – resetando PC");
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

// Export helper function for global debug
export function getLocalStream(): MediaStream | null {
  return (window as any).__participantSharedStream || null;
}
