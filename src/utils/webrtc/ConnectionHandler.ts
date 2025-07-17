
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { webRTCCallbacks } from './WebRTCCallbacksSingleton';

export class ConnectionHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private getLocalStream: () => MediaStream | null;
  private streamCallback: ((participantId: string, stream: MediaStream) => void) | null = null;
  private participantJoinCallback: ((participantId: string) => void) | null = null;
  private retryAttempts: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();

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
    console.log(`🔗 CRITICAL: Creating peer connection for: ${participantId}`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(config);
    this.peerConnections.set(participantId, peerConnection);

    console.log(`✅ CRITICAL: Peer connection created for ${participantId}`, {
      iceGatheringState: peerConnection.iceGatheringState,
      connectionState: peerConnection.connectionState,
      signalingState: peerConnection.signalingState
    });

    // ICE candidate handling with detailed logging
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 CRITICAL: ICE candidate generated for ${participantId}:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port
        });
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      } else {
        console.log(`🧊 CRITICAL: ICE gathering completed for ${participantId}`);
      }
    };

    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 CRITICAL: ICE connection state changed for ${participantId}:`, peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
        console.log(`✅ CRITICAL: ICE connection established for ${participantId}`);
      } else if (peerConnection.iceConnectionState === 'failed') {
        console.error(`❌ CRITICAL: ICE connection failed for ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 CRITICAL: Connection state for ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log(`✅ CRITICAL: Peer connection established with: ${participantId}`);
        if (this.participantJoinCallback) {
          this.participantJoinCallback(participantId);
        }
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`❌ CRITICAL: Peer connection failed with: ${participantId}`);
        this.handleConnectionFailure(participantId);
      }
    };

    // UNIFIED: Track reception and stream unification
    peerConnection.ontrack = (event) => {
      console.log(`📺 UNIFIED: Track received from ${participantId}: ${event.track.kind}`);
      
      let remoteStream = this.remoteStreams.get(participantId);

      if (!remoteStream) {
        remoteStream = new MediaStream();
        this.remoteStreams.set(participantId, remoteStream);
      }

      remoteStream.addTrack(event.track);

      console.log(`📡 REMOTE STREAM UPDATED for ${participantId}`, {
        streamId: remoteStream.id,
        totalTracks: remoteStream.getTracks().length,
        videoTracks: remoteStream.getVideoTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        active: remoteStream.active
      });

      // FASE 1: ARMAZENAMENTO IMEDIATO - Garantir que o stream seja armazenado ANTES de qualquer callback
      if (typeof window !== 'undefined') {
        if (!window.sharedParticipantStreams) {
          window.sharedParticipantStreams = {};
        }
        if (!window.streamBackup) {
          window.streamBackup = {};
        }
        
        // Armazenamento redundante e imediato
        window.sharedParticipantStreams[participantId] = remoteStream;
        window.streamBackup[participantId] = remoteStream;
        
        console.log(`🚀 FASE 1: Stream armazenado IMEDIATAMENTE para ${participantId}`, {
          streamId: remoteStream.id,
          totalGlobalStreams: Object.keys(window.sharedParticipantStreams).length,
          streamIsActive: remoteStream.active,
          hasVideoTracks: remoteStream.getVideoTracks().length > 0
        });

        // FASE 3: PROPAGAÇÃO ATIVA IMEDIATA - Notificar todas as janelas /live abertas
        this.notifyTransmissionWindows(participantId, remoteStream);
      }

      // FASE 2: CALLBACKS APÓS ARMAZENAMENTO
      if (this.streamCallback) {
        this.streamCallback(participantId, remoteStream);
      }
      
      // CRÍTICO: Disparar callback via singleton para sincronização completa
      webRTCCallbacks.triggerStreamCallback(participantId, remoteStream);
    };

    // CRITICAL: Add local stream if available (for participants)
    const localStream = this.getLocalStream();
    if (localStream) {
      console.log(`📤 CRITICAL: Adding local stream to peer connection for: ${participantId}`, {
        streamId: localStream.id,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      localStream.getTracks().forEach(track => {
        try {
          peerConnection.addTrack(track, localStream);
          console.log(`➕ CRITICAL: Added ${track.kind} track to peer connection for ${participantId}`, {
            trackId: track.id,
            enabled: track.enabled,
            readyState: track.readyState
          });
        } catch (error) {
          console.error(`❌ CRITICAL: Failed to add track for ${participantId}:`, error);
        }
      });
    } else {
      console.log(`⚠️ CRITICAL: No local stream available for ${participantId}`);
    }

    return peerConnection;
  }

  async initiateCallWithRetry(participantId: string, maxRetries: number = 3): Promise<void> {
    const currentRetries = this.retryAttempts.get(participantId) || 0;
    
    if (currentRetries >= maxRetries) {
      console.error(`❌ Max retry attempts reached for: ${participantId}`);
      throw new Error(`Max retry attempts (${maxRetries}) reached for ${participantId}`);
    }

    this.retryAttempts.set(participantId, currentRetries + 1);
    
    try {
      await this.initiateCall(participantId);
      this.retryAttempts.delete(participantId); // Reset on success
      console.log(`✅ RETRY SUCCESS: Call initiated successfully for ${participantId} on attempt ${currentRetries + 1}`);
    } catch (error) {
      console.error(`❌ Call initiation failed for ${participantId} (attempt ${currentRetries + 1}):`, error);
      
      if (currentRetries + 1 < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s...
        const delay = 2000 * Math.pow(2, currentRetries);
        console.log(`🔄 RETRY SCHEDULE: Retrying call to ${participantId} in ${delay}ms (attempt ${currentRetries + 2}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initiateCallWithRetry(participantId, maxRetries);
      } else {
        console.error(`❌ RETRY EXHAUSTED: All retry attempts failed for ${participantId}`);
        throw error;
      }
    }
  }

  private async initiateCall(participantId: string): Promise<void> {
    console.log(`📞 CRITICAL: Initiating call to: ${participantId}`);

    const peerConnection = this.createPeerConnection(participantId);
    
    try {
      // Create offer with detailed options
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        iceRestart: false
      });
      
      console.log(`📋 CRITICAL: Offer created for ${participantId}:`, {
        type: offer.type,
        sdpLines: offer.sdp?.split('\n').length || 0,
        hasVideo: offer.sdp?.includes('video') || false,
        hasAudio: offer.sdp?.includes('audio') || false
      });
      
      await peerConnection.setLocalDescription(offer);
      console.log(`📤 CRITICAL: Local description set for ${participantId}`, {
        signalingState: peerConnection.signalingState,
        iceGatheringState: peerConnection.iceGatheringState
      });
      
      console.log(`📤 CRITICAL: Sending offer to: ${participantId}`);
      unifiedWebSocketService.sendOffer(participantId, offer);
      
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to create/send offer to ${participantId}:`, error);
      throw error;
    }
  }

  private handleConnectionFailure(participantId: string): void {
    console.log(`🔄 Handling connection failure for: ${participantId}`);
    
    // Clean up failed connection
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }
    
    // Clean up remote stream
    this.remoteStreams.delete(participantId);
    
    // Clean up global stream references
    if (typeof window !== 'undefined') {
      if (window.sharedParticipantStreams && window.sharedParticipantStreams[participantId]) {
        delete window.sharedParticipantStreams[participantId];
      }
      if (window.streamBackup && window.streamBackup[participantId]) {
        delete window.streamBackup[participantId];
      }
      console.log(`🧹 GLOBAL: Cleaned up stream references for ${participantId}`);
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

  // FASE 3: Sistema de propagação ativa para janelas /live
  private notifyTransmissionWindows(participantId: string, stream: MediaStream): void {
    console.log(`📡 FASE 3: Notificando janelas /live sobre stream de ${participantId}`);
    
    // Tentar notificar através de múltiplos canais
    const sessionId = window.sessionStorage.getItem('currentSessionId');
    
    if (sessionId) {
      // Canal principal
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'stream-available-immediate',
          participantId: participantId,
          streamId: stream.id,
          trackCount: stream.getTracks().length,
          hasVideo: stream.getVideoTracks().length > 0,
          hasAudio: stream.getAudioTracks().length > 0,
          timestamp: Date.now()
        });
        console.log(`📡 FASE 3: Broadcast message sent for ${participantId}`);
        channel.close();
      } catch (error) {
        console.error(`❌ FASE 3: Broadcast channel error:`, error);
      }

      // Canal backup
      try {
        const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
        backupChannel.postMessage({
          type: 'force-stream-update',
          participantId: participantId,
          action: 'immediate-display'
        });
        console.log(`📡 FASE 3: Backup broadcast sent for ${participantId}`);
        backupChannel.close();
      } catch (error) {
        console.error(`❌ FASE 3: Backup broadcast error:`, error);
      }
    }

    // FASE 4: Sistema de verificação - verificar se a janela recebeu o stream
    setTimeout(() => {
      this.verifyStreamReception(participantId, stream);
    }, 2000);
  }

  // FASE 4: Sistema de verificação e retry
  private verifyStreamReception(participantId: string, stream: MediaStream): void {
    console.log(`🔍 FASE 4: Verificando recepção do stream para ${participantId}`);
    
    const sessionId = window.sessionStorage.getItem('currentSessionId');
    if (!sessionId) return;

    // Criar canal de verificação
    const verificationChannel = new BroadcastChannel(`verification-${sessionId}`);
    
    // Enviar solicitação de status
    verificationChannel.postMessage({
      type: 'verify-stream-reception',
      participantId: participantId,
      requestId: `verify-${Date.now()}`
    });

    // Aguardar resposta por 3 segundos
    const timeout = setTimeout(() => {
      console.log(`⚠️ FASE 4: Timeout na verificação para ${participantId} - reenviando stream`);
      this.retryStreamPropagation(participantId, stream);
      verificationChannel.close();
    }, 3000);

    // Escutar resposta
    verificationChannel.onmessage = (event) => {
      if (event.data.type === 'stream-reception-confirmed' && event.data.participantId === participantId) {
        console.log(`✅ FASE 4: Stream confirmado para ${participantId}`);
        clearTimeout(timeout);
        verificationChannel.close();
      }
    };
  }

  // FASE 4: Retry de propagação do stream
  private retryStreamPropagation(participantId: string, stream: MediaStream): void {
    console.log(`🔄 FASE 4: Retry de propagação para ${participantId}`);
    
    // Re-armazenar o stream com força
    if (typeof window !== 'undefined') {
      window.sharedParticipantStreams = window.sharedParticipantStreams || {};
      window.streamBackup = window.streamBackup || {};
      
      window.sharedParticipantStreams[participantId] = stream;
      window.streamBackup[participantId] = stream;
      
      console.log(`🔄 FASE 4: Stream re-armazenado para ${participantId}`);
    }

    // Re-enviar notificações
    this.notifyTransmissionWindows(participantId, stream);
  }

  cleanup(): void {
    console.log('🧹 Cleaning up ConnectionHandler');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, participantId) => {
      clearInterval(interval);
      console.log(`💔 Cleared heartbeat for: ${participantId}`);
    });
    this.heartbeatIntervals.clear();
    
    // Clear remote streams
    this.remoteStreams.clear();
    
    // Clear retry attempts
    this.retryAttempts.clear();
  }
}
