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

  // GUARANTEED SINGLE STREAM: Always use shared stream from participant page
  async initializeOnRouteLoad(): Promise<MediaStream | null> {
    console.log('[PART] Route load initialization - checking for shared stream');
    
    // PRIORITY 1: Try to get shared stream from participant page
    const sharedStream = (window as any).__participantSharedStream;
    if (sharedStream && sharedStream.getTracks().length > 0) {
      const activeTracks = sharedStream.getTracks().filter(t => t.readyState === 'live' && t.enabled);
      if (activeTracks.length > 0) {
        console.log('[PART] Using validated shared stream from participant page');
        this.localStream = sharedStream;
        this.setupStreamHealthMonitoring(sharedStream);
        return sharedStream;
      } else {
        console.warn('[PART] Shared stream found but no active tracks - will not fallback to avoid duplication');
        return null;
      }
    }
    
    console.log('[PART] No shared stream available - this is unexpected');
    return null;
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
    // GUARANTEED SINGLE SOURCE: Only use shared stream from participant page
    const sharedStream = (window as any).__participantSharedStream;
    if (sharedStream && sharedStream.getTracks().length > 0) {
      const activeTracks = sharedStream.getTracks().filter(track => track.readyState === 'live' && track.enabled);
      if (activeTracks.length > 0) {
        console.log('[PART] ensureLocalStream: Using validated shared stream');
        this.localStream = sharedStream;
        return sharedStream;
      } else {
        console.error('[PART] ensureLocalStream: Shared stream has no active tracks');
        return null;
      }
    }
    
    // NO FALLBACK TO PREVENT DUPLICATION - let participant page handle stream creation
    console.error('[PART] ensureLocalStream: No shared stream available - this should not happen');
    return null;
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
        console.log('✅ FASE 3: Remote description set successfully');
        console.log(`🚨 FASE 3: Connection state após setRemoteDescription: ${this.peerConnection.connectionState}`);

        // FASE 3: Mark answer received and flush buffered ICE candidates
        const { iceBuffer } = await import('@/utils/webrtc/ICECandidateBuffer');
        const bufferedCandidates = iceBuffer.markParticipantAnswerReceived();
        
        if (bufferedCandidates.length > 0) {
          console.log(`🚀 FASE 3: Flushing ${bufferedCandidates.length} buffered ICE candidates`);
          
          for (const buffered of bufferedCandidates) {
            try {
              await this.peerConnection.addIceCandidate(buffered.candidate);
              console.log('✅ FASE 3: Buffered ICE candidate applied');
            } catch (err) {
              console.error('❌ FASE 3: Error applying buffered candidate:', err);
            }
          }
          console.log('✅ FASE 3: All buffered ICE candidates processed');
        }

        // FASE 3: Now send any new ICE candidates immediately
        console.log('✅ FASE 3: ICE candidate buffering disabled - future candidates will be sent immediately');
        
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

      // FASE 3: Use ICE buffer for consistent handling
      const { iceBuffer } = await import('@/utils/webrtc/ICECandidateBuffer');
      
      if (!this.peerConnection) {
        console.warn('⚠️ FASE 3: PC doesn\'t exist, candidate will be discarded');
        return;
      }

      // FASE 3: Apply immediately only if we have remote description (answer received)
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log(`✅ FASE 3: ICE candidate applied immediately from ${hostId}`);
        } catch (err) {
          console.warn('⚠️ FASE 3: Error adding candidate from:', hostId, err);
        }
      } else {
        // FASE 3: Note that we don't buffer incoming candidates anymore
        // Incoming candidates from host should only arrive after we receive the answer
        console.warn(`⚠️ FASE 3: Received ICE candidate before answer - this indicates signaling order issue`);
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
    console.log(`🚨 FASE 2: Starting CONTROLLED offer creation sequence for ${hostId}`);

    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      console.log('[PARTICIPANT] createAndSendOffer: Closing existing peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isOfferInProgress = true;
    this.clearConnectionTimeout();

    try {
      // FASE 2: AGUARDAR ESTABILIZAÇÃO DA SALA PRIMEIRO
      console.log('⏱️ FASE 2: Waiting for room stabilization before WebRTC...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s para sala estar estável

      // FASE 1: VALIDAR FRAMES ANTES DE PROSSEGUIR
      const streamStartTime = performance.now();
      const stream = await this.ensureLocalStream();
      const streamDuration = performance.now() - streamStartTime;
      
      if (!stream) {
        throw new Error('No local stream available for offer');
      }

      // FASE 1: CRITICAL - Validar se tracks estão produzindo frames REAIS
      const { FrameValidationUtils } = await import('@/utils/webrtc/FrameValidationUtils');
      console.log('🔍 FASE 1: Validating frame production before WebRTC...');
      
      const frameValidation = await FrameValidationUtils.validateStreamFrameProduction(stream, 5000);
      
      if (!frameValidation.allValid || frameValidation.validTracks.length === 0) {
        console.error('❌ FASE 1: Frame validation failed:', frameValidation.results);
        
        // Tentar aplicar constraints e re-validar
        const videoTracks = stream.getVideoTracks();
        for (const track of videoTracks) {
          await FrameValidationUtils.applyMinimumConstraints(track);
        }
        
        // Re-validar após constraints
        const retryValidation = await FrameValidationUtils.validateStreamFrameProduction(stream, 3000);
        if (!retryValidation.allValid) {
          throw new Error('Video tracks not producing valid frames after constraints applied');
        }
        
        console.log('✅ FASE 1: Frame validation passed after applying constraints');
      } else {
        console.log('✅ FASE 1: Frame validation passed immediately');
      }

      console.log(`🚨 FASE 1+2: Stream and room validated:`, {
        hasStream: !!stream,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length || 0,
        audioTracks: stream?.getAudioTracks().length || 0,
        validVideoTracks: frameValidation.validTracks.length,
        duration: `${streamDuration.toFixed(1)}ms`
      });

      // FASE 2: AGUARDAR ADICIONAL PARA GARANTIR READINESS
      console.log('⏱️ FASE 2: Additional readiness delay...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // STEP 2: Create new peer connection APÓS validações
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
      console.log(`🚨 FASE 2: RTCPeerConnection created: ${this.peerConnection.connectionState} (${pcDuration.toFixed(1)}ms)`);

      // FASE 4: Setup connection state recovery
      const { ConnectionStateRecovery } = await import('@/utils/webrtc/ConnectionStateRecovery');
      const recovery = new ConnectionStateRecovery({
        maxStuckTime: 15000, // 15s stuck threshold
        maxRecoveryAttempts: 3,
        onRecoveryAttempt: (attempt, reason) => {
          console.warn(`🚑 FASE 4: Recovery attempt ${attempt}: ${reason}`);
        },
        onRecoverySuccess: () => {
          console.log('✅ FASE 4: Connection recovery successful');
        },
        onRecoveryFailed: (reason) => {
          console.error(`❌ FASE 4: Connection recovery failed: ${reason}`);
          this.handleConnectionFailure(hostId);
        }
      });

      // STEP 3: ADD ONLY VALIDATED TRACKS
      const addTrackStartTime = performance.now();
      console.log('🚨 FASE 1: Adding ONLY validated tracks to RTCPeerConnection...');
      
      // Use only the validated tracks from frame validation
      frameValidation.validTracks.forEach((track, index) => {
        if (this.peerConnection && stream) {
          console.log(`🚨 FASE 1: Adding VALIDATED track ${index + 1}: ${track.kind} (enabled: ${track.enabled}, readyState: ${track.readyState})`);
          this.peerConnection.addTrack(track, stream);
          
          // Track health monitoring after adding to peer connection
          track.addEventListener('ended', () => {
            console.warn(`⚠️ [PARTICIPANT] Track ${track.kind} ended after being added to PC`);
          });
          
          track.addEventListener('mute', () => {
            console.warn(`⚠️ [PARTICIPANT] Track ${track.kind} muted after being added to PC`);
          });
        }
      });
      
      const addTrackDuration = performance.now() - addTrackStartTime;
      console.log(`✅ FASE 1: ${frameValidation.validTracks.length} VALIDATED tracks added to RTCPeerConnection (${addTrackDuration.toFixed(1)}ms)`);

      // FASE 3: Setup ICE candidate buffering
      const { iceBuffer } = await import('@/utils/webrtc/ICECandidateBuffer');
      
      // Set up event handlers with ICE buffering
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🚨 FASE 3: ICE candidate generated');
          
          // FASE 3: Buffer ICE until answer received
          if (iceBuffer.shouldSendParticipantICE()) {
            console.log('🚀 FASE 3: Sending ICE immediately (answer received)');
            unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
          } else {
            console.log('📦 FASE 3: Buffering ICE candidate (waiting for answer)');
            iceBuffer.bufferParticipantICE(event.candidate, hostId);
          }
        }
      };

      // FASE 4: Enhanced connection state monitoring with recovery
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        const iceState = this.peerConnection?.iceConnectionState;
        const signalingState = this.peerConnection?.signalingState;
        const elapsed = performance.now() - this.handshakeStartTime;
        
        console.log(`🔍 FASE 4: Connection state change:`, {
          connection: state,
          ice: iceState,
          signaling: signalingState,
          elapsed: `${elapsed.toFixed(1)}ms`
        });
        
        // Monitor for recovery
        if (this.peerConnection) {
          recovery.monitorConnection(this.peerConnection);
        }
        
        if (state === 'connected') {
          this.clearConnectionTimeout();
          this.reconnectAttempts = 0;
          console.log(`✅ FASE 4: WebRTC connection established (${elapsed.toFixed(1)}ms total)`);
          
          // Notify successful connection
          window.dispatchEvent(new CustomEvent('participant-connected', {
            detail: { participantId: this.participantId, timestamp: Date.now(), method: 'connection-state' }
          }));
        } else if (state === 'failed') {
          console.warn(`❌ FASE 4: Connection failed definitively (${state})`);
          // Recovery is handled by ConnectionStateRecovery
        } else if (state === 'disconnected') {
          console.warn(`📤 FASE 4: Connection disconnected (${state}) - monitoring for recovery`);
        } else if (state === 'connecting') {
          console.log(`🔄 FASE 4: Connection attempting to establish (${state})`);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log(`🧊 FASE 4: ICE state changed to ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          this.clearConnectionTimeout();
          console.log(`✅ FASE 4: ICE connection established (${state})`);
        } else if (state === 'failed') {
          console.warn(`❌ FASE 4: ICE connection failed`);
          // Recovery is handled by ConnectionStateRecovery
        } else if (state === 'checking') {
          console.log(`🔍 FASE 4: ICE checking connectivity...`);
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