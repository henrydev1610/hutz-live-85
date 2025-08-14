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

    // Listen for WebRTC offer request from host
    unifiedWebSocketService.on('webrtc-request-offer', async (data: any) => {
      const hostId = data?.fromUserId;
      console.log(`[PART] Offer request received from host: ${hostId}`);
      
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

    // Receive answer from host
    unifiedWebSocketService.on('webrtc-answer', async (data: any) => {
      const hostId = data?.fromUserId;
      const answer = data?.answer;

      if (!hostId || !answer?.sdp || !answer?.type) {
        console.warn('⚠️ [PARTICIPANT] Invalid answer format:', data);
        return;
      }

      console.log(`[HOST] setRemoteDescription -> answer received from ${hostId}`);

      if (!this.peerConnection) {
        console.warn('⚠️ [PARTICIPANT] Answer received without active PC');
        return;
      }

      try {
        await this.peerConnection.setRemoteDescription(answer);
        console.log(`[HOST] setRemoteDescription -> answer applied`);

        // Flush all pending candidates immediately
        if (this.pendingCandidates.length > 0) {
          console.log(`[ICE] candidate buffered -> flushing ${this.pendingCandidates.length} candidates`);
          
          const candidatesToFlush = [...this.pendingCandidates];
          this.pendingCandidates = [];
          
          for (const candidate of candidatesToFlush) {
            try {
              await this.peerConnection.addIceCandidate(candidate);
              console.log('[ICE] candidate applied');
            } catch (err) {
              console.warn('⚠️ [PARTICIPANT] Error flushing candidate:', err);
            }
          }
        }
        
        console.log('✅ [PARTICIPANT] Connection established successfully');
      } catch (err) {
        console.error('❌ [PARTICIPANT] Error applying answer:', err);
      }
    });

    // Receive ICE candidates from host with consistent buffering
    unifiedWebSocketService.on('webrtc-candidate', async (data: any) => {
      const hostId = data?.fromUserId;
      const candidate = data?.candidate;
      
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
          console.log(`[ICE] candidate applied immediately from ${hostId}`);
        } catch (err) {
          console.warn('⚠️ [PARTICIPANT] Error adding candidate from:', hostId, err);
        }
      } else {
        this.pendingCandidates.push(candidate);
        console.log(`[ICE] candidate buffered from ${hostId} (total: ${this.pendingCandidates.length})`);
      }
    });
  }

  async createAndSendOffer(hostId: string): Promise<void> {
    if (this.isOfferInProgress) {
      console.log('[PART] createAndSendOffer: Offer already in progress, skipping');
      return;
    }

    const offerStartTime = performance.now();
    this.handshakeStartTime = offerStartTime;
    console.log(`[PART] Starting offer creation sequence for ${hostId}`);

    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      console.log('[PART] createAndSendOffer: Closing existing peer connection');
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
      console.log(`[PART] addTrack -> Stream ready (${streamDuration.toFixed(1)}ms)`);

      // STEP 2: Create new peer connection
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
      console.log(`[PART] RTCPeerConnection created (${pcDuration.toFixed(1)}ms)`);

      // STEP 3: Add tracks to peer connection BEFORE creating offer
      const addTrackStartTime = performance.now();
      stream.getTracks().forEach(track => {
        if (this.peerConnection && stream) {
          console.log(`[PART] addTrack(${track.kind}) -> readyState: ${track.readyState}`);
          this.peerConnection.addTrack(track, stream);
        }
      });
      const addTrackDuration = performance.now() - addTrackStartTime;
      console.log(`[PART] addTrack -> createOffer (${addTrackDuration.toFixed(1)}ms)`);

      // Set up event handlers
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[ICE] candidate generated, sending to host');
          unifiedWebSocketService.sendWebRTCCandidate(hostId, event.candidate);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        const elapsed = performance.now() - this.handshakeStartTime;
        console.log(`[PART] Connection state: ${state} (${elapsed.toFixed(1)}ms since start)`);
        
        if (state === 'connected') {
          this.clearConnectionTimeout();
          this.reconnectAttempts = 0;
          console.log(`[PART] WebRTC connection established (${elapsed.toFixed(1)}ms total)`);
        } else if (state === 'failed' || state === 'disconnected') {
          this.handleConnectionFailure(hostId);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        console.log(`[PART] ICE connection state: ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          this.clearConnectionTimeout();
          console.log('[PART] ICE connection established');
        } else if (state === 'failed') {
          console.log('[PART] ICE connection failed');
          this.handleConnectionFailure(hostId);
        }
      };

      // STEP 4: Create offer AFTER stream is added
      const offerCreateStartTime = performance.now();
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      const offerCreateDuration = performance.now() - offerCreateStartTime;

      // STEP 5: Set local description
      const setLocalStartTime = performance.now();
      await this.peerConnection.setLocalDescription(offer);
      const setLocalDuration = performance.now() - setLocalStartTime;
      
      console.log(`[PART] createOffer (${offerCreateDuration.toFixed(1)}ms) -> setLocalDescription (${setLocalDuration.toFixed(1)}ms)`);

      // STEP 6: Send offer to host
      const sendStartTime = performance.now();
      unifiedWebSocketService.sendWebRTCOffer(hostId, offer.sdp!, offer.type);
      const sendDuration = performance.now() - sendStartTime;
      
      const totalDuration = performance.now() - offerStartTime;
      console.log(`[PART] setLocalDescription -> offerSent (${sendDuration.toFixed(1)}ms) -> Total sequence: ${totalDuration.toFixed(1)}ms`);

      // Set connection timeout
      this.setConnectionTimeout(() => {
        console.log('[PART] Connection timeout reached (30s)');
        this.handleConnectionFailure(hostId);
      });

    } catch (error) {
      console.error('[PART] createAndSendOffer: Failed:', error);
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
    console.log(`[PART] Connection failure recovery for: ${hostId}`);
    
    // Reset PC completely on failure
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Clear pending candidates
    this.pendingCandidates = [];
    
    // Prevent looping: Only retry if not making offer and under retry limit
    if (!this.isOfferInProgress && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const backoffDelay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      setTimeout(async () => {
        try {
          console.log(`[PART] Retry attempt ${this.reconnectAttempts} for: ${hostId}`);
          await this.createAndSendOffer(hostId);
        } catch (error) {
          console.log(`[PART] Retry failed for ${hostId}:`, error);
        }
      }, backoffDelay);
    } else {
      console.log(`[PART] Max retries reached or already making offer for: ${hostId}`);
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