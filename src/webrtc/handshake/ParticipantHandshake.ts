// ============= Participant WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamLogger } from '@/utils/debug/StreamLogger';

class ParticipantHandshakeManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private isOfferInProgress: boolean = false;
  private participantId: string | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly CONNECTION_TIMEOUT_MS = 30000;
  private hasReconnected: boolean = false;
  private lastConnectionTime: number = 0;
  private handshakeStartTime: number = 0;
  
  constructor() {
    this.setupParticipantHandlers();
  }

  // ROUTE LOAD: Get media immediately on route load
  async initializeOnRouteLoad(): Promise<MediaStream | null> {
    const startTime = performance.now();
    console.log('[PART] Route load initialization - getUserMedia start');
    
    try {
      const stream = await this.getUserMediaForOffer();
      const duration = performance.now() - startTime;
      console.log(`[PART] getUserMedia: ok (${duration.toFixed(1)}ms)`);
      return stream;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`[PART] getUserMedia: error (${duration.toFixed(1)}ms)`, error);
      throw error;
    }
  }

  async getUserMediaForOffer(): Promise<MediaStream> {
    console.log('[PART] getUserMediaForOffer: Starting media acquisition for offer');
    
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
        console.log('[PART] getUserMediaForOffer: Front camera fallback');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'user' } },
          audio: false
        });
      }

      if (stream && stream.getTracks().length > 0) {
        this.localStream = stream;
        this.setupStreamHealthMonitoring(stream);
        return stream;
      } else {
        throw new Error('Failed to obtain any media stream');
      }
    } catch (error) {
      console.error('[PART] getUserMediaForOffer: Failed:', error);
      throw error;
    }
  }

  async ensureLocalStream(): Promise<MediaStream | null> {
    if (this.localStream) {
      const activeTracks = this.localStream.getTracks().filter(track => track.readyState === 'live');
      if (activeTracks.length > 0) {
        return this.localStream;
      }
    }
    
    return await this.getUserMediaForOffer();
  }

  private setupStreamHealthMonitoring(stream: MediaStream): void {
    const videoTrack = stream.getVideoTracks()[0];
    
    if (videoTrack) {
      videoTrack.addEventListener('ended', () => {
        console.log('[PART] Video track ended');
      });
      
      videoTrack.addEventListener('mute', () => {
        console.log('[PART] Video track muted');
      });
      
      videoTrack.addEventListener('unmute', () => {
        console.log('[PART] Video track unmuted');
      });
    }
    
    // Health check interval
    const healthInterval = setInterval(() => {
      const vt = stream.getVideoTracks()[0];
      if (vt) {
        console.log(`[PART] Stream health: readyState=${vt.readyState}, enabled=${vt.enabled}, muted=${vt.muted}`);
      } else {
        clearInterval(healthInterval);
      }
    }, 5000);
    
    stream.addEventListener('removetrack', () => {
      clearInterval(healthInterval);
    });
  }

  private setupParticipantHandlers(): void {
    if (!unifiedWebSocketService) {
      console.error('❌ [PARTICIPANT] unifiedWebSocketService not initialized');
      return;
    }

    console.log('🚨 CRÍTICO [PARTICIPANT] Setting up event handlers');
    
    // Limpar handlers existentes primeiro para evitar duplicação  
    // Note: UnifiedWebSocketService não tem método off(), então apenas registramos novos handlers
    
    // Listen for WebRTC offer request from host
    unifiedWebSocketService.on('webrtc-request-offer', async (data: any) => {
      const hostId = data?.fromUserId;
      console.log(`🚨 CRÍTICO [PARTICIPANT] Offer request received from host: ${hostId}`, {
        dataKeys: Object.keys(data),
        hasFromUserId: !!data.fromUserId,
        hasParticipantId: !!data.participantId,
        timestamp: Date.now()
      });
      
      if (!hostId) {
        console.warn('⚠️ [PARTICIPANT] Invalid offer request:', data);
        return;
      }

      // Check host readiness
      const hostReadiness = await this.checkHostReadiness(hostId);
      if (!hostReadiness.ready) {
        console.log(`[PART] Host not ready: ${hostId}, reason: ${hostReadiness.reason}`);
        setTimeout(() => {
          this.createAndSendOffer(hostId);
        }, 2000);
        return;
      }

      // Guard against concurrent offers
      if (this.isOfferInProgress) {
        console.warn('⚠️ [PARTICIPANT] Already making offer, ignoring request from:', hostId);
        return;
      }

      if (this.peerConnection && this.peerConnection.signalingState !== 'stable') {
        console.warn('⚠️ [PARTICIPANT] PC not stable:', this.peerConnection.signalingState, '- ignoring request');
        return;
      }

      await this.createAndSendOffer(hostId);
    });

    // Handler para respostas (answers) do host
    unifiedWebSocketService.on('webrtc-answer', async (data: any) => {
      const hostId = data?.fromUserId || data?.fromSocketId || data?.hostId;
      const answer = data?.answer;

      console.log(`🚨 CRÍTICO [PARTICIPANT] Answer recebido do host`, {
        hostId,
        hasAnswer: !!answer,
        dataKeys: Object.keys(data),
        answerType: answer?.type,
        answerSdpPreview: answer?.sdp?.substring(0, 100) + '...',
        peerConnectionExists: !!this.peerConnection,
        peerConnectionState: this.peerConnection?.connectionState,
        signalingState: this.peerConnection?.signalingState,
        timestamp: Date.now()
      });

      if (!hostId || !answer?.sdp || !answer?.type) {
        console.error('❌ [PARTICIPANT] Invalid answer format:', data);
        return;
      }

      console.log(`✅ [PARTICIPANT] setRemoteDescription -> answer received from ${hostId}`);

      if (!this.peerConnection) {
        console.warn('⚠️ [PARTICIPANT] Answer received without active PC');
        return;
      }

      try {
        console.log('🚨 CRÍTICO [PARTICIPANT] Setting remote description from answer...');
        await this.peerConnection.setRemoteDescription(answer);
        console.log('✅ [PARTICIPANT] Remote description set successfully');
        console.log(`🚨 CRÍTICO [PARTICIPANT] Connection state após setRemoteDescription: ${this.peerConnection.connectionState}`);

        // Flush all pending candidates immediately
        if (this.pendingCandidates.length > 0) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Applying ${this.pendingCandidates.length} buffered candidates`);
          
          const candidatesToFlush = [...this.pendingCandidates];
          this.pendingCandidates = [];
          
          for (const candidate of candidatesToFlush) {
            try {
              await this.peerConnection.addIceCandidate(candidate);
              console.log('✅ [PARTICIPANT] ICE candidate aplicado do buffer');
            } catch (err) {
              console.error('❌ [PARTICIPANT] Error flushing candidate:', err);
            }
          }
          console.log('✅ [PARTICIPANT] Buffer de ICE candidates limpo');
        }
        
        console.log('✅ [PARTICIPANT] Connection established successfully');
      } catch (err) {
        console.error('❌ CRÍTICO [PARTICIPANT] Error applying answer:', err);
        this.handleConnectionFailure(hostId);
      }
    });

    // Receive ICE candidates from host with consistent buffering
    unifiedWebSocketService.on('webrtc-candidate', async (data: any) => {
      const hostId = data?.fromUserId || data?.fromSocketId || data?.hostId;
      const candidate = data?.candidate;
      
      console.log('🚨 CRÍTICO [PARTICIPANT] ICE candidate recebido:', {
        fromHost: hostId,
        hasCandidate: !!candidate,
        candidateType: candidate?.candidate?.includes('host') ? 'host' : 
                      candidate?.candidate?.includes('srflx') ? 'srflx' : 'relay',
        peerConnectionExists: !!this.peerConnection,
        hasRemoteDescription: !!this.peerConnection?.remoteDescription
      });
      
      if (!candidate) {
        console.warn('⚠️ [PARTICIPANT] Invalid candidate from:', hostId);
        return;
      }

      if (!this.peerConnection) {
        console.warn('⚠️ [PARTICIPANT] PC doesn\'t exist, buffering candidate from:', hostId);
        this.pendingCandidates.push(candidate);
        return;
      }

      // Apply immediately OR buffer consistently
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log(`✅ [PARTICIPANT] ICE candidate applied immediately from ${hostId}`);
        } catch (err) {
          console.warn('⚠️ [PARTICIPANT] Error adding candidate from:', hostId, err);
        }
      } else {
        this.pendingCandidates.push(candidate);
        console.log(`📦 [PARTICIPANT] ICE candidate buffered from ${hostId} (total: ${this.pendingCandidates.length})`);
      }
    });
    
    console.log('✅ [PARTICIPANT] Event handlers configurados com sucesso');
  }

  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) {
      console.log('[PARTICIPANT] createAndSendOffer: Offer already in progress, skipping');
      return;
    }

    const offerStartTime = performance.now();
    this.handshakeStartTime = offerStartTime;
    console.log(`🚨 CRÍTICO [PARTICIPANT] Starting offer creation sequence for ${hostId}`);

    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      console.log('[PARTICIPANT] createAndSendOffer: Closing existing peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isOfferInProgress = true;
    this.clearConnectionTimeout();

    try {
      // STEP 1: Ensure we have local stream FIRST
      const streamStartTime = performance.now();
      const stream = await this.ensureLocalStream();
      const streamDuration = performance.now() - streamStartTime;
      
      if (!stream) {
        throw new Error('No local stream available for offer');
      }
      console.log(`🚨 CRÍTICO [PARTICIPANT] Stream validado:`, {
        hasStream: !!stream,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length || 0,
        audioTracks: stream?.getAudioTracks().length || 0,
        videoEnabled: stream?.getVideoTracks()[0]?.enabled,
        audioEnabled: stream?.getAudioTracks()[0]?.enabled,
        duration: `${streamDuration.toFixed(1)}ms`
      });

      // STEP 2: Create new peer connection BEFORE any operation
      const pcStartTime = performance.now();
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      const pcDuration = performance.now() - pcStartTime;
      console.log(`🚨 CRÍTICO [PARTICIPANT] RTCPeerConnection created: ${this.peerConnection.connectionState} (${pcDuration.toFixed(1)}ms)`);

      // STEP 3: Add tracks to peer connection BEFORE creating offer
      const addTrackStartTime = performance.now();
      console.log('🚨 CRÍTICO [PARTICIPANT] Anexando stream ao RTCPeerConnection...');
      stream.getTracks().forEach((track, index) => {
        if (this.peerConnection && stream) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Adicionando track ${index + 1}: ${track.kind} (enabled: ${track.enabled}, readyState: ${track.readyState})`);
          this.peerConnection.addTrack(track, stream);
        }
      });
      const addTrackDuration = performance.now() - addTrackStartTime;
      console.log(`✅ [PARTICIPANT] All tracks added to RTCPeerConnection (${addTrackDuration.toFixed(1)}ms)`);

      // Set up event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🚨 CRÍTICO [PARTICIPANT] ICE candidate generated, sending to host');
          unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
        }
      };

      // Enhanced connection state monitoring with detailed logging and recovery logic
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        const iceState = this.peerConnection?.iceConnectionState;
        const elapsed = performance.now() - this.handshakeStartTime;
        console.log(`🔍 CONNECTION: State changed to ${state} for participant (${elapsed.toFixed(1)}ms since start) - ICE: ${iceState}`);
        
        if (state === 'connected') {
          this.clearConnectionTimeout();
          this.reconnectAttempts = 0;
          console.log(`✅ CONNECTION: WebRTC connection established (${elapsed.toFixed(1)}ms total)`);
          
          // Notify successful connection
          window.dispatchEvent(new CustomEvent('participant-connected', {
            detail: { participantId: this.participantId, timestamp: Date.now(), method: 'connection-state' }
          }));
        } else if (state === 'failed') {
          console.warn(`❌ CONNECTION: Connection failed definitively (${state}) - initiating recovery`);
          this.handleConnectionFailure(hostId);
        } else if (state === 'disconnected') {
          console.warn(`📤 CONNECTION: Connection disconnected (${state}) - may be temporary`);
          // Don't immediately trigger recovery for disconnected state - could be temporary
        } else if (state === 'connecting') {
          console.log(`🔄 CONNECTION: Connection attempting to establish (${state})`);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log(`🧊 ICE: State changed to ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          this.clearConnectionTimeout();
          console.log(`✅ ICE: Connection established (${state})`);
        } else if (state === 'failed') {
          console.warn(`❌ ICE: Connection failed`);
          this.handleConnectionFailure(hostId);
        } else if (state === 'checking') {
          console.log(`🔍 ICE: Checking connectivity...`);
        }
      };

      // STEP 4: Create offer AFTER stream is added
      const offerCreateStartTime = performance.now();
      console.log('🚨 CRÍTICO [PARTICIPANT] Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      const offerCreateDuration = performance.now() - offerCreateStartTime;

      // STEP 5: Set local description
      const setLocalStartTime = performance.now();
      console.log('🚨 CRÍTICO [PARTICIPANT] Setting local description...');
      await this.peerConnection.setLocalDescription(offer);
      const setLocalDuration = performance.now() - setLocalStartTime;
      
      console.log(`✅ [PARTICIPANT] createOffer (${offerCreateDuration.toFixed(1)}ms) -> setLocalDescription (${setLocalDuration.toFixed(1)}ms)`);

      // STEP 6: Send offer to host with detailed debugging
      const sendStartTime = performance.now();
      console.log(`🚨 CRÍTICO [PARTICIPANT] Enviando offer para host ${hostId}`, {
        sdp: offer.sdp?.substring(0, 100) + '...',
        type: offer.type,
        localStreamTracks: stream.getTracks().length,
        peerConnectionState: this.peerConnection.connectionState,
        signalingState: this.peerConnection.signalingState,
        hasLocalDescription: !!this.peerConnection.localDescription
      });
      
      unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);
      console.log(`✅ CRÍTICO [PARTICIPANT] Offer enviado via WebSocket para ${hostId} - Aguardando answer...`);
      
      const sendDuration = performance.now() - sendStartTime;
      const totalDuration = performance.now() - offerStartTime;
      console.log(`✅ [PARTICIPANT] setLocalDescription -> offerSent (${sendDuration.toFixed(1)}ms) -> Total sequence: ${totalDuration.toFixed(1)}ms`);

      // Set connection timeout
      this.setConnectionTimeout(() => {
        console.log('[PARTICIPANT] Connection timeout reached (30s)');
        this.handleConnectionFailure(hostId);
      });

    } catch (error) {
      console.error('❌ CRÍTICO [PARTICIPANT] createAndSendOffer: Failed:', error);
      this.isOfferInProgress = false;
      throw error;
    } finally {
      this.isOfferInProgress = false;
    }
  }

  private async checkHostReadiness(hostId: string): Promise<{ready: boolean, reason?: string}> {
    try {
      console.log(`[PART] Checking host readiness: ${hostId}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      return { ready: true };
    } catch (error) {
      console.log(`[PART] Host check failed: ${hostId}`, error);
      return { ready: false, reason: 'check-failed' };
    }
  }

  private handleConnectionFailure(hostId: string): void {
    console.log(`🔧 RECOVERY: Connection failure recovery initiated for: ${hostId}`);
    
    // Enhanced failure logging
    const connectionState = this.peerConnection?.connectionState;
    const iceState = this.peerConnection?.iceConnectionState;
    const signalingState = this.peerConnection?.signalingState;
    
    console.log(`🔍 FAILURE: Connection states - Connection: ${connectionState}, ICE: ${iceState}, Signaling: ${signalingState}`);
    
    // First try ICE restart if possible before full reset
    if (this.peerConnection && 
        this.peerConnection.signalingState === 'stable' && 
        this.reconnectAttempts === 0) {
      
      console.log(`🧊 RECOVERY: Attempting ICE restart for: ${hostId}`);
      this.reconnectAttempts++;
      
      this.peerConnection.createOffer({ iceRestart: true })
        .then(offer => {
          if (this.peerConnection) {
            return this.peerConnection.setLocalDescription(offer);
          }
        })
        .then(() => {
          console.log(`✅ RECOVERY: ICE restart initiated for: ${hostId}`);
          // Reset timeout for ICE restart attempt
          this.setConnectionTimeout(() => {
            console.log(`⏰ RECOVERY: ICE restart timeout for: ${hostId}`);
            this.performFullReset(hostId);
          });
        })
        .catch(error => {
          console.warn(`⚠️ RECOVERY: ICE restart failed for ${hostId}:`, error);
          this.performFullReset(hostId);
        });
    } else {
      this.performFullReset(hostId);
    }
  }

  private performFullReset(hostId: string): void {
    console.log(`🔄 RESET: Full connection reset for: ${hostId}`);
    
    // Reset PC completely
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Clear pending candidates
    this.pendingCandidates = [];
    
    // Controlled retry with backoff - only if under retry limit
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const backoffDelay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 15000);
      
      console.log(`⏰ RETRY: Scheduling retry ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${backoffDelay}ms for: ${hostId}`);
      
      setTimeout(async () => {
        if (!this.isOfferInProgress) {
          try {
            console.log(`🔄 RETRY: Attempt ${this.reconnectAttempts} for: ${hostId}`);
            await this.createAndSendOffer(hostId);
          } catch (error) {
            console.error(`❌ RETRY: Failed attempt ${this.reconnectAttempts} for ${hostId}:`, error);
          }
        }
      }, backoffDelay);
    } else {
      console.warn(`⚠️ RETRY: Max attempts reached for: ${hostId} - manual intervention required`);
      
      // Dispatch event for manual recovery
      window.dispatchEvent(new CustomEvent('connection-recovery-needed', {
        detail: { 
          participantId: this.participantId, 
          hostId, 
          attempts: this.reconnectAttempts,
          timestamp: Date.now()
        }
      }));
    }
  }

  private setConnectionTimeout(callback: () => void): void {
    this.clearConnectionTimeout();
    this.connectionTimeout = setTimeout(callback, this.CONNECTION_TIMEOUT_MS);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private validateActiveStream(stream: MediaStream): boolean {
    if (!stream || !stream.active) {
      console.log('[PART] Stream validation failed: inactive stream');
      return false;
    }
    
    const videoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live');
    
    if (videoTracks.length === 0) {
      console.log('[PART] Stream validation failed: no live video tracks');
      return false;
    }
    
    console.log(`[PART] Stream validation passed: ${videoTracks.length} live video tracks`);
    return true;
  }

  // Cleanup methods
  cleanupParticipantHandshake(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.clearConnectionTimeout();
    this.pendingCandidates = [];
    this.reconnectAttempts = 0;
    
    console.log('🧹 [PARTICIPANT] Handshake cleanup complete');
  }

  setParticipantId(id: string): void {
    this.participantId = id;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}

// Global instance
const participantHandshakeManager = new ParticipantHandshakeManager();

// Export functions for external use
export const initializeOnRouteLoad = () => participantHandshakeManager.initializeOnRouteLoad();
export const cleanupParticipantHandshake = () => participantHandshakeManager.cleanupParticipantHandshake();
export const setParticipantId = (id: string) => participantHandshakeManager.setParticipantId(id);
export const getLocalStream = () => participantHandshakeManager.getLocalStream();

// Initialize handlers once
if (typeof window !== 'undefined' && !(window as any).__participantHandlersSetup) {
  (window as any).__participantHandlersSetup = true;
  console.log('✅ [PARTICIPANT] Enhanced handshake handlers initialized');
}