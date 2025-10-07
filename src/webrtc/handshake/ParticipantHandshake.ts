// ============= Participant WebRTC Handshake Logic (REESCRITO) =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamLogger } from '@/utils/debug/StreamLogger';

// ============= INTERNAL ARCHITECTURE =============

enum HandshakeState {
  IDLE = 'idle',
  CREATING_OFFER = 'creating-offer',
  WAITING_ANSWER = 'waiting-answer',
  APPLYING_ANSWER = 'applying-answer',
  FLUSHING_CANDIDATES = 'flushing-candidates',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

class ICECandidateBuffer {
  private buffer: RTCIceCandidate[] = [];
  private remoteDescriptionSet = false;

  add(candidate: RTCIceCandidate, pc: RTCPeerConnection): void {
    if (this.remoteDescriptionSet && pc.remoteDescription) {
      // Apply immediately if remote description is already set
      pc.addIceCandidate(candidate).catch(err => {
        console.warn('⚠️ Error applying immediate candidate:', err);
      });
    } else {
      // Buffer for later
      this.buffer.push(candidate);
    }
  }

  async flush(pc: RTCPeerConnection): Promise<void> {
    this.remoteDescriptionSet = true;
    console.log(`📦 Flushing ${this.buffer.length} buffered ICE candidates`);
    
    for (const candidate of this.buffer) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn('⚠️ Error flushing candidate:', err);
      }
    }
    this.buffer = [];
  }

  clear(): void {
    this.buffer = [];
    this.remoteDescriptionSet = false;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }
}

class NegotiationLock {
  private locked = false;

  async acquire(): Promise<void> {
    while (this.locked) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.locked = true;
  }

  release(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

// ============= MAIN HANDSHAKE MANAGER =============

class ParticipantHandshakeManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private participantId: string | null = null;
  
  // New architecture components
  private state: HandshakeState = HandshakeState.IDLE;
  private candidateBuffer = new ICECandidateBuffer();
  private negotiationLock = new NegotiationLock();
  
  // Adaptive timeline
  private normalConnectionTimer: NodeJS.Timeout | null = null;
  private iceRestartTimer: NodeJS.Timeout | null = null;
  private hasAttemptedICERestart = false;
  
  private handlersRegistered = false;

  constructor() {
    this.setupParticipantHandlers();
  }

  // ============= PUBLIC INTERFACE (SAME AS BEFORE) =============

  async initializeOnRouteLoad(): Promise<MediaStream | null> {
    console.log('[PART] Route load initialization');
    
    const sharedStream = (window as any).__participantSharedStream;
    if (sharedStream && sharedStream.getTracks().length > 0) {
      const activeTracks = sharedStream.getTracks().filter(t => t.readyState === 'live' && t.enabled);
      if (activeTracks.length > 0) {
        console.log('[PART] Using validated shared stream');
        this.localStream = sharedStream;
        return sharedStream;
      }
    }
    
    console.log('[PART] No shared stream available');
    return null;
  }

  setParticipantId(id: string): void {
    this.participantId = id;
    console.log('[PART] Participant ID set:', id);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  cleanup(): void {
    console.log('[PART] Cleanup initiated');
    
    this.clearAdaptiveTimers();
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.candidateBuffer.clear();
    this.state = HandshakeState.IDLE;
    this.hasAttemptedICERestart = false;
  }

  // ============= STREAM MANAGEMENT =============

  async ensureLocalStream(): Promise<MediaStream> {
    const sharedStream = (window as any).__participantSharedStream;
    
    if (sharedStream && sharedStream.getTracks().length > 0) {
      const videoTracks = sharedStream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        this.localStream = sharedStream;
        return sharedStream;
      }
    }
    
    console.warn('⚠️ No valid shared stream, creating fallback');
    const newStream = await this.getUserMediaForOffer();
    (window as any).__participantSharedStream = newStream;
    this.localStream = newStream;
    return newStream;
  }

  async getUserMediaForOffer(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 }
      },
      audio: false
    };

    try {
      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!stream || stream.getTracks().length === 0) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
          audio: false
        });
      }

      return stream;
    } catch (error) {
      console.error('[PART] getUserMedia failed:', error);
      throw error;
    }
  }

  // ============= VALIDATIONS =============

  private validateStream(stream: MediaStream): void {
    const videoTracks = stream.getVideoTracks();
    
    if (videoTracks.length === 0) {
      throw new Error('[VALIDATION] Stream sem video tracks');
    }
    
    const videoTrack = videoTracks[0];
    
    if (videoTrack.readyState !== 'live') {
      throw new Error(`[VALIDATION] Video track não está live: ${videoTrack.readyState}`);
    }
    
    if (!videoTrack.enabled) {
      throw new Error('[VALIDATION] Video track desabilitado');
    }
    
    console.log('✅ Stream validado:', {
      streamId: stream.id,
      videoTracks: videoTracks.length,
      readyState: videoTrack.readyState,
      enabled: videoTrack.enabled
    });
  }

  private validateSDP(sdp: string, type: 'offer' | 'answer'): void {
    if (!sdp.includes('m=video')) {
      throw new Error(`[VALIDATION] ${type} sem m=video`);
    }
    
    const ssrcCount = (sdp.match(/a=ssrc:/g) || []).length;
    if (ssrcCount === 0) {
      throw new Error(`[VALIDATION] ${type} sem SSRC`);
    }
    
    console.log(`✅ ${type} SDP validado:`, {
      hasVideo: true,
      ssrcCount
    });
  }

  // ============= WEBSOCKET HANDLERS =============

  private setupParticipantHandlers(): void {
    if (this.handlersRegistered || !unifiedWebSocketService) {
      return;
    }

    console.log('🔧 Registering WebSocket handlers');

    unifiedWebSocketService.on('webrtc-request-offer', async (data: any) => {
      const hostId = data?.fromUserId;
      console.log(`📩 Offer request from host: ${hostId}`);
      
      if (!hostId) {
        console.warn('⚠️ Invalid offer request');
        return;
      }

      if (this.negotiationLock.isLocked()) {
        console.warn('⚠️ Negotiation in progress, ignoring request');
        return;
      }

      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        console.warn(`⚠️ PC not stable: ${this.peerConnection.signalingState}`);
        return;
      }

      await this.createAndSendOffer(hostId);
    });

    unifiedWebSocketService.on('webrtc-answer', async (data: any) => {
      const answer = data?.answer;
      console.log(`📩 Answer received`);
      await this.handleAnswer(answer);
    });

    unifiedWebSocketService.on('webrtc-candidate', (data: any) => {
      const candidate = data?.candidate;
      if (candidate) {
        this.handleCandidate(candidate);
      }
    });
    
    this.handlersRegistered = true;
    console.log('✅ Handlers registered');
  }

  // ============= CORE HANDSHAKE FLOW =============

  async createAndSendOffer(hostId: string): Promise<void> {
    const correlationId = `handshake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`\n🔗 [${correlationId}] INÍCIO DO HANDSHAKE`);
    
    // STEP 1: Acquire negotiation lock
    await this.negotiationLock.acquire();
    
    try {
      this.state = HandshakeState.CREATING_OFFER;
      
      // STEP 2: Validate stream BEFORE anything
      const stream = await this.ensureLocalStream();
      this.validateStream(stream);
      console.log(`🔗 [${correlationId}] Stream validado`);
      
      // STEP 3: Create PeerConnection if needed
      if (!this.peerConnection) {
        this.createPeerConnection(hostId, correlationId);
      }
      
      // STEP 4: Add tracks to connection
      this.addTracksToConnection(stream, correlationId);
      
      // STEP 5: Create offer + setLocalDescription (ATOMIC)
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      // STEP 6: Validate SDP before applying
      this.validateSDP(offer.sdp!, 'offer');
      
      // STEP 7: Apply local description
      await this.peerConnection!.setLocalDescription(offer);
      console.log(`🔗 [${correlationId}] Local description set`);
      
      // STEP 8: Send offer
      this.state = HandshakeState.WAITING_ANSWER;
      unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);
      console.log(`🔗 [${correlationId}] Offer sent, aguardando answer...`);
      
      // STEP 9: Start adaptive timeline
      this.startAdaptiveTimeline(hostId, correlationId);
      
    } catch (error) {
      console.error(`❌ [${correlationId}] Error creating offer:`, error);
      this.state = HandshakeState.FAILED;
      throw error;
    } finally {
      this.negotiationLock.release();
    }
  }

  private createPeerConnection(hostId: string, correlationId: string): void {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(config);
    console.log(`🔗 [${correlationId}] PeerConnection created`);

    // Setup event handlers
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 ICE candidate generated`);
        unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log(`🔍 Connection state: ${state}`);
      
      if (state === 'connected') {
        this.clearAdaptiveTimers();
        this.state = HandshakeState.CONNECTED;
        this.hasAttemptedICERestart = false;
        console.log(`✅ [${correlationId}] WebRTC connected`);
        
        window.dispatchEvent(new CustomEvent('participant-connected', {
          detail: { participantId: this.participantId, timestamp: Date.now() }
        }));
      } else if (state === 'failed') {
        console.warn(`❌ Connection failed`);
        this.state = HandshakeState.FAILED;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log(`🧊 ICE state: ${state}`);
    };
  }

  private addTracksToConnection(stream: MediaStream, correlationId: string): void {
    const tracks = stream.getTracks();
    const validTracks = tracks.filter(t => t.readyState === 'live' && t.enabled);
    
    if (validTracks.length === 0) {
      throw new Error('No valid tracks to add');
    }
    
    console.log(`🔗 [${correlationId}] Adding ${validTracks.length} tracks`);
    
    validTracks.forEach(track => {
      this.peerConnection!.addTrack(track, stream);
    });
    
    // Validate senders
    const senders = this.peerConnection!.getSenders();
    const activeSenders = senders.filter(s => s.track && s.track.readyState === 'live');
    
    if (activeSenders.length === 0) {
      throw new Error('No active senders after addTrack');
    }
    
    console.log(`✅ [${correlationId}] ${activeSenders.length} senders validated`);
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.state !== HandshakeState.WAITING_ANSWER) {
      console.warn(`⚠️ Answer em estado errado: ${this.state}`);
      return;
    }
    
    if (!this.peerConnection) {
      console.warn('⚠️ No PeerConnection for answer');
      return;
    }

    try {
      this.state = HandshakeState.APPLYING_ANSWER;
      
      // Validate SDP
      this.validateSDP(answer.sdp!, 'answer');
      
      // Apply remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Remote description set');
      
      // FLUSH buffered candidates
      this.state = HandshakeState.FLUSHING_CANDIDATES;
      await this.candidateBuffer.flush(this.peerConnection);
      console.log('✅ Candidates flushed');
      
    } catch (error) {
      console.error('❌ Error applying answer:', error);
      this.state = HandshakeState.FAILED;
    }
  }

  private handleCandidate(candidate: RTCIceCandidate): void {
    if (!this.peerConnection) {
      console.warn('⚠️ No PC, buffering candidate');
      return;
    }
    
    this.candidateBuffer.add(candidate, this.peerConnection);
  }

  // ============= ADAPTIVE TIMELINE =============

  private startAdaptiveTimeline(hostId: string, correlationId: string): void {
    this.clearAdaptiveTimers();
    
    // PHASE 1: Wait 15s for normal connection
    this.normalConnectionTimer = setTimeout(() => {
      if (this.peerConnection?.connectionState === 'connected') {
        return;
      }
      
      console.log(`⏱️ [${correlationId}] 15s elapsed, attempting ICE restart`);
      this.attemptICERestart(hostId, correlationId);
    }, 15000);
  }

  private async attemptICERestart(hostId: string, correlationId: string): Promise<void> {
    if (!this.peerConnection || this.peerConnection.signalingState !== 'stable') {
      console.warn(`⚠️ [${correlationId}] Cannot ICE restart, signalingState: ${this.peerConnection?.signalingState}`);
      this.recreatePeerConnection(hostId, correlationId);
      return;
    }
    
    if (this.hasAttemptedICERestart) {
      console.warn(`⚠️ [${correlationId}] ICE restart já tentado`);
      this.recreatePeerConnection(hostId, correlationId);
      return;
    }

    try {
      console.log(`⚡ [${correlationId}] Attempting ICE restart`);
      this.hasAttemptedICERestart = true;
      
      const restartOffer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(restartOffer);
      
      unifiedWebSocketService.sendWebRTCOffer(hostId, restartOffer.sdp!, restartOffer.type);
      console.log(`✅ [${correlationId}] ICE restart offer sent`);
      
      // PHASE 2: Wait 10s for ICE restart
      this.iceRestartTimer = setTimeout(() => {
        if (this.peerConnection?.connectionState !== 'connected') {
          console.warn(`⚠️ [${correlationId}] ICE restart failed`);
          this.recreatePeerConnection(hostId, correlationId);
        }
      }, 10000);
      
    } catch (error) {
      console.error(`❌ [${correlationId}] ICE restart error:`, error);
      this.recreatePeerConnection(hostId, correlationId);
    }
  }

  private recreatePeerConnection(hostId: string, correlationId: string): void {
    console.log(`🔄 [${correlationId}] Recreating PeerConnection (LAST RESORT)`);
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.candidateBuffer.clear();
    this.state = HandshakeState.IDLE;
    this.hasAttemptedICERestart = false;
    
    // Only 1 retry
    setTimeout(() => {
      this.createAndSendOffer(hostId);
    }, 1000);
  }

  private clearAdaptiveTimers(): void {
    if (this.normalConnectionTimer) {
      clearTimeout(this.normalConnectionTimer);
      this.normalConnectionTimer = null;
    }
    
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
  }
}

// ============= GLOBAL EXPORTS (SAME AS BEFORE) =============

const manager = new ParticipantHandshakeManager();

export const initializeOnRouteLoad = () => manager.initializeOnRouteLoad();
export const cleanupParticipantHandshake = () => manager.cleanup();
export const setParticipantId = (id: string) => manager.setParticipantId(id);
export const getLocalStream = () => manager.getLocalStream();
