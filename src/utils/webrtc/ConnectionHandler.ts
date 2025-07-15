
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    getLocalStream: () => MediaStream | null
  ) {
    this.peerConnections = peerConnections;
    this.getLocalStream = getLocalStream;
  }

  setStreamCallback(callback: (participantId: string, stream: MediaStream) => void) {
    this.streamCallback = callback;
    console.log('📞 ConnectionHandler: Stream callback set');
  }

  setParticipantJoinCallback(callback: (participantId: string) => void) {
    this.participantJoinCallback = callback;
    console.log('👤 ConnectionHandler: Participant join callback set');
  }

  createPeerConnection(participantId: string): RTCPeerConnection {
    console.log(`🔗 Creating peer connection for: ${participantId}`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to: ${participantId}`);
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ Peer connection established with: ${participantId}`);
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // CRITICAL: Enhanced stream handling for incoming tracks with mobile optimization
    peerConnection.ontrack = (event) => {
      console.log(`🎥 MOBILE-CRITICAL: Track received from ${participantId}:`, {
        kind: event.track.kind,
        trackId: event.track.id,
        streamCount: event.streams.length,
        streamIds: event.streams.map(s => s.id),
        readyState: event.track.readyState,
        enabled: event.track.enabled
      });

      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log(`📹 MOBILE-CRITICAL: Processing stream from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        // FASE 4: Enhanced logging and verification
        console.log(`[MOBILE] Stream received from ${participantId}:`, {
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamActive: stream.active
        });

        // FASE 2: ENHANCED CALLBACK CHAIN FOR MOBILE
        const isMobileParticipant = participantId.includes('mobile-') || 
                                   participantId.includes('Mobile') ||
                                   sessionStorage.getItem('isMobile') === 'true';
        
        console.log(`📱 MOBILE-CALLBACK: Processing ${isMobileParticipant ? 'MOBILE' : 'DESKTOP'} participant: ${participantId}`);
        
        const triggerCallback = (attempt: number = 1) => {
          if (this.streamCallback) {
            console.log(`🚀 MOBILE-CALLBACK-${attempt}: Triggering stream callback for ${participantId}`);
            console.log(`[HOST-MOBILE] Receiving stream from ${participantId}:`, {
              streamId: stream.id,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              isMobile: isMobileParticipant,
              attempt: attempt
            });
            
            try {
              this.streamCallback(participantId, stream);
              console.log(`✅ MOBILE-CALLBACK-${attempt}: Successfully triggered callback for ${participantId}`);
            } catch (error) {
              console.error(`❌ MOBILE-CALLBACK-${attempt}: Callback error for ${participantId}:`, error);
              // Enhanced retry for mobile
              if (attempt < 3) {
                setTimeout(() => {
                  triggerCallback(attempt + 1);
                }, 100 * attempt);
              }
            }
          } else {
            console.error(`❌ MOBILE-CRITICAL: No stream callback set for ${participantId} (attempt ${attempt})`);
          }
        };

        // IMMEDIATE trigger - critical for mobile
        triggerCallback(1);
        
        // ENHANCED backup triggers with exponential delays
        setTimeout(() => {
          console.log(`🔄 MOBILE-BACKUP-1: Backup trigger for ${participantId}`);
          triggerCallback(2);
        }, isMobileParticipant ? 50 : 100);

        setTimeout(() => {
          console.log(`🔄 MOBILE-BACKUP-2: Final backup trigger for ${participantId}`);
          triggerCallback(3);
        }, isMobileParticipant ? 200 : 500);
        
        // CRITICAL: Additional mobile-specific backup
        if (isMobileParticipant) {
          setTimeout(() => {
            console.log(`🔄 MOBILE-EMERGENCY: Emergency backup for ${participantId}`);
            triggerCallback(4);
          }, 1000);
        }
        
      } else {
        console.warn(`⚠️ MOBILE: Track received from ${participantId} but no streams attached`);
        // Try to create stream from track for mobile compatibility
        if (event.track) {
          const syntheticStream = new MediaStream([event.track]);
          console.log(`🔧 MOBILE-FIX: Created synthetic stream for ${participantId}`);
          if (this.streamCallback) {
            this.streamCallback(participantId, syntheticStream);
          }
        }
      }
    };

    // FASE 1: CRITICAL - Add local stream IMMEDIATELY after peer connection creation (mobile fix)
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 MOBILE-CRITICAL: Adding local stream to peer connection for: ${participantId}`);
      console.log(`📤 Stream details:`, {
        streamId: localStream.id,
        active: localStream.active,
        trackCount: localStream.getTracks().length,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      // Enhanced mobile track addition with verification
      localStream.getTracks().forEach((track, index) => {
        try {
          console.log(`➕ MOBILE-CRITICAL: Adding track ${index + 1}/${localStream.getTracks().length}:`, {
            kind: track.kind,
            id: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });
          
          peerConnection.addTrack(track, localStream);
          console.log(`✅ MOBILE-CRITICAL: Successfully added ${track.kind} track`);
          
          // FASE 3: Additional verification for mobile tracks
          console.log(`[MOBILE] Stream track added to peer connection:`, {
            trackCount: localStream.getTracks().length,
            videoTracks: localStream.getVideoTracks().length,
            audioTracks: localStream.getAudioTracks().length,
            participantId: participantId
          });
        } catch (trackError) {
          console.error(`❌ MOBILE-CRITICAL: Failed to add track:`, trackError);
        }
      });
      
      // Verify tracks were added successfully
      const senders = peerConnection.getSenders();
      console.log(`🔍 MOBILE-VERIFICATION: Peer connection has ${senders.length} senders after adding tracks`);
      
      // Additional mobile verification
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        setTimeout(() => {
          const currentSenders = peerConnection.getSenders();
          console.log(`🔄 MOBILE-RECHECK: Senders after delay: ${currentSenders.length}`);
          
          // If senders are missing, try to re-add tracks
          if (currentSenders.length === 0 && localStream.getTracks().length > 0) {
            console.warn('⚠️ MOBILE-RECOVERY: No senders found, attempting track re-addition...');
            localStream.getTracks().forEach(track => {
              try {
                peerConnection.addTrack(track, localStream);
                console.log(`🔄 MOBILE-RECOVERY: Re-added ${track.kind} track`);
              } catch (error) {
                console.error(`❌ MOBILE-RECOVERY: Failed to re-add track:`, error);
              }
            });
          }
        }, 500);
      }
    } else {
      console.warn(`⚠️ MOBILE: No local stream available for peer connection: ${participantId}`);
    }

    return peerConnection;
  }

  async initiateCallWithRetry(participantId: string, maxRetries: number = 3): Promise<void> {
    const currentRetries = this.retryAttempts.get(participantId) || 0;
    
    if (currentRetries >= maxRetries) {
      console.error(`❌ Max retry attempts reached for: ${participantId}`);
      return;
    }

    this.retryAttempts.set(participantId, currentRetries + 1);
    
    try {
      await this.initiateCall(participantId);
      this.retryAttempts.delete(participantId); // Reset on success
    } catch (error) {
      console.error(`❌ Call initiation failed for ${participantId} (attempt ${currentRetries + 1}):`, error);
      
      if (currentRetries + 1 < maxRetries) {
        console.log(`🔄 Retrying call to ${participantId} in 2 seconds...`);
        setTimeout(() => {
          this.initiateCallWithRetry(participantId, maxRetries);
        }, 2000);
      }
    }
  }

  private async initiateCall(participantId: string): Promise<void> {
    console.log(`📞 MOBILE-CRITICAL: Initiating call to: ${participantId}`);

    const peerConnection = this.createPeerConnection(participantId);
    
    try {
      // CRITICAL: Enhanced mobile offer creation with aggressive constraints
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const offerOptions = isMobile ? {
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        voiceActivityDetection: false,
        iceRestart: true
      } : {
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      };
      
      console.log(`📞 MOBILE-CRITICAL: Creating offer with options:`, offerOptions);
      const offer = await peerConnection.createOffer(offerOptions);
      
      await peerConnection.setLocalDescription(offer);
      console.log(`📤 MOBILE-CRITICAL: Sending offer to: ${participantId}`);
      
      unifiedWebSocketService.sendOffer(participantId, offer);
      
      // CRITICAL: Force connection state monitoring for mobile
      if (isMobile) {
        console.log('📱 MOBILE-CRITICAL: Starting enhanced connection monitoring...');
        this.startEnhancedMobileMonitoring(participantId, peerConnection);
      }
      
    } catch (error) {
      console.error(`❌ MOBILE-CRITICAL: Failed to create/send offer to ${participantId}:`, error);
      throw error;
    }
  }
  
  private startEnhancedMobileMonitoring(participantId: string, peerConnection: RTCPeerConnection) {
    console.log(`📱 MOBILE-MONITORING: Starting enhanced monitoring for ${participantId}`);
    
    // Monitor connection state changes more aggressively
    const connectionMonitor = setInterval(() => {
      console.log(`📱 MOBILE-MONITOR: ${participantId} - Connection: ${peerConnection.connectionState}, ICE: ${peerConnection.iceConnectionState}`);
      
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ MOBILE-MONITOR: ${participantId} is connected, clearing monitor`);
        clearInterval(connectionMonitor);
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ MOBILE-MONITOR: ${participantId} failed, triggering recovery`);
        clearInterval(connectionMonitor);
        this.handleConnectionFailure(participantId);
      }
    }, 1000);
    
    // Clear monitor after 30 seconds to prevent memory leaks
    setTimeout(() => {
      clearInterval(connectionMonitor);
    }, 30000);
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);
    
    // Clean up failed connection
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    // Clear heartbeat
    this.clearHeartbeat(participantId);
    
    // Attempt retry after delay
    setTimeout(() => {
      this.initiateCallWithRetry(participantId);
    }, 3000);
  }

  startHeartbeat(participantId: string): void {
    console.log(`💓 Starting heartbeat for: ${participantId}`);
    
    // Enhanced heartbeat frequency for mobile connections
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const heartbeatInterval = isMobile ? 5000 : 30000; // 5s for mobile, 30s for desktop
    
    console.log(`💓 MOBILE-OPTIMIZED: Using ${heartbeatInterval}ms heartbeat for ${participantId} (${isMobile ? 'Mobile' : 'Desktop'})`);
    
    const interval = setInterval(() => {
      const peerConnection = this.peerConnections.get(participantId);
      if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log(`💓 Heartbeat sent to: ${participantId}`);
        // Enhanced heartbeat for mobile - check connection quality
        if (isMobile) {
          // Send ping via data channel or check ICE connection state
          console.log(`📱 MOBILE HEARTBEAT: Connection state: ${peerConnection.connectionState}, ICE state: ${peerConnection.iceConnectionState}`);
          
          // If ICE connection is not stable, trigger recovery
          if (peerConnection.iceConnectionState !== 'connected' && peerConnection.iceConnectionState !== 'completed') {
            console.warn(`⚠️ MOBILE HEARTBEAT: Unstable ICE connection detected for ${participantId}: ${peerConnection.iceConnectionState}`);
            this.handleConnectionFailure(participantId);
          }
        }
      } else {
        console.log(`💔 No active connection for heartbeat: ${participantId}`);
        this.clearHeartbeat(participantId);
      }
    }, heartbeatInterval);
    
    this.heartbeatIntervals.set(participantId, interval);
  }

  clearHeartbeat(participantId: string): void {
    const interval = this.heartbeatIntervals.get(participantId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(participantId);
      console.log(`💔 Heartbeat cleared for: ${participantId}`);
    }
  }

  clearRetries(participantId: string): void {
    this.retryAttempts.delete(participantId);
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ConnectionHandler');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();
    
    // Clear retry attempts
    this.retryAttempts.clear();
  }
}
