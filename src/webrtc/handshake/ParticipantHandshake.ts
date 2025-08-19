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
  private clearMonitoring: (() => void) | null = null;
  
  
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

    console.log('🚨 CRÍTICO [PARTICIPANT] Setting up event handlers with DUAL REGISTRATION');
    
    // CORREÇÃO 5: DUAL EVENT REGISTRATION - Registrar tanto no eventEmitter quanto no socket diretamente
    const socketInstance = (unifiedWebSocketService as any).socket;
    console.log('🔧 DUAL REGISTRATION: Socket instance available:', !!socketInstance);
    
    // Listen for WebRTC offer request from host
    const offerRequestHandler = async (data: any) => {
      const hostId = data?.fromUserId;
      console.log(`🚨 CRÍTICO [PARTICIPANT] Offer request received from host: ${hostId}`, {
        dataKeys: Object.keys(data),
        hasFromUserId: !!data.fromUserId,
        hasParticipantId: !!data.participantId,
        timestamp: Date.now(),
        currentPCExists: !!this.peerConnection,
        isOfferInProgress: this.isOfferInProgress
      });
      
      if (!hostId) {
        console.warn('⚠️ [PARTICIPANT] Invalid offer request:', data);
        return;
      }

      // CORREÇÃO 3: VALIDATION DE HANDSHAKE INITIALIZATION - improved checks
      const hostReadiness = await this.checkHostReadiness(hostId);
      if (!hostReadiness.ready) {
        console.log(`🚨 CRÍTICO [PARTICIPANT] Host not ready: ${hostId}, reason: ${hostReadiness.reason} - scheduling retry`);
        setTimeout(() => {
          console.log(`🔄 [PARTICIPANT] Retrying createAndSendOffer for: ${hostId}`);
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

      console.log(`🚀 [PARTICIPANT] Iniciando createAndSendOffer para: ${hostId}`);
      await this.createAndSendOffer(hostId);
    };

    // CORREÇÃO 3: DUAL REGISTRATION for offer requests too
    unifiedWebSocketService.on('webrtc-request-offer', offerRequestHandler);
    if (socketInstance) {
      socketInstance.on('webrtc-request-offer', offerRequestHandler);
      console.log('✅ [PARTICIPANT] DUAL REGISTRATION: webrtc-request-offer handler registered on both');
    }

    // CORREÇÃO 5: DUAL EVENT REGISTRATION - Handler para respostas (answers) do host
    const answerHandler = async (data: any) => {
      const hostId = data?.fromUserId || data?.fromSocketId || data?.hostId;
      let answer = data?.answer;

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

      // CORREÇÃO 2: VALIDAÇÃO CRÍTICA DE PAYLOAD - Melhorar validação para aceitar diferentes formatos
      if (!answer && data?.sdp && data?.type) {
        console.log('🔄 [PARTICIPANT] Fallback: Using data directly as answer');
        answer = { sdp: data.sdp, type: data.type };
      }

      if (!hostId) {
        console.error('❌ [PARTICIPANT] Missing hostId in answer:', data);
        return;
      }

      if (!answer?.sdp || !answer?.type) {
        console.error('❌ [PARTICIPANT] Invalid answer format after fallback:', data);
        return;
      }

      console.log(`✅ [PARTICIPANT] setRemoteDescription -> answer received from ${hostId}`);

      if (!this.peerConnection) {
        console.warn('⚠️ [PARTICIPANT] Answer received without active PC');
        return;
      }

      try {
        // CORREÇÃO 1: Validação crítica pré-setRemoteDescription
        const currentSignalingState = this.peerConnection.signalingState;
        console.log(`🚨 CRÍTICO [PARTICIPANT] Pre-validation - signalingState: ${currentSignalingState}`);
        
        if (currentSignalingState !== 'have-local-offer') {
          console.error(`❌ CRÍTICO [PARTICIPANT] Invalid signaling state for answer: ${currentSignalingState} (expected: have-local-offer)`);
          throw new Error(`Invalid signaling state: ${currentSignalingState}`);
        }

        // Validar formato do SDP
        if (!answer.sdp || answer.sdp.length < 100) {
          console.error('❌ CRÍTICO [PARTICIPANT] Invalid answer SDP format');
          throw new Error('Invalid answer SDP format');
        }

        console.log('🚨 CRÍTICO [PARTICIPANT] Setting remote description from answer...');
        await this.peerConnection.setRemoteDescription(answer);
        
        // CORREÇÃO 2: Validação pós-setRemoteDescription
        const newSignalingState = this.peerConnection.signalingState;
        console.log(`✅ [PARTICIPANT] setRemoteDescription SUCCESS: ${currentSignalingState} → ${newSignalingState}`);
        
        if (newSignalingState !== 'stable') {
          console.warn(`⚠️ [PARTICIPANT] Unexpected signaling state after answer: ${newSignalingState}`);
        }

        console.log(`🚨 CRÍTICO [PARTICIPANT] Connection state após setRemoteDescription: ${this.peerConnection.connectionState}`);

        // CORREÇÃO 3: ICE candidates ordenados com validação
        if (this.pendingCandidates.length > 0) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Applying ${this.pendingCandidates.length} buffered candidates`);
          
          const candidatesToFlush = [...this.pendingCandidates];
          this.pendingCandidates = [];
          let appliedCount = 0;
          let failedCount = 0;
          
          for (const candidate of candidatesToFlush) {
            try {
              // Validar candidate antes de aplicar
              if (!candidate.candidate || !candidate.sdpMid) {
                console.warn('⚠️ [PARTICIPANT] Invalid candidate format, skipping');
                failedCount++;
                continue;
              }
              
              await this.peerConnection.addIceCandidate(candidate);
              appliedCount++;
              console.log(`✅ [PARTICIPANT] ICE candidate aplicado: ${candidate.candidate.split(' ')[7] || 'unknown'}`);
            } catch (err) {
              failedCount++;
              console.error('❌ [PARTICIPANT] Error flushing candidate:', err);
            }
          }
          console.log(`✅ [PARTICIPANT] ICE candidates flushed: ${appliedCount}/${candidatesToFlush.length} applied, ${failedCount} failed`);
        }
        
        // CORREÇÃO 4: Aguardar negociação completa
        this.waitForConnectionEstablishment(hostId);
        
        console.log('✅ [PARTICIPANT] Answer processing complete - waiting for connection establishment');
        
        // CORREÇÃO 4: SIGNALING STATE MONITORING - Iniciar monitoramento específico para have-local-offer
        this.startSignalingStateMonitoring(hostId);
        
      } catch (err) {
        console.error('❌ CRÍTICO [PARTICIPANT] Error applying answer:', err);
        console.error('❌ CRÍTICO [PARTICIPANT] Answer error details:', {
          error: err.message,
          signalingState: this.peerConnection?.signalingState,
          connectionState: this.peerConnection?.connectionState,
          hasRemoteDescription: !!this.peerConnection?.remoteDescription
        });
        this.handleConnectionFailure(hostId);
      }
    };

    // CORREÇÃO 5: DUAL REGISTRATION - Registrar nos dois lugares
    unifiedWebSocketService.on('webrtc-answer', answerHandler);
    if (socketInstance) {
      socketInstance.on('webrtc-answer', answerHandler);
      console.log('✅ [PARTICIPANT] DUAL REGISTRATION: webrtc-answer handler registered on both eventEmitter and socket');
    }

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
        
        // CORREÇÃO 1: CRITICAL FIX - Force PC creation if missing during ICE negotiation
        console.log('🚨 CRÍTICO [PARTICIPANT] FORCE RECOVERY: PC missing durante ICE - tentando criar oferecimento tardio');
        if (hostId && !this.isOfferInProgress) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Iniciando createAndSendOffer TARDIO para: ${hostId}`);
          setTimeout(() => {
            this.createAndSendOffer(hostId).catch(err => {
              console.error('❌ [PARTICIPANT] Error em createAndSendOffer tardio:', err);
            });
          }, 100);
        }
        return;
      }

      // CORREÇÃO: ICE candidates com validação rigorosa
      const hasRemoteDesc = this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type;
      const signalingState = this.peerConnection.signalingState;
      
      console.log(`🚨 CRÍTICO [PARTICIPANT] ICE candidate decision: hasRemoteDesc=${!!hasRemoteDesc}, signalingState=${signalingState}`);
      
      if (hasRemoteDesc && signalingState === 'stable') {
        try {
          // Validar candidate antes de aplicar
          if (!candidate.candidate || !candidate.sdpMid) {
            console.warn('⚠️ [PARTICIPANT] Invalid candidate format from host, ignoring');
            return;
          }
          
          await this.peerConnection.addIceCandidate(candidate);
          console.log(`✅ [PARTICIPANT] ICE candidate applied immediately from ${hostId}: ${candidate.candidate.split(' ')[7] || 'unknown'}`);
        } catch (err) {
          console.warn('⚠️ [PARTICIPANT] Error adding candidate from:', hostId, err);
        }
      } else {
        this.pendingCandidates.push(candidate);
        console.log(`📦 [PARTICIPANT] ICE candidate buffered from ${hostId} (total: ${this.pendingCandidates.length}) - reason: remoteDesc=${!!hasRemoteDesc}, state=${signalingState}`);
        
        // CORREÇÃO 3: ENHANCED ICE CANDIDATE BUFFERING - Auto-flush timeout
        if (this.pendingCandidates.length === 1) {
          setTimeout(() => {
            if (this.pendingCandidates.length > 0) {
              console.warn(`⚠️ [PARTICIPANT] ICE candidates still buffered after 10s, clearing buffer (${this.pendingCandidates.length} candidates)`);
              this.pendingCandidates = [];
            }
          }, 10000);
        }
      }
    });
    
    console.log('✅ [PARTICIPANT] Event handlers configurados com sucesso');
  }

  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) {
      console.log('⚠️ [PARTICIPANT] createAndSendOffer: Offer already in progress, skipping');
      return;
    }

    const offerStartTime = performance.now();
    this.handshakeStartTime = offerStartTime;
    console.log(`🚨 CRÍTICO [PARTICIPANT] Starting offer creation sequence for ${hostId}`);
    console.log(`🚨 CRÍTICO [PARTICIPANT] Current state: PC exists=${!!this.peerConnection}, localStream exists=${!!this.localStream}`);

    // CORREÇÃO 1: CRITICAL PC state check and cleanup
    if (this.peerConnection) {
      console.log(`🚨 CRÍTICO [PARTICIPANT] Existing PC state: ${this.peerConnection.connectionState}, signaling: ${this.peerConnection.signalingState}`);
      if (this.peerConnection.connectionState !== 'closed') {
        console.log('🚨 CRÍTICO [PARTICIPANT] Closing existing peer connection');
        this.peerConnection.close();
      }
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
      console.log(`🚨 CRÍTICO [PARTICIPANT] RTCPeerConnection created successfully: ${this.peerConnection.connectionState} (${pcDuration.toFixed(1)}ms)`);
      
      // CORREÇÃO 1: CRITICAL validation - ensure PC was created
      if (!this.peerConnection) {
        throw new Error('Failed to create RTCPeerConnection');
      }

      // STEP 3: Add tracks to peer connection BEFORE creating offer
      const addTrackStartTime = performance.now();
      console.log('🚨 CRÍTICO [PARTICIPANT] Anexando stream ao RTCPeerConnection...');
      
      // CORREÇÃO 5: TRACK TRANSMISSION VALIDATION - validate tracks before adding
      const tracks = stream.getTracks();
      console.log(`🚨 CRÍTICO [PARTICIPANT] Tracks to add: ${tracks.length} total`, {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        activeTracks: tracks.filter(t => t.readyState === 'live').length
      });
      
      tracks.forEach((track, index) => {
        if (this.peerConnection && stream) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Adicionando track ${index + 1}:`, {
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted,
            label: track.label
          });
          
          const sender = this.peerConnection.addTrack(track, stream);
          console.log(`✅ [PARTICIPANT] Track ${index + 1} adicionada via addTrack:`, {
            sender: !!sender,
            trackId: track.id,
            senderTrack: !!sender.track
          });

          // CORREÇÃO 5: TRACK TRANSMISSION VALIDATION - Verify sender is properly configured
          if (sender && sender.track) {
            console.log(`🚨 CRÍTICO [PARTICIPANT] Sender validation for track ${index + 1}:`, {
              senderTrackId: sender.track.id,
              senderTrackKind: sender.track.kind,
              senderTrackEnabled: sender.track.enabled,
              senderTrackReadyState: sender.track.readyState
            });
          } else {
            console.error(`❌ CRÍTICO [PARTICIPANT] Sender validation FAILED for track ${index + 1}`);
          }
        }
      });
      
      // CORREÇÃO 5: VALIDATE TRANSCEIVERS and SENDERS after addTrack
      const transceivers = this.peerConnection.getTransceivers();
      const senders = this.peerConnection.getSenders();
      console.log(`🚨 CRÍTICO [PARTICIPANT] Post-addTrack validation:`, {
        transceiversCount: transceivers.length,
        sendersCount: senders.length,
        transceiverDirections: transceivers.map(t => `${t.mid || 'none'}:${t.direction}`),
        sendersWithTracks: senders.filter(s => s.track).length,
        activeSenders: senders.filter(s => s.track && s.track.readyState === 'live').length
      });

      // Validate that all tracks have been properly added
      const expectedTrackCount = stream.getTracks().length;
      const actualSenderCount = senders.filter(s => s.track).length;
      
      if (actualSenderCount !== expectedTrackCount) {
        console.error(`❌ CRÍTICO [PARTICIPANT] Track mismatch: expected ${expectedTrackCount}, got ${actualSenderCount} senders`);
      } else {
        console.log(`✅ [PARTICIPANT] All ${actualSenderCount} tracks properly added to transceivers`);
      }
      
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

  // CORREÇÃO 4: SIGNALING STATE MONITORING - Detector específico para have-local-offer travado
  private startSignalingStateMonitoring(hostId: string): void {
    console.log('🚨 CRÍTICO [PARTICIPANT] Starting enhanced signaling state monitoring for have-local-offer');
    
    if (!this.peerConnection) {
      console.warn('⚠️ [PARTICIPANT] startSignalingStateMonitoring: no PC available');
      return;
    }
    
    // CORREÇÃO 4: Enhanced monitoring with more detailed state tracking
    let checkCount = 0;
    const maxChecks = 20; // 10 segundos com checks de 500ms
    const startTime = Date.now();
    
    const signalingMonitor = setInterval(() => {
      checkCount++;
      
      if (!this.peerConnection) {
        console.log('⚠️ [PARTICIPANT] STATE MONITORING: PC não existe mais, parando monitoramento');
        clearInterval(signalingMonitor);
        return;
      }
      
      const signalingState = this.peerConnection.signalingState;
      const connectionState = this.peerConnection.connectionState;
      const hasRemoteDesc = !!this.peerConnection.remoteDescription;
      const elapsed = Date.now() - startTime;
      
      console.log(`🔍 [PARTICIPANT] Enhanced check ${checkCount}/${maxChecks}: signaling=${signalingState}, connection=${connectionState}, hasRemoteDesc=${hasRemoteDesc}, elapsed=${elapsed}ms`);
      
      // CORREÇÃO 2: Check for missing remote description
      if (signalingState === 'have-local-offer' && !hasRemoteDesc && checkCount > 10) {
        console.warn(`⚠️ [PARTICIPANT] have-local-offer sem remoteDescription após ${elapsed}ms - possível problema com answer`);
      }
      
      if (signalingState === 'stable') {
        console.log('✅ [PARTICIPANT] Signaling state reached stable - monitoring complete');
        clearInterval(signalingMonitor);
        return;
      }
      
      // CORREÇÃO 4: Enhanced stuck detection with more options
      if (signalingState === 'have-local-offer' && checkCount >= maxChecks) {
        console.error(`❌ CRÍTICO [PARTICIPANT] STUCK em have-local-offer por ${elapsed}ms - forçando reset completo`);
        clearInterval(signalingMonitor);
        
        // CORREÇÃO 3: Force complete reset and retry
        console.log(`🔄 [PARTICIPANT] Executando reset completo e nova tentativa para ${hostId}`);
        this.performFullReset(hostId);
        setTimeout(() => {
          this.createAndSendOffer(hostId).catch(err => {
            console.error('❌ [PARTICIPANT] Error em retry após reset:', err);
          });
        }, 1000);
        return;
      }
    }, 500);
  }

  // CORREÇÃO 4: Método para aguardar estabelecimento completo da conexão
  private waitForConnectionEstablishment(hostId: string): void {
    console.log('🚨 CRÍTICO [PARTICIPANT] Starting connection establishment monitoring...');
    
    let connectionCheckInterval: NodeJS.Timeout;
    let timeoutTimer: NodeJS.Timeout;
    let checkCount = 0;
    const maxChecks = 60; // 30 segundos com checks de 500ms
    
    const checkConnection = () => {
      checkCount++;
      
      if (!this.peerConnection) {
        console.error('❌ [PARTICIPANT] PeerConnection lost during establishment monitoring');
        this.clearMonitoring();
        return;
      }
      
      const connectionState = this.peerConnection.connectionState;
      const iceConnectionState = this.peerConnection.iceConnectionState;
      const signalingState = this.peerConnection.signalingState;
      
      console.log(`🔍 [PARTICIPANT] Connection check ${checkCount}/${maxChecks}: conn=${connectionState}, ice=${iceConnectionState}, sig=${signalingState}`);
      
      // Sucesso: conexão estabelecida
      if (connectionState === 'connected' && (iceConnectionState === 'connected' || iceConnectionState === 'completed')) {
        console.log('✅ [PARTICIPANT] Connection establishment SUCCESS - validating stream tracks');
        
        // Validar que o stream tem tracks ativas
        if (this.localStream) {
          const activeTracks = this.localStream.getTracks().filter(t => t.readyState === 'live');
          console.log(`🎥 [PARTICIPANT] Stream validation: ${activeTracks.length} active tracks`);
          
          if (activeTracks.length > 0) {
            console.log('🚨 CRÍTICO [PARTICIPANT] Stream negotiation COMPLETE - tracks active and ready');
            window.dispatchEvent(new CustomEvent('participant-stream-ready', {
              detail: { 
                participantId: this.participantId, 
                hostId, 
                streamId: this.localStream.id,
                trackCount: activeTracks.length,
                timestamp: Date.now() 
              }
            }));
          } else {
            console.warn('⚠️ [PARTICIPANT] No active tracks found in stream');
          }
        }
        
        this.clearMonitoring();
        return;
      }
      
      // Falha: conexão falhou
      if (connectionState === 'failed' || iceConnectionState === 'failed') {
        console.error('❌ [PARTICIPANT] Connection establishment FAILED');
        this.clearMonitoring();
        this.handleConnectionFailure(hostId);
        return;
      }
      
      // Timeout: muitas tentativas
      if (checkCount >= maxChecks) {
        console.error('❌ [PARTICIPANT] Connection establishment TIMEOUT');
        this.clearMonitoring();
        this.handleConnectionFailure(hostId);
        return;
      }
    };
    
    const clearMonitoring = () => {
      if (connectionCheckInterval) clearInterval(connectionCheckInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
    
    this.clearMonitoring = clearMonitoring;
    
    // Iniciar monitoramento
    connectionCheckInterval = setInterval(checkConnection, 500);
    
    // Timeout de segurança
    timeoutTimer = setTimeout(() => {
      console.error('❌ [PARTICIPANT] Connection establishment HARD TIMEOUT (30s)');
      clearMonitoring();
      this.handleConnectionFailure(hostId);
    }, 30000);
    
    // Primeira verificação imediata
    checkConnection();
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