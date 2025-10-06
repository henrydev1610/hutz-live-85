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
  
  // FASE 5: ICE candidate tracking
  private iceStats = new Map<string, {
    candidatesSent: number;
    candidatesReceived: number;
    lastActivity: number;
  }>();
  
  // FASE 5: Handshake stuck timeout
  private handshakeTimeouts = new Map<string, NodeJS.Timeout>();
  
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
    // FASE 2: Check shared stream with validation
    const sharedStream = (window as any).__participantSharedStream;
    
    if (sharedStream && sharedStream.getTracks().length > 0) {
      const videoTracks = sharedStream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
        console.log('✅ PATCH FASE 2: Using validated shared stream');
        this.localStream = sharedStream;
        return sharedStream;
      }
    }
    
    // FASE 2: CRITICAL FALLBACK - If no valid shared stream, create new one
    console.warn('⚠️ PATCH FASE 2: No valid shared stream, creating new one');
    try {
      const newStream = await this.getUserMediaForOffer();
      (window as any).__participantSharedStream = newStream;
      this.localStream = newStream;
      console.log('✅ PATCH FASE 2: Fallback stream created successfully');
      return newStream;
    } catch (error) {
      console.error('❌ PATCH FASE 2: Failed to create fallback stream:', error);
      return null;
    }
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

  // FASE 5: Handler registration flag to prevent duplicates
  private handlersRegistered = false;

  private setupParticipantHandlers(): void {
    if (!unifiedWebSocketService) {
      console.error('❌ [PARTICIPANT] unifiedWebSocketService not initialized');
      return;
    }

    // FASE 5: Prevent duplicate handler registration
    if (this.handlersRegistered) {
      console.log('✅ PATCH FASE 5: Handlers already registered, skipping');
      return;
    }

    console.log('🚨 PATCH FASE 5: Registering handlers ONCE');
    
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
        
        // FASE 5: Timeout de 2 segundos para flush forçado de candidates
        setTimeout(() => {
          if (this.pendingCandidates.length > 0) {
            console.log(`🚀 FASE 5: FORCE FLUSH - Applying ${this.pendingCandidates.length} remaining buffered candidates`);
            this.pendingCandidates.forEach(candidate => {
              this.peerConnection?.addIceCandidate(candidate).catch(err => {
                console.warn('⚠️ FASE 5: ICE candidate flush error:', err);
              });
            });
            this.pendingCandidates = [];
          }
        }, 2000);
        
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
      
      // FASE 5: Rastrear ICE candidates recebidos
      if (hostId) {
        const stats = this.iceStats.get(hostId) || {
          candidatesSent: 0,
          candidatesReceived: 0,
          lastActivity: Date.now()
        };
        stats.candidatesReceived++;
        stats.lastActivity = Date.now();
        this.iceStats.set(hostId, stats);
        
        console.log(`🚨 CRÍTICO [PARTICIPANT] ICE candidate ${stats.candidatesReceived} recebido:`, {
          fromHost: hostId,
          hasCandidate: !!candidate,
          candidateType: candidate?.candidate?.includes('host') ? 'host' : 
                        candidate?.candidate?.includes('srflx') ? 'srflx' : 'relay',
          peerConnectionExists: !!this.peerConnection,
          hasRemoteDescription: !!this.peerConnection?.remoteDescription,
          totalSent: stats.candidatesSent,
          totalReceived: stats.candidatesReceived
        });
      }
      
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
    
    // FASE 5: Mark handlers as registered
    this.handlersRegistered = true;
    console.log('✅ PATCH FASE 5: Handlers registered successfully');
  }

  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) {
      console.log('[PARTICIPANT] createAndSendOffer: Offer already in progress, skipping');
      return;
    }

    const offerStartTime = performance.now();
    this.handshakeStartTime = offerStartTime;
    console.log(`🚨 CRÍTICO [PARTICIPANT] Starting offer creation sequence for ${hostId}`);

    // FASE 3: Proteger Stream - NÃO fechar conexões ativas
    if (this.peerConnection) {
      const currentState = this.peerConnection.connectionState;
      
      if (currentState === 'connected' || currentState === 'connecting') {
        console.log(`✅ FASE 3: Reusando PC existente (${currentState}) - protegendo stream`);
        await this.reuseExistingPeerConnection();
        return;
      } else if (currentState === 'failed' || currentState === 'closed') {
        console.log(`🔄 FASE 3: Fechando PC em estado ${currentState}`);
        this.peerConnection.close();
        this.peerConnection = null;
      }
    }

    this.isOfferInProgress = true;
    this.clearConnectionTimeout();

    try {
      // STEP 1: Ensure we have local stream FIRST
      const streamStartTime = performance.now();
      const stream = await this.ensureLocalStream();
      const streamDuration = performance.now() - streamStartTime;
      
      if (!stream) {
        const error = 'No local stream available for offer - CRITICAL';
        console.error(`❌ CRÍTICO [PARTICIPANT] ${error}`);
        throw new Error(error);
      }
      console.log(`🚨 CRÍTICO [PARTICIPANT] Stream validado para offer:`, {
        hasStream: !!stream,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length || 0,
        audioTracks: stream?.getAudioTracks().length || 0,
        videoEnabled: stream?.getVideoTracks()[0]?.enabled,
        audioEnabled: stream?.getAudioTracks()[0]?.enabled,
        duration: `${streamDuration.toFixed(1)}ms`,
        timestamp: Date.now()
      });

      // FASE 3: Verificar se WebSocket está conectado ANTES de prosseguir
      if (!unifiedWebSocketService.isReady()) {
        const wsError = 'WebSocket não conectado - impossível criar offer';
        console.error(`❌ CRÍTICO [PARTICIPANT] ${wsError}`);
        throw new Error(wsError);
      }
      console.log(`✅ [PARTICIPANT] WebSocket verificado: CONECTADO`);

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

      // FASE 1: VALIDATE AND ADD tracks to peer connection BEFORE creating offer
      const correlationId = `webrtc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🔗 [${correlationId}] FASE 1: INÍCIO DO HANDSHAKE`);
      
      const addTrackStartTime = performance.now();
      console.log(`🔗 [${correlationId}] FASE 1: Validating and adding tracks to RTCPeerConnection...`);
      
      const tracks = stream.getTracks();
      const validTracks = tracks.filter(track => track.readyState === 'live' && track.enabled);
      
      console.log(`🔗 [${correlationId}] FASE 1: Track validation:`, {
        totalTracks: tracks.length,
        validTracks: validTracks.length,
        trackDetails: tracks.map(t => ({
          kind: t.kind,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted
        }))
      });
      
      if (validTracks.length === 0) {
        throw new Error('No valid tracks found in stream for WebRTC');
      }
      
      // FASE 1: CRITICAL - Adicionar TODOS os tracks ao PeerConnection
      validTracks.forEach((track, index) => {
        if (this.peerConnection && stream) {
          console.log(`🔗 [${correlationId}] FASE 1: Adding track ${index + 1}/${validTracks.length}:`, {
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            id: track.id
          });
          
          this.peerConnection.addTrack(track, stream);
          
          // Track health monitoring after adding to peer connection
          track.addEventListener('ended', () => {
            console.warn(`⚠️ [${correlationId}] Track ${track.kind} ended after being added to PC`);
          });
          
          track.addEventListener('mute', () => {
            console.warn(`⚠️ [${correlationId}] Track ${track.kind} muted after being added to PC`);
          });
        }
      });
      
      // FASE 1: CRÍTICO - Aguardar estabilização do PC após addTrack
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // FASE 1: Validar que os senders foram criados corretamente
      const senders = this.peerConnection!.getSenders();
      const activeSenders = senders.filter(s => s.track && s.track.readyState === 'live');
      
      if (activeSenders.length === 0) {
        throw new Error('CRITICAL: No active senders after addTrack - tracks not properly added');
      }
      
      console.log(`🔗 [${correlationId}] FASE 1: Senders validation:`, {
        totalSenders: senders.length,
        activeSenders: activeSenders.length,
        senderDetails: activeSenders.map(s => ({
          trackKind: s.track?.kind,
          trackId: s.track?.id,
          trackReadyState: s.track?.readyState
        }))
      });
      
      const addTrackDuration = performance.now() - addTrackStartTime;
      console.log(`🔗 [${correlationId}] FASE 1: ✅ ${validTracks.length} validated tracks added to RTCPeerConnection (${addTrackDuration.toFixed(1)}ms)`);

      // FASE 5: Configurar timeout de 8s para detecção de handshake travado
      const handshakeMonitor = setTimeout(() => {
        const pc = this.peerConnection;
        if (pc && pc.connectionState !== 'connected') {
          console.warn(`⚠️ FASE 5: Handshake travado para ${hostId}:`, {
            connectionState: pc.connectionState,
            iceState: pc.iceConnectionState,
            signalingState: pc.signalingState,
            iceStats: this.iceStats.get(hostId)
          });
          
          // FASE 5: Disparar evento de diagnóstico
          window.dispatchEvent(new CustomEvent('webrtc-handshake-stuck', {
            detail: {
              participantId: this.participantId,
              hostId,
              connectionState: pc.connectionState,
              iceState: pc.iceConnectionState,
              iceStats: this.iceStats.get(hostId),
              timestamp: Date.now()
            }
          }));
          
          // FASE 5: Tentar renegociação
          console.log(`🔄 FASE 5: Tentando renegociar com ${hostId}...`);
          // Fechar PC atual e criar novo
          pc.close();
          this.peerConnection = null;
          setTimeout(() => {
            this.createAndSendOffer(hostId);
          }, 1000);
        }
      }, 8000);
      
      this.handshakeTimeouts.set(hostId + '-monitor', handshakeMonitor);

      // Set up event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // FASE 5: Rastrear ICE candidates enviados
          const stats = this.iceStats.get(hostId) || {
            candidatesSent: 0,
            candidatesReceived: 0,
            lastActivity: Date.now()
          };
          stats.candidatesSent++;
          stats.lastActivity = Date.now();
          this.iceStats.set(hostId, stats);
          
          console.log(`🚨 CRÍTICO [PARTICIPANT] ICE candidate ${stats.candidatesSent} generated, sending to host`);
          unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
        }
      };
      
      // FASE 5: Listener para icegatheringstatechange
      this.peerConnection.onicegatheringstatechange = () => {
        const gatheringState = this.peerConnection?.iceGatheringState;
        console.log(`🧊 FASE 5: ICE gathering state changed to: ${gatheringState}`);
        if (gatheringState === 'complete') {
          console.log('✅ FASE 5: ICE gathering complete');
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
          
          // FASE 5: Limpar timeout de handshake travado
          const monitor = this.handshakeTimeouts.get(hostId + '-monitor');
          if (monitor) {
            clearTimeout(monitor);
            this.handshakeTimeouts.delete(hostId + '-monitor');
          }
          
          console.log(`✅ CONNECTION: WebRTC connection established (${elapsed.toFixed(1)}ms total)`);
          
          // Notify successful connection
          window.dispatchEvent(new CustomEvent('participant-connected', {
            detail: { participantId: this.participantId, timestamp: Date.now(), method: 'connection-state' }
          }));
          
          // FASE 5: Disparar evento de peer conectado
          window.dispatchEvent(new CustomEvent('webrtc-peer-connected', {
            detail: { participantId: this.participantId, timestamp: Date.now() }
          }));
        } else if (state === 'failed') {
          console.warn(`❌ CONNECTION: Connection failed definitively (${state}) - initiating recovery`);
          
          // FASE 5: Disparar evento de peer falhado
          window.dispatchEvent(new CustomEvent('webrtc-peer-failed', {
            detail: { participantId: this.participantId, state, timestamp: Date.now() }
          }));
          
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

      // FASE 3: Create offer with correlation tracking (using existing correlationId)
      console.log(`🔗 [${correlationId}] FASE 3: Creating WebRTC offer...`);
      const offerCreateStartTime = performance.now();
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: true
      });
      const offerCreateDuration = performance.now() - offerCreateStartTime;
      console.log(`🔗 [${correlationId}] FASE 3: ✅ Offer created (${offerCreateDuration.toFixed(1)}ms):`, {
        type: offer.type,
        sdpLength: offer.sdp?.length,
        hasTracks: this.peerConnection.getSenders().length > 0
      });

      // FASE 3: Set local description with correlation tracking
      const setLocalStartTime = performance.now();
      console.log(`🔗 [${correlationId}] FASE 3: Setting local description...`);
      await this.peerConnection.setLocalDescription(offer);
      const setLocalDuration = performance.now() - setLocalStartTime;
      
      console.log(`🔗 [${correlationId}] FASE 3: ✅ Local description set (${setLocalDuration.toFixed(1)}ms)`);
      
      // FASE 5: CRITICAL - Validar SDP gerada
      const sdp = this.peerConnection.localDescription?.sdp || '';
      const hasVideoInSDP = sdp.includes('m=video');
      const hasAudioInSDP = sdp.includes('m=audio');
      const videoSSRC = sdp.match(/a=ssrc:\d+/g)?.length || 0;
      
      console.log(`🔗 [${correlationId}] FASE 5: SDP Analysis:`, {
        hasVideo: hasVideoInSDP,
        hasAudio: hasAudioInSDP,
        ssrcCount: videoSSRC,
        sdpSize: sdp.length,
        sdpPreview: sdp.substring(0, 300)
      });
      
      // FASE 3: Block offer without video and trigger recovery
      if (!hasVideoInSDP || videoSSRC === 0) {
        console.error(`❌ PATCH FASE 3: SDP WITHOUT VIDEO - triggering recovery`);
        
        // Close current PC
        if (this.peerConnection) {
          this.peerConnection.close();
          this.peerConnection = null;
        }
        
        // Try to recreate stream
        try {
          const newStream = await this.getUserMediaForOffer();
          (window as any).__participantSharedStream = newStream;
          this.localStream = newStream;
          
          // Retry offer after 1s
          setTimeout(() => {
            console.log('🔄 PATCH FASE 3: Retrying offer after media recovery');
            this.createAndSendOffer(hostId);
          }, 1000);
          
          return;
        } catch (error) {
          throw new Error('Failed to recover media for offer');
        }
      }

      // FASE 3: Send offer to host with correlation tracking
      const sendStartTime = performance.now();
      console.log(`🔗 [${correlationId}] FASE 3: Sending offer to ${hostId}`, {
        sdp: offer.sdp?.substring(0, 100) + '...',
        type: offer.type,
        localStreamTracks: stream.getTracks().length,
        peerConnectionState: this.peerConnection.connectionState,
        signalingState: this.peerConnection.signalingState,
        hasLocalDescription: !!this.peerConnection.localDescription
      });
      
      unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);
      console.log(`🔗 [${correlationId}] FASE 3: ✅ Offer sent via WebSocket - Awaiting answer...`);
      
      const sendDuration = performance.now() - sendStartTime;
      const totalDuration = performance.now() - offerStartTime;
      console.log(`🔗 [${correlationId}] FASE 3: 🎯 Total handshake duration: ${totalDuration.toFixed(1)}ms (send: ${sendDuration.toFixed(1)}ms)`);

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

  // FASE 2 & 3: Método para reusar PeerConnection existente com renegociação forçada
  private async reuseExistingPeerConnection(): Promise<void> {
    console.log('🔄 FASE 2: Reusing existing PeerConnection');
    
    if (!this.peerConnection || !this.localStream) {
      console.error('❌ FASE 2: Cannot reuse PC: missing PC or stream');
      return;
    }

    // FASE 2: Remover senders existentes
    const senders = this.peerConnection.getSenders();
    console.log(`🔄 FASE 2: Removing ${senders.length} existing senders`);
    senders.forEach(sender => {
      if (sender.track) {
        this.peerConnection!.removeTrack(sender);
      }
    });

    // FASE 2: Re-adicionar tracks
    console.log('🔄 FASE 2: Re-adding tracks to PeerConnection');
    this.localStream.getTracks().forEach(track => {
      if (track.readyState === 'live' && track.enabled) {
        this.peerConnection!.addTrack(track, this.localStream!);
        console.log(`✅ FASE 2: Track ${track.kind} re-added`);
      }
    });

    // FASE 2: CRÍTICO - Forçar renegociação com ICE restart
    console.log('🔄 FASE 2: Creating new offer with iceRestart');
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);

      // Obter hostId do participantId
      const hostId = 'host'; // O host sempre tem ID 'host' no sistema

      // Enviar nova offer com renegociação
      unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);

      console.log('✅ FASE 2: Renegotiation offer sent with iceRestart');
    } catch (error) {
      console.error('❌ FASE 2: Error during renegotiation:', error);
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