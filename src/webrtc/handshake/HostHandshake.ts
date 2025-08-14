// ============= Host WebRTC Handshake Logic =============
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

const hostPeerConnections = new Map<string, RTCPeerConnection>();
const pendingCandidates = new Map<string, RTCIceCandidate[]>();
const handshakeTimeouts = new Map<string, NodeJS.Timeout>();

class HostHandshakeManager {
  private getOrCreatePC(participantId: string): RTCPeerConnection {
    let pc = hostPeerConnections.get(participantId);
    
    if (!pc) {
      const pcStartTime = performance.now();
      console.log(`[HOST] Creating new RTCPeerConnection for ${participantId}`);
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      // ENHANCED ontrack registration with comprehensive logging and immediate connection marking
      pc.ontrack = (event) => {
        const ontrackTime = performance.now();
        console.log(`🎥 ONTRACK: Event received from ${participantId}`, {
          trackKind: event.track.kind,
          trackId: event.track.id.substring(0, 8),
          streamCount: event.streams.length,
          trackReadyState: event.track.readyState,
          timestamp: Date.now()
        });
        
        // IMMEDIATE CONNECTION MARKING - most reliable indicator
        console.log(`✅ ONTRACK: Marking ${participantId} as connected immediately`);
        window.dispatchEvent(new CustomEvent('ontrack-connection-established', {
          detail: { 
            participantId, 
            timestamp: Date.now(),
            connectionMethod: 'ontrack'
          }
        }));
        
        // Log ICE and connection states when ontrack fires
        console.log(`🔍 ONTRACK: Connection states for ${participantId}:`, {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState
        });
        
        // Enhanced stream handling with support for edge cases
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          
          console.log(`🎥 ONTRACK: Stream details for ${participantId}:`, {
            streamId: stream.id.substring(0, 8),
            videoTracks: videoTracks.length,
            audioTracks: audioTracks.length,
            streamActive: stream.active,
            trackStates: {
              video: videoTracks.map(t => ({ id: t.id.substring(0, 8), state: t.readyState, enabled: t.enabled })),
              audio: audioTracks.map(t => ({ id: t.id.substring(0, 8), state: t.readyState, enabled: t.enabled }))
            }
          });
          
          // Enhanced DOM handling with better error handling and audio-only support
          const quadrantEl = document.querySelector(`[data-participant-id="${participantId}"]`);
          if (quadrantEl) {
            const existingVideo = quadrantEl.querySelector('video');
            if (existingVideo) {
              console.log(`🔄 ONTRACK: Replacing existing video element for ${participantId}`);
              existingVideo.remove();
            }
            
            // Create video element even for audio-only streams (for potential future video)
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.className = 'w-full h-full object-cover';
            video.srcObject = stream;
            
            // Add audio-only indicator if no video tracks
            if (videoTracks.length === 0 && audioTracks.length > 0) {
              video.style.backgroundColor = '#1f2937';
              console.log(`🎵 ONTRACK: Audio-only stream detected for ${participantId}`);
            }
            
            quadrantEl.appendChild(video);
            
            video.play().then(() => {
              const renderTime = performance.now();
              console.log(`✅ ONTRACK: Video element ready for ${participantId} (${(renderTime - ontrackTime).toFixed(1)}ms) - Video tracks: ${videoTracks.length}, Audio tracks: ${audioTracks.length}`);
            }).catch(err => {
              console.warn(`⚠️ ONTRACK: Video play failed for ${participantId}:`, err);
              // Don't fail the connection for video play issues
            });
          } else {
            console.warn(`⚠️ ONTRACK: Quadrant element not found for ${participantId} - stream will be available but not displayed`);
          }
          
          // Enhanced event dispatch with comprehensive details
          window.dispatchEvent(new CustomEvent('participant-stream-received', {
            detail: { 
              participantId, 
              stream, 
              hasStream: true,
              isAudioOnly: videoTracks.length === 0 && audioTracks.length > 0,
              isVideoOnly: videoTracks.length > 0 && audioTracks.length === 0,
              trackCounts: {
                video: videoTracks.length,
                audio: audioTracks.length
              },
              streamMetadata: {
                id: stream.id,
                active: stream.active,
                videoEnabled: videoTracks.some(t => t.enabled),
                audioEnabled: audioTracks.some(t => t.enabled)
              },
              timestamp: Date.now()
            }
          }));
          
          // Track this ontrack event for stability monitoring
          window.dispatchEvent(new CustomEvent('ontrack-received', {
            detail: { participantId, timestamp: Date.now(), hasVideo: videoTracks.length > 0, hasAudio: audioTracks.length > 0 }
          }));
        } 
        // Handle empty streams case (ontrack called but no streams provided)
        else {
          console.warn(`⚠️ ONTRACK: Empty streams for ${participantId} - track available but no stream container`);
          
          // Still mark as connected since ontrack fired
          window.dispatchEvent(new CustomEvent('participant-stream-received', {
            detail: { 
              participantId, 
              stream: null, 
              hasStream: false,
              trackKind: event.track.kind,
              trackState: event.track.readyState,
              timestamp: Date.now()
            }
          }));
          
          window.dispatchEvent(new CustomEvent('ontrack-received', {
            detail: { participantId, timestamp: Date.now(), emptyStream: true, trackKind: event.track.kind }
          }));
        }
      };

      // Add receive-only transceiver for video BEFORE setRemoteDescription
      pc.addTransceiver('video', { direction: 'recvonly' });
      console.log(`[HOST] addTransceiver('video', recvonly) for ${participantId}`);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[ICE] candidate generated for ${participantId}, sending`);
          unifiedWebSocketService.sendWebRTCCandidate(participantId, event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`[HOST] Connection state for ${participantId}: ${state}`);
        
        if (state === 'connected') {
          // Clear timeout on successful connection
          const timeout = handshakeTimeouts.get(participantId);
          if (timeout) {
            clearTimeout(timeout);
            handshakeTimeouts.delete(participantId);
          }
        } else if (state === 'failed' || state === 'closed') {
          console.log(`[HOST] Connection failed/closed for ${participantId}, cleaning up`);
          this.cleanupHostHandshake(participantId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`[HOST] ICE connection state for ${participantId}: ${state}`);
        
        if (state === 'failed') {
          console.log(`[HOST] ICE connection failed for ${participantId}`);
          this.cleanupHostHandshake(participantId);
        }
      };

      const pcDuration = performance.now() - pcStartTime;
      console.log(`[HOST] RTCPeerConnection created for ${participantId} (${pcDuration.toFixed(1)}ms)`);

      hostPeerConnections.set(participantId, pc);
      
      // Set handshake timeout with PC timeout/reset criteria
      const timeout = setTimeout(() => {
        console.log(`[HOST] Handshake timeout for ${participantId} (30s) - cleaning up`);
        this.cleanupHostHandshake(participantId);
      }, 30000); // 30 seconds timeout
      
      handshakeTimeouts.set(participantId, timeout);
    }

    return pc;
  }

  async handleOfferFromParticipant(data: any): Promise<void> {
    const { offer, participantId } = data;
    
    if (!offer || !participantId) {
      console.error('[HOST] handleOfferFromParticipant: Missing offer or participantId');
      return;
    }

    const handleStartTime = performance.now();
    console.log(`[HOST] Processing offer from ${participantId}`);

    try {
      const pc = this.getOrCreatePC(participantId);
      
      // STEP 1: Set remote description (participant's offer)
      const setRemoteStartTime = performance.now();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const setRemoteDuration = performance.now() - setRemoteStartTime;
      console.log(`[HOST] setRemoteDescription (${setRemoteDuration.toFixed(1)}ms)`);

      // Track reconciliation after setRemoteDescription
      const receivers = pc.getReceivers();
      console.log(`[HOST] ${receivers.length} receivers after setRemoteDescription for ${participantId}`);
      receivers.forEach((receiver, index) => {
        if (receiver.track) {
          console.log(`[HOST] Receiver ${index}: ${receiver.track.kind} track (id: ${receiver.track.id.substring(0, 8)})`);
        }
      });

      // STEP 2: Drain buffered ICE candidates
      const candidates = pendingCandidates.get(participantId) || [];
      if (candidates.length > 0) {
        const candidateStartTime = performance.now();
        console.log(`[ICE] candidate buffered -> applying ${candidates.length} candidates for ${participantId}`);
        
        for (const candidate of candidates) {
          await pc.addIceCandidate(candidate);
        }
        pendingCandidates.delete(participantId);
        
        const candidateDuration = performance.now() - candidateStartTime;
        console.log(`[ICE] candidate applied (${candidateDuration.toFixed(1)}ms)`);
      } else {
        console.log(`[ICE] No buffered candidates for ${participantId}`);
      }

      // STEP 3: Create answer
      const answerStartTime = performance.now();
      const answer = await pc.createAnswer();
      const answerDuration = performance.now() - answerStartTime;

      // STEP 4: Set local description
      const setLocalStartTime = performance.now();
      await pc.setLocalDescription(answer);
      const setLocalDuration = performance.now() - setLocalStartTime;
      
      console.log(`[HOST] createAnswer (${answerDuration.toFixed(1)}ms) -> setLocalDescription (${setLocalDuration.toFixed(1)}ms)`);

      // STEP 5: Send answer
      const sendStartTime = performance.now();
      unifiedWebSocketService.sendWebRTCAnswer(participantId, answer.sdp!, answer.type);
      const sendDuration = performance.now() - sendStartTime;
      
      const totalDuration = performance.now() - handleStartTime;
      console.log(`[HOST] answerSent (${sendDuration.toFixed(1)}ms) -> Total handshake: ${totalDuration.toFixed(1)}ms`);

    } catch (error) {
      console.error(`[HOST] Failed to handle offer from ${participantId}:`, error);
    }
  }

  async handleRemoteCandidate(data: any): Promise<void> {
    const { candidate, participantId } = data;
    
    if (!candidate || !participantId) {
      console.error('[HOST] handleRemoteCandidate: Missing candidate or participantId');
      return;
    }

    const pc = hostPeerConnections.get(participantId);
    
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`[ICE] candidate applied immediately for ${participantId}`);
      } catch (error) {
        console.error(`[ICE] Failed to apply candidate for ${participantId}:`, error);
      }
    } else {
      // Buffer the candidate if remote description isn't set yet
      if (!pendingCandidates.has(participantId)) {
        pendingCandidates.set(participantId, []);
      }
      pendingCandidates.get(participantId)!.push(new RTCIceCandidate(candidate));
      console.log(`[ICE] candidate buffered for ${participantId} (total: ${pendingCandidates.get(participantId)!.length})`);
    }
  }

  private setupHostHandlers(): void {
    if (!unifiedWebSocketService) {
      console.error('❌ [HOST] unifiedWebSocketService not initialized');
      return;
    }

    unifiedWebSocketService.on('webrtc-offer', (payload: any) => {
      console.log('[HOST] Received webrtc-offer:', payload);
      this.handleOfferFromParticipant(payload);
    });

    unifiedWebSocketService.on('webrtc-candidate', (payload: any) => {
      console.log('[HOST] Received webrtc-candidate:', payload);
      this.handleRemoteCandidate(payload);
    });

    console.log('✅ [HOST] Enhanced handshake handlers registered');
  }

  requestOfferFromParticipant(participantId: string): void {
    if (!unifiedWebSocketService) {
      console.error('❌ [HOST] unifiedWebSocketService not available');
      return;
    }

    console.log(`[HOST] Requesting offer from participant: ${participantId}`);
    unifiedWebSocketService.requestOfferFromParticipant(participantId);
  }

  cleanupHostHandshake(participantId: string): void {
    const pc = hostPeerConnections.get(participantId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch (err) {
        console.warn(`[HOST] Error closing PC for ${participantId}:`, err);
      }
      hostPeerConnections.delete(participantId);
    }

    // Clear pending candidates
    pendingCandidates.delete(participantId);

    // Clear timeout
    const timeout = handshakeTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
      handshakeTimeouts.delete(participantId);
    }

    console.log(`[HOST] Cleaned up handshake for ${participantId}`);
  }

  cleanupAllStuckConnections(): void {
    console.log('[HOST] Cleaning up all stuck connections');
    
    hostPeerConnections.forEach((pc, participantId) => {
      const state = pc.connectionState;
      const iceState = pc.iceConnectionState;
      
      if (state === 'connecting' || state === 'failed' || iceState === 'checking' || iceState === 'failed') {
        console.log(`[HOST] Cleaning up stuck connection for ${participantId} (state: ${state}, ice: ${iceState})`);
        this.cleanupHostHandshake(participantId);
      }
    });
  }

  getHostConnectionsState(): Map<string, { connectionState: string; iceState: string; signalingState: string }> {
    const states = new Map();
    hostPeerConnections.forEach((pc, participantId) => {
      states.set(participantId, {
        connectionState: pc.connectionState,
        iceState: pc.iceConnectionState,
        signalingState: pc.signalingState
      });
    });
    return states;
  }

  resetHostWebRTC(): void {
    console.log('[HOST] Resetting all WebRTC connections');
    
    // Close all connections
    hostPeerConnections.forEach((pc, participantId) => {
      this.cleanupHostHandshake(participantId);
    });
    
    // Clear all maps
    hostPeerConnections.clear();
    pendingCandidates.clear();
    handshakeTimeouts.clear();
    
    console.log('[HOST] WebRTC reset complete');
  }
}

// Global instance
const hostHandshakeManager = new HostHandshakeManager();

// Export functions for external use
export const handleOfferFromParticipant = (data: any) => hostHandshakeManager.handleOfferFromParticipant(data);
export const handleRemoteCandidate = (data: any) => hostHandshakeManager.handleRemoteCandidate(data);
export const requestOfferFromParticipant = (participantId: string) => hostHandshakeManager.requestOfferFromParticipant(participantId);
export const cleanupHostHandshake = (participantId: string) => hostHandshakeManager.cleanupHostHandshake(participantId);
export const cleanupAllStuckConnections = () => hostHandshakeManager.cleanupAllStuckConnections();
export const getHostConnectionsState = () => hostHandshakeManager.getHostConnectionsState();
export const resetHostWebRTC = () => hostHandshakeManager.resetHostWebRTC();

// Initialize handlers once
if (typeof window !== 'undefined' && !(window as any).__hostHandlersSetup) {
  hostHandshakeManager['setupHostHandlers']();
  (window as any).__hostHandlersSetup = true;
  console.log('✅ [HOST] Enhanced handshake handlers initialized');
}