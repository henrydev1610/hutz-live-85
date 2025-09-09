// ============= Participant WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamLogger } from '@/utils/debug/StreamLogger';
import { preAllocatedTransceivers } from '@/utils/webrtc/PreAllocatedTransceivers';
import { politePeerManager } from '@/utils/webrtc/PolitePeerManager';

class ParticipantHandshakeManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private isOfferInProgress: boolean = false;
  private participantId: string | null = null;
  private isRemoteDescriptionSet: boolean = false;
  private isProcessingAnswer: boolean = false;
  private handshakeStartTime: number = 0;
  private retryAttempts: number = 0;
  private maxRetries: number = 3;
  private readonly HANDSHAKE_TIMEOUT = 15000; // 15s timeout

  async initializeOnRouteLoad(): Promise<MediaStream | null> {
    console.log('🚨 CRÍTICO [PARTICIPANT] Route loading - initializing participant handshake');
    
    try {
      this.handshakeStartTime = performance.now();
      
      // Initialize polite peer as polite (participant is polite by default)
      // Note: politePeerManager is initialized as polite by default in constructor
      
      // Get user media for the participant
      const stream = await this.getUserMediaForOffer();
      console.log(`✅ [PARTICIPANT] Local stream acquired on route load: ${stream.id}`);
      
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('❌ [PARTICIPANT] Failed to initialize on route load:', error);
      return null;
    }
  }

  setParticipantId(id: string): void {
    this.participantId = id;
    console.log(`✅ [PARTICIPANT] ID set: ${id}`);
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async getUserMediaForOffer(): Promise<MediaStream> {
    try {
      console.log('🚨 CRÍTICO [PARTICIPANT] Requesting getUserMedia...');
      const startTime = performance.now();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      const duration = performance.now() - startTime;
      console.log(`✅ [PARTICIPANT] getUserMedia successful (${duration.toFixed(1)}ms):`, {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackDetails: stream.getVideoTracks().map(t => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        }))
      });

      return stream;
    } catch (error) {
      console.error('❌ [PARTICIPANT] getUserMedia failed:', error);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    // Handle answer from host
    unifiedWebSocketService.on('webrtc-answer', async (data: any) => {
      const hostId = data?.hostId || data?.fromUserId || data?.fromSocketId;
      const answer = data?.answer;
      
      console.log('🚨 CRÍTICO [PARTICIPANT] webrtc-answer received:', {
        fromHost: hostId,
        hasAnswer: !!answer,
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

      // POLITE PEER: Check if should ignore answer
      if (politePeerManager.shouldIgnoreAnswer(this.participantId!)) {
        console.log('🚨 [PARTICIPANT] Ignoring answer due to polite peer logic');
        return;
      }

      try {
        console.log('🚨 CRÍTICO [PARTICIPANT] Setting remote description from answer...', {
          answerType: answer.type,
          bufferedCandidates: this.pendingCandidates.length,
          connectionState: this.peerConnection.connectionState
        });
        
        this.isProcessingAnswer = true;
        await this.peerConnection.setRemoteDescription(answer);
        this.isRemoteDescriptionSet = true;
        this.isProcessingAnswer = false;
        
        console.log('✅ [PARTICIPANT] Remote description set successfully');
        console.log(`🚨 CRÍTICO [PARTICIPANT] Connection state após setRemoteDescription: ${this.peerConnection.connectionState}`);

        // CRÍTICO: Flush buffered ICE candidates APÓS setRemoteDescription estar completo
        if (this.pendingCandidates.length > 0) {
          console.log(`🚨 CRÍTICO [PARTICIPANT] Flushing ${this.pendingCandidates.length} buffered candidates sequentially...`);
          
          const candidatesToFlush = [...this.pendingCandidates];
          this.pendingCandidates = [];
          
          // Process sequentially with small delays
          for (let i = 0; i < candidatesToFlush.length; i++) {
            const candidate = candidatesToFlush[i];
            try {
              await this.peerConnection.addIceCandidate(candidate);
              console.log(`✅ [PARTICIPANT] ICE candidate ${i+1}/${candidatesToFlush.length} aplicado do buffer`);
              
              // Small delay to prevent overwhelming the connection
              if (i < candidatesToFlush.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
              }
            } catch (err) {
              console.error(`❌ [PARTICIPANT] Error flushing candidate ${i+1}:`, err);
            }
          }
          console.log('✅ [PARTICIPANT] Buffer de ICE candidates limpo completamente');
        }
        
        console.log('🎯 [PARTICIPANT] Answer processing complete, ready for new ICE candidates');
      } catch (err) {
        console.error('❌ CRÍTICO [PARTICIPANT] Error applying answer:', err);
        this.isProcessingAnswer = false;
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

      // CRÍTICO: Buffer candidates if remote description not set OR still processing answer
      if (!this.isRemoteDescriptionSet || this.isProcessingAnswer) {
        this.pendingCandidates.push(candidate);
        console.log(`📦 [PARTICIPANT] ICE candidate buffered from ${hostId}`, {
          remoteDescSet: this.isRemoteDescriptionSet,
          processingAnswer: this.isProcessingAnswer,
          bufferSize: this.pendingCandidates.length,
          candidate: candidate.candidate
        });
      } else {
        // Apply candidate immediately
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log(`✅ [PARTICIPANT] ICE candidate aplicado imediatamente de ${hostId}`);
        } catch (err) {
          console.error(`❌ [PARTICIPANT] Error applying immediate candidate from ${hostId}:`, err);
        }
      }
    });

    // Handle offer requests from host
    unifiedWebSocketService.on('webrtc-request-offer', (data: any) => {
      const hostId = data?.hostId || data?.fromSocketId;
      console.log(`🚨 CRÍTICO [PARTICIPANT] Host ${hostId} requesting offer - starting handshake`);
      
      if (hostId) {
        this.createAndSendOffer(hostId);
      } else {
        console.error('❌ [PARTICIPANT] No hostId in offer request');
      }
    });

    console.log('✅ [PARTICIPANT] WebSocket handlers configured');
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

    try {
      this.isOfferInProgress = true;
      
      // STEP 1: Get or validate local stream
      const stream = this.localStream || await this.getUserMediaForOffer();
      if (!stream || stream.getTracks().length === 0) {
        throw new Error('No valid stream available for offer creation');
      }
      
      this.localStream = stream;
      console.log(`✅ [PARTICIPANT] Local stream validated: ${stream.getTracks().length} tracks`);

      // STEP 2: Create peer connection with fixed transceivers
      const pcStartTime = performance.now();
      
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      
      // CRÍTICO: Pré-alocar transceivers em ordem fixa ANTES de qualquer negociação
      preAllocatedTransceivers.initializeTransceivers(this.participantId!, this.peerConnection, 'participant');
      
      // Initialize polite peer state
      politePeerManager.initializePeerState(this.participantId!);

      const pcDuration = performance.now() - pcStartTime;
      console.log(`🚨 CRÍTICO [PARTICIPANT] RTCPeerConnection created with pre-allocated transceivers (${pcDuration.toFixed(1)}ms)`);

      // STEP 3: Replace track in pre-allocated transceiver
      console.log(`🚨 CRÍTICO [PARTICIPANT] Using pre-allocated transceiver for video track`);
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in stream');
      }

      // Validate video track before using
      if (videoTrack.readyState !== 'live' || !videoTrack.enabled) {
        console.warn(`⚠️ [PARTICIPANT] Video track not ready:`, {
          readyState: videoTrack.readyState,
          enabled: videoTrack.enabled,
          muted: videoTrack.muted
        });

        // Try to fix track state
        if (!videoTrack.enabled) {
          videoTrack.enabled = true;
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Wait for track to be ready or recapture
        if (videoTrack.readyState !== 'live') {
          console.log(`⏳ [PARTICIPANT] Waiting 2s for video track to be ready...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (videoTrack.readyState === 'ended') {
            console.warn(`⚠️ [PARTICIPANT] Video track still not ready, attempting recapture`);
            try {
              const recaptureStream = await navigator.mediaDevices.getUserMedia({ video: true });
              const newVideoTrack = recaptureStream.getVideoTracks()[0];
              if (newVideoTrack && newVideoTrack.readyState === 'live') {
                console.log(`✅ [PARTICIPANT] Video track recaptured successfully`);
                stream.removeTrack(videoTrack);
                stream.addTrack(newVideoTrack);
                videoTrack.stop();
                // Use the new track
                await preAllocatedTransceivers.replaceVideoTrack(this.participantId!, newVideoTrack);
              } else {
                throw new Error('Recaptured video track is not ready');
              }
            } catch (recaptureError) {
              console.error(`❌ [PARTICIPANT] Video recapture failed:`, recaptureError);
              throw recaptureError;
            }
          } else {
            // Original track is now ready, use it
            await preAllocatedTransceivers.replaceVideoTrack(this.participantId!, videoTrack);
          }
        } else {
          // Track is live, use it
          await preAllocatedTransceivers.replaceVideoTrack(this.participantId!, videoTrack);
        }
      } else {
        // Track is ready, use it directly
        await preAllocatedTransceivers.replaceVideoTrack(this.participantId!, videoTrack);
      }

      console.log(`✅ [PARTICIPANT] Video track assigned to pre-allocated transceiver`);

      // Set up negotiation handler AFTER track replacement
      this.peerConnection.onnegotiationneeded = async () => {
        // POLITE PEER: Só criar offer se connection está stable
        if (!politePeerManager.canCreateOffer(this.participantId!, this.peerConnection!)) {
          console.log('🚨 CRÍTICO [PARTICIPANT] Cannot create offer - signaling not stable or already making offer');
          return;
        }

        if (this.isOfferInProgress) {
          console.log('🚨 CRÍTICO [PARTICIPANT] Offer já em progresso, ignorando negotiation');
          return;
        }

        console.log('🚨 CRÍTICO [PARTICIPANT] onnegotiationneeded disparado - criando offer via polite peer');
        
        try {
          politePeerManager.setMakingOffer(this.participantId!, true);
          
          const offerStartTime = performance.now();
          
          // CRÍTICO: Sem offerToReceive* flags (Unified Plan)
          const offer = await this.peerConnection!.createOffer();

          const offerCreateDuration = performance.now() - offerStartTime;
          
          const setLocalStartTime = performance.now();
          await this.peerConnection!.setLocalDescription(offer);
          const setLocalDuration = performance.now() - setLocalStartTime;

          console.log(`✅ [PARTICIPANT] createOffer (${offerCreateDuration.toFixed(1)}ms) -> setLocalDescription (${setLocalDuration.toFixed(1)}ms)`);
          
          // Validate transceiver order
          preAllocatedTransceivers.validateTransceiverOrder(this.participantId!, this.peerConnection!);
          
          // Enhanced SDP validation
          if (offer.sdp && offer.sdp.includes('m=video')) {
            console.log(`✅ [PARTICIPANT] Offer contém m=video - stream presente no SDP`);
          } else {
            console.warn(`⚠️ [PARTICIPANT] Offer não contém m=video - possível problema com stream`);
          }

          unifiedWebSocketService.sendWebRTCOffer('host', offer.sdp!, offer.type!);
          console.log(`✅ [PARTICIPANT] Offer sent to host com transceivers pré-alocados`);
          
        } catch (error) {
          console.error('❌ CRÍTICO [PARTICIPANT] Error in negotiation:', error);
          this.handleConnectionFailure('host');
        } finally {
          politePeerManager.setMakingOffer(this.participantId!, false);
        }
      };

      // Set up connection event handlers
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log(`🔗 [PARTICIPANT] Connection state: ${state}`);
        
        if (state === 'connected') {
          const duration = performance.now() - this.handshakeStartTime;
          console.log(`✅ [PARTICIPANT] WebRTC connected successfully (${duration.toFixed(0)}ms total)`);
          this.retryAttempts = 0; // Reset on success
        } else if (state === 'failed') {
          console.log(`❌ [PARTICIPANT] Connection failed for ${hostId}`);
          this.handleConnectionFailure(hostId);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection?.iceConnectionState;
        console.log(`❄️ [PARTICIPANT] ICE connection state: ${iceState}`);
        
        if (iceState === 'failed') {
          console.log(`❌ [PARTICIPANT] ICE connection failed`);
          this.handleConnectionFailure(hostId);
        }
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[PARTICIPANT] Sending ICE candidate to host');
          unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
        } else {
          console.log('[PARTICIPANT] ICE gathering complete');
        }
      };

      // Set up WebSocket handlers
      this.setupWebSocketHandlers();

      // Trigger negotiation (will use pre-allocated transceivers)
      console.log('🚨 CRÍTICO [PARTICIPANT] Triggering negotiation with pre-allocated transceivers');

    } catch (error) {
      console.error('❌ CRÍTICO [PARTICIPANT] Error in createAndSendOffer:', error);
      this.isOfferInProgress = false;
      this.handleConnectionFailure(hostId);
    } finally {
      // Don't reset isOfferInProgress here - let negotiation complete
    }
  }

  private handleConnectionFailure(hostId: string): void {
    console.log(`❌ [PARTICIPANT] Handling connection failure for ${hostId}, attempt ${this.retryAttempts + 1}/${this.maxRetries}`);
    
    this.retryAttempts++;
    
    if (this.retryAttempts < this.maxRetries) {
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryAttempts), 5000); // Exponential backoff, max 5s
      console.log(`⏳ [PARTICIPANT] Retrying connection in ${retryDelay}ms...`);
      
      setTimeout(() => {
        this.cleanupParticipantHandshake();
        this.createAndSendOffer(hostId);
      }, retryDelay);
    } else {
      console.error(`💀 [PARTICIPANT] Max retries reached (${this.maxRetries}), giving up`);
      this.cleanupParticipantHandshake();
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('participant-connection-failed', {
        detail: { participantId: this.participantId, hostId }
      }));
    }
  }

  cleanupParticipantHandshake(): void {
    console.log('🧹 [PARTICIPANT] Cleaning up handshake');
    
    // Cleanup polite peer state
    if (this.participantId) {
      politePeerManager.cleanup(this.participantId);
      preAllocatedTransceivers.cleanup(this.participantId);
    }
    
    // Clean up peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onnegotiationneeded = null;
        this.peerConnection.close();
      } catch (err) {
        console.warn('[PARTICIPANT] Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }

    // Clean up local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('[PARTICIPANT] Error stopping track:', err);
        }
      });
      this.localStream = null;
    }

    // Reset flags
    this.isOfferInProgress = false;
    this.isRemoteDescriptionSet = false;
    this.isProcessingAnswer = false;
    this.pendingCandidates = [];

    console.log('✅ [PARTICIPANT] Handshake cleanup complete');
  }
}

// Global instance
const participantHandshakeManager = new ParticipantHandshakeManager();

// Export functions for external use
export const initializeOnRouteLoad = () => participantHandshakeManager.initializeOnRouteLoad();
export const cleanupParticipantHandshake = () => participantHandshakeManager.cleanupParticipantHandshake();
export const setParticipantId = (id: string) => participantHandshakeManager.setParticipantId(id);
export const getLocalStream = () => participantHandshakeManager.getLocalStream();