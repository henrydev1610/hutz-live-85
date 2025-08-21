// ============= Participant WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamLogger } from '@/utils/debug/StreamLogger';

class ParticipantHandshakeManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: { candidate: RTCIceCandidate; timestamp: number; retries: number }[] = [];
  private isOfferInProgress: boolean = false;
  private isPeerConnectionReady: boolean = false;
  private participantId: string | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private candidateFlushTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly CONNECTION_TIMEOUT_MS = 30000;
  private readonly CANDIDATE_BUFFER_TIMEOUT_MS = 5000;
  private readonly MAX_CANDIDATE_RETRIES = 3;
  private hasReconnected: boolean = false;
  private lastConnectionTime: number = 0;
  private handshakeStartTime: number = 0;
  private peerConnectionCreationTime: number = 0;
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
    
    // PHASE 1: EARLY PEERCONNECTION CREATION - Listen for WebRTC offer request from host
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

      // PHASE 1: CREATE PEERCONNECTION IMMEDIATELY BEFORE ANYTHING ELSE
      const pcCreationStart = performance.now();
      await this.createPeerConnectionEarly(hostId);
      const pcCreationDuration = performance.now() - pcCreationStart;
      console.log(`✅ [PARTICIPANT] PeerConnection created early in ${pcCreationDuration.toFixed(1)}ms`);

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

        // PHASE 2: ENHANCED ICE CANDIDATE SYNCHRONIZATION
        if (this.pendingCandidates.length > 0) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Applying ${this.pendingCandidates.length} buffered candidates with enhanced sync`);
          
          const candidatesToFlush = [...this.pendingCandidates];
          this.pendingCandidates = [];
          let appliedCount = 0;
          let failedCount = 0;
          let retriedCount = 0;
          
          for (const candidateEntry of candidatesToFlush) {
            const { candidate, timestamp, retries } = candidateEntry;
            const age = Date.now() - timestamp;
            
            try {
              // PHASE 3: ROBUST STATE VALIDATION
              if (!candidate.candidate || !candidate.sdpMid) {
                console.warn('⚠️ [PARTICIPANT] Invalid candidate format, skipping');
                failedCount++;
                continue;
              }

              // Skip candidates older than timeout
              if (age > this.CANDIDATE_BUFFER_TIMEOUT_MS) {
                console.warn(`⚠️ [PARTICIPANT] Skipping old candidate (age: ${age}ms)`);
                failedCount++;
                continue;
              }
              
              await this.peerConnection.addIceCandidate(candidate);
              appliedCount++;
              console.log(`✅ [PARTICIPANT] ICE candidate applied: ${candidate.candidate.split(' ')[7] || 'unknown'} (age: ${age}ms)`);
            } catch (err) {
              console.error('❌ [PARTICIPANT] Error flushing candidate:', err);
              
              // PHASE 3: RETRY MECHANISM FOR FAILED CANDIDATES
              if (retries < this.MAX_CANDIDATE_RETRIES) {
                console.log(`🔄 [PARTICIPANT] Retrying candidate (attempt ${retries + 1}/${this.MAX_CANDIDATE_RETRIES})`);
                this.pendingCandidates.push({
                  candidate,
                  timestamp,
                  retries: retries + 1
                });
                retriedCount++;
              } else {
                failedCount++;
              }
            }
          }
          console.log(`✅ [PARTICIPANT] ICE candidates processed: ${appliedCount} applied, ${failedCount} failed, ${retriedCount} retried`);
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

      // PHASE 1: EARLY PC CREATION SHOULD HAVE PREVENTED THIS
      if (!this.peerConnection) {
        console.error('❌ [PARTICIPANT] CRITICAL: PC doesn\'t exist even after early creation! Buffering candidate from:', hostId);
        this.bufferCandidateWithTimeout(candidate, hostId);
        return;
      }

      // PHASE 2 & 3: ENHANCED ICE CANDIDATE PROCESSING WITH STATE VALIDATION
      const hasRemoteDesc = this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type;
      const signalingState = this.peerConnection.signalingState;
      const connectionState = this.peerConnection.connectionState;
      
      console.log(`🚨 CRÍTICO [PARTICIPANT] ICE candidate decision:`, {
        hasRemoteDesc: !!hasRemoteDesc,
        signalingState,
        connectionState,
        isPeerConnectionReady: this.isPeerConnectionReady,
        candidateType: candidate.candidate?.includes('host') ? 'host' : 
                      candidate.candidate?.includes('srflx') ? 'srflx' : 'relay'
      });
      
      // PHASE 3: ROBUST STATE VALIDATION - Apply immediately only if PC is fully ready
      const canApplyImmediately = hasRemoteDesc && 
                                 (signalingState === 'stable' || signalingState === 'have-remote-offer') &&
                                 this.isPeerConnectionReady;
      
      if (canApplyImmediately) {
        try {
          // Validate candidate before applying
          if (!candidate.candidate || !candidate.sdpMid) {
            console.warn('⚠️ [PARTICIPANT] Invalid candidate format from host, ignoring');
            return;
          }
          
          await this.peerConnection.addIceCandidate(candidate);
          console.log(`✅ [PARTICIPANT] ICE candidate applied immediately from ${hostId}: ${candidate.candidate.split(' ')[7] || 'unknown'}`);
        } catch (err) {
          console.warn('⚠️ [PARTICIPANT] Error adding immediate candidate:', err);
          // Buffer the candidate for retry
          this.bufferCandidateWithTimeout(candidate, hostId);
        }
      } else {
        console.log(`📦 [PARTICIPANT] ICE candidate buffered from ${hostId} - waiting for proper state`);
        this.bufferCandidateWithTimeout(candidate, hostId);
      }
    });
    
    console.log('✅ [PARTICIPANT] Event handlers configurados com sucesso');
  }

  // PHASE 1: EARLY PEERCONNECTION CREATION - Create PC immediately when offer is requested
  private async createPeerConnectionEarly(hostId: string): Promise<void> {
    const createStartTime = performance.now();
    console.log(`🚨 PHASE 1 [PARTICIPANT] Creating PeerConnection early for: ${hostId}`);
    
    // Close existing PC if any
    if (this.peerConnection) {
      console.log('[PARTICIPANT] Closing existing PC for early creation');
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Reset state
    this.isPeerConnectionReady = false;
    this.pendingCandidates = [];
    this.clearCandidateFlushTimeout();
    
    // Create new PeerConnection with optimized configuration
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    this.peerConnectionCreationTime = performance.now();
    
    // Setup event handlers immediately
    this.setupPeerConnectionEventHandlers(hostId);
    
    // Mark as ready
    this.isPeerConnectionReady = true;
    
    const duration = performance.now() - createStartTime;
    console.log(`✅ PHASE 1 [PARTICIPANT] PeerConnection created early in ${duration.toFixed(1)}ms - Ready for ICE candidates`);
  }

  // PHASE 2: ENHANCED ICE CANDIDATE BUFFERING with timeout and retry logic
  private bufferCandidateWithTimeout(candidate: RTCIceCandidate, hostId: string): void {
    const candidateEntry = {
      candidate,
      timestamp: Date.now(),
      retries: 0
    };
    
    this.pendingCandidates.push(candidateEntry);
    console.log(`📦 PHASE 2 [PARTICIPANT] ICE candidate buffered from ${hostId} (total: ${this.pendingCandidates.length})`);
    
    // Start flush timeout if this is the first candidate
    if (this.pendingCandidates.length === 1) {
      this.setCandidateFlushTimeout();
    }
  }

  // PHASE 3: Setup PeerConnection event handlers
  private setupPeerConnectionEventHandlers(hostId: string): void {
    if (!this.peerConnection) {
      console.error('❌ [PARTICIPANT] Cannot setup handlers - PC is null');
      return;
    }

    console.log(`🔧 PHASE 3 [PARTICIPANT] Setting up PC event handlers for: ${hostId}`);

    // ICE candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateType = event.candidate.candidate?.includes('host') ? 'host' : 
                             event.candidate.candidate?.includes('srflx') ? 'srflx' : 'relay';
        console.log(`🧊 [PARTICIPANT] ICE candidate generated (${candidateType}), sending to host`);
        unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
      } else {
        console.log('🧊 [PARTICIPANT] ICE gathering complete (null candidate)');
      }
    };

    // ICE connection state change handler
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      const elapsed = performance.now() - this.peerConnectionCreationTime;
      console.log(`🧊 [PARTICIPANT] ICE connection state: ${state} (${elapsed.toFixed(1)}ms since PC creation)`);
      
      if (state === 'connected' || state === 'completed') {
        console.log(`✅ [PARTICIPANT] ICE connection established: ${state}`);
        this.clearConnectionTimeout();
      } else if (state === 'failed') {
        console.error(`❌ [PARTICIPANT] ICE connection failed`);
        this.handleConnectionFailure(hostId);
      }
    };

    // Connection state change handler  
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      const elapsed = performance.now() - this.peerConnectionCreationTime;
      console.log(`🔗 [PARTICIPANT] Connection state: ${state} (${elapsed.toFixed(1)}ms since PC creation)`);
      
      if (state === 'connected') {
        console.log(`✅ [PARTICIPANT] WebRTC connection established`);
        this.clearConnectionTimeout();
        this.reconnectAttempts = 0;
        
        // Notify successful connection
        window.dispatchEvent(new CustomEvent('participant-connected', {
          detail: { 
            participantId: this.participantId, 
            hostId,
            timestamp: Date.now(), 
            method: 'early-pc-creation' 
          }
        }));
      } else if (state === 'failed') {
        console.error(`❌ [PARTICIPANT] Connection failed: ${state}`);
        this.handleConnectionFailure(hostId);
      }
    };

    // Signaling state change handler
    this.peerConnection.onsignalingstatechange = () => {
      const state = this.peerConnection?.signalingState;
      console.log(`📡 [PARTICIPANT] Signaling state: ${state}`);
    };

    console.log(`✅ [PARTICIPANT] PC event handlers configured for: ${hostId}`);
  }

  // PHASE 2: Candidate flush timeout management
  private setCandidateFlushTimeout(): void {
    this.clearCandidateFlushTimeout();
    
    this.candidateFlushTimeout = setTimeout(() => {
      if (this.pendingCandidates.length > 0) {
        console.warn(`⚠️ PHASE 2 [PARTICIPANT] Auto-flushing ${this.pendingCandidates.length} buffered candidates after timeout`);
        this.flushBufferedCandidates();
      }
    }, this.CANDIDATE_BUFFER_TIMEOUT_MS);
  }

  private clearCandidateFlushTimeout(): void {
    if (this.candidateFlushTimeout) {
      clearTimeout(this.candidateFlushTimeout);
      this.candidateFlushTimeout = null;
    }
  }

  // PHASE 2 & 3: Enhanced candidate flushing with retry logic
  private async flushBufferedCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingCandidates.length === 0) {
      return;
    }

    console.log(`🔄 PHASE 2 [PARTICIPANT] Flushing ${this.pendingCandidates.length} buffered candidates`);
    
    const candidatesToFlush = [...this.pendingCandidates];
    this.pendingCandidates = [];
    let appliedCount = 0;
    let failedCount = 0;
    let retriedCount = 0;
    
    for (const candidateEntry of candidatesToFlush) {
      const { candidate, timestamp, retries } = candidateEntry;
      const age = Date.now() - timestamp;
      
      try {
        // PHASE 3: Validate candidate and connection state
        if (!candidate.candidate || !candidate.sdpMid) {
          console.warn('⚠️ [PARTICIPANT] Invalid candidate format, skipping');
          failedCount++;
          continue;
        }

        // Skip very old candidates
        if (age > this.CANDIDATE_BUFFER_TIMEOUT_MS * 2) {
          console.warn(`⚠️ [PARTICIPANT] Skipping very old candidate (age: ${age}ms)`);
          failedCount++;
          continue;
        }

        // Check if PC is in suitable state
        const signalingState = this.peerConnection.signalingState;
        const hasRemoteDesc = !!this.peerConnection.remoteDescription;
        
        if (!hasRemoteDesc && signalingState !== 'have-local-offer') {
          console.warn(`⚠️ [PARTICIPANT] PC not ready for candidate (signaling: ${signalingState}, remoteDesc: ${hasRemoteDesc})`);
          
          // Retry later if within retry limit
          if (retries < this.MAX_CANDIDATE_RETRIES) {
            this.pendingCandidates.push({
              candidate,
              timestamp,
              retries: retries + 1
            });
            retriedCount++;
            continue;
          } else {
            failedCount++;
            continue;
          }
        }
        
        await this.peerConnection.addIceCandidate(candidate);
        appliedCount++;
        
        const candidateType = candidate.candidate.includes('host') ? 'host' : 
                             candidate.candidate.includes('srflx') ? 'srflx' : 'relay';
        console.log(`✅ [PARTICIPANT] Buffered candidate applied: ${candidateType} (age: ${age}ms)`);
        
      } catch (err) {
        console.error('❌ [PARTICIPANT] Error applying buffered candidate:', err);
        
        // Retry mechanism
        if (retries < this.MAX_CANDIDATE_RETRIES) {
          console.log(`🔄 [PARTICIPANT] Retrying candidate (attempt ${retries + 1}/${this.MAX_CANDIDATE_RETRIES})`);
          this.pendingCandidates.push({
            candidate,
            timestamp,
            retries: retries + 1
          });
          retriedCount++;
        } else {
          failedCount++;
        }
      }
    }
    
    console.log(`✅ PHASE 2 [PARTICIPANT] Candidate flush complete: ${appliedCount} applied, ${failedCount} failed, ${retriedCount} retried`);
    
    // Set timeout for retried candidates
    if (retriedCount > 0) {
      this.setCandidateFlushTimeout();
    }
  }

  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) {
      console.log('[PARTICIPANT] createAndSendOffer: Offer already in progress, skipping');
      return;
    }

    const offerStartTime = performance.now();
    this.handshakeStartTime = offerStartTime;
    console.log(`🚨 CRÍTICO [PARTICIPANT] Starting offer creation sequence for ${hostId}`);

    // PHASE 4: EVENT ORDER VALIDATION - PC should already exist from early creation
    if (!this.peerConnection || !this.isPeerConnectionReady) {
      console.error('❌ [PARTICIPANT] CRITICAL: PeerConnection not ready for offer creation!');
      throw new Error('PeerConnection not ready for offer creation');
    }

    // Check if PC is in valid state for offer creation
    if (this.peerConnection.signalingState !== 'stable') {
      console.warn('⚠️ [PARTICIPANT] PC not in stable state for offer:', this.peerConnection.signalingState);
      // Try to reset to stable state
      this.peerConnection.close();
      await this.createPeerConnectionEarly(hostId);
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

      // STEP 2: Add tracks to existing peer connection
      const addTrackStartTime = performance.now();
      console.log('🚨 CRÍTICO [PARTICIPANT] Adding tracks to existing RTCPeerConnection...');
      
      // Clear existing tracks first
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          this.peerConnection?.removeTrack(sender);
        }
      });
      
      // Add new tracks
      stream.getTracks().forEach((track, index) => {
        if (this.peerConnection && stream) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Adding track ${index + 1}: ${track.kind} (enabled: ${track.enabled}, readyState: ${track.readyState})`);
          this.peerConnection.addTrack(track, stream);
        }
      });
      const addTrackDuration = performance.now() - addTrackStartTime;
      console.log(`✅ [PARTICIPANT] All tracks added to existing RTCPeerConnection (${addTrackDuration.toFixed(1)}ms)`);

      // Event handlers should already be set up from early PC creation, but ensure they're correct
      if (!this.peerConnection.onicecandidate) {
        this.setupPeerConnectionEventHandlers(hostId);
      }

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
    console.log('🚨 CRÍTICO [PARTICIPANT] Starting signaling state monitoring for have-local-offer');
    
    if (!this.peerConnection) return;
    
    let checkCount = 0;
    const maxChecks = 20; // 10 segundos com checks de 500ms
    
    const signalingMonitor = setInterval(() => {
      checkCount++;
      
      if (!this.peerConnection) {
        clearInterval(signalingMonitor);
        return;
      }
      
      const signalingState = this.peerConnection.signalingState;
      console.log(`🔍 [PARTICIPANT] Signaling check ${checkCount}/${maxChecks}: ${signalingState}`);
      
      if (signalingState === 'stable') {
        console.log('✅ [PARTICIPANT] Signaling state reached stable - monitoring complete');
        clearInterval(signalingMonitor);
        return;
      }
      
      if (signalingState === 'have-local-offer' && checkCount >= maxChecks) {
        console.error('❌ CRÍTICO [PARTICIPANT] Stuck in have-local-offer for >10s - forcing handshake restart');
        clearInterval(signalingMonitor);
        this.handleConnectionFailure(hostId);
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
    this.isPeerConnectionReady = false;
    
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
    this.clearCandidateFlushTimeout();
    this.pendingCandidates = [];
    this.reconnectAttempts = 0;
    this.isPeerConnectionReady = false;
    
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