import { useState, useEffect, useRef, useCallback } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { streamSynchronizer } from '@/utils/StreamSynchronizer';
import { useToast } from '@/components/ui/use-toast';

interface WebRTCState {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface RobustWebRTCConfig {
  connectionTimeout: number;
  iceTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

const DESKTOP_CONFIG: RobustWebRTCConfig = {
  connectionTimeout: 15000,  // 15s para estabelecer conexão
  iceTimeout: 30000,         // 30s para ICE gathering
  maxRetries: 3,             // Máximo 3 tentativas
  retryDelay: 5000           // 5s entre tentativas
};

export const useRobustWebRTC = (sessionId: string | null, isHost: boolean = false) => {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<WebRTCState>({
    websocket: 'disconnected',
    webrtc: 'disconnected',
    overall: 'disconnected'
  });

  // Single source of truth for connections
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);
  const retryAttempts = useRef<Map<string, number>>(new Map());
  const connectionTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const iceTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isConnecting = useRef<Set<string>>(new Set());

  // Circuit breaker para prevenir loops infinitos
  const circuitBreaker = useRef<Map<string, { failures: number, lastFailure: number, isOpen: boolean }>>(new Map());

  const updateConnectionState = useCallback((type: keyof WebRTCState, state: WebRTCState[keyof WebRTCState]) => {
    setConnectionState(prev => {
      const newState = { ...prev, [type]: state };
      
      // Update overall state logic
      if (newState.websocket === 'connected' && (newState.webrtc === 'connected' || isHost)) {
        newState.overall = 'connected';
      } else if (newState.websocket === 'failed' || newState.webrtc === 'failed') {
        newState.overall = 'failed';
      } else if (newState.websocket === 'connecting' || newState.webrtc === 'connecting') {
        newState.overall = 'connecting';
      } else {
        newState.overall = 'disconnected';
      }
      
      return newState;
    });
  }, [isHost]);

  const isCircuitBreakerOpen = useCallback((participantId: string): boolean => {
    const breaker = circuitBreaker.current.get(participantId);
    if (!breaker) return false;
    
    if (breaker.isOpen && Date.now() - breaker.lastFailure > 30000) {
      // Reset circuit breaker after 30s
      breaker.isOpen = false;
      breaker.failures = 0;
    }
    
    return breaker.isOpen;
  }, []);

  const recordFailure = useCallback((participantId: string) => {
    const breaker = circuitBreaker.current.get(participantId) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= DESKTOP_CONFIG.maxRetries) {
      breaker.isOpen = true;
      console.log(`🚫 ROBUST: Circuit breaker OPEN for ${participantId}`);
    }
    
    circuitBreaker.current.set(participantId, breaker);
  }, []);

  const resetCircuitBreaker = useCallback((participantId: string) => {
    circuitBreaker.current.delete(participantId);
  }, []);

  const cleanupConnection = useCallback((participantId: string) => {
    console.log(`🧹 ROBUST: Cleaning up connection for ${participantId}`);
    
    // Clear timeouts
    const connectionTimeout = connectionTimeouts.current.get(participantId);
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeouts.current.delete(participantId);
    }
    
    const iceTimeout = iceTimeouts.current.get(participantId);
    if (iceTimeout) {
      clearTimeout(iceTimeout);
      iceTimeouts.current.delete(participantId);
    }
    
    // Close peer connection
    const pc = peerConnections.current.get(participantId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(participantId);
    }
    
    // Remove from connecting set
    isConnecting.current.delete(participantId);
    
    console.log(`✅ ROBUST: Cleanup complete for ${participantId}`);
  }, []);

  const createPeerConnection = useCallback((participantId: string): RTCPeerConnection => {
    console.log(`🔗 ROBUST: Creating peer connection for ${participantId}`);
    
    // Check if already connecting
    if (isConnecting.current.has(participantId)) {
      console.log(`⚠️ ROBUST: Already connecting to ${participantId}, reusing...`);
      const existing = peerConnections.current.get(participantId);
      if (existing) return existing;
    }
    
    // Check circuit breaker
    if (isCircuitBreakerOpen(participantId)) {
      throw new Error(`Circuit breaker open for ${participantId}`);
    }
    
    // Clean up any existing connection
    cleanupConnection(participantId);
    
    // Mark as connecting
    isConnecting.current.add(participantId);
    
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
    
    const pc = new RTCPeerConnection(config);
    peerConnections.current.set(participantId, pc);
    
    // Set up event handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 ROBUST: Sending ICE candidate for ${participantId}`);
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      } else {
        console.log(`🏁 ROBUST: ICE gathering complete for ${participantId}`);
        const timeout = iceTimeouts.current.get(participantId);
        if (timeout) {
          clearTimeout(timeout);
          iceTimeouts.current.delete(participantId);
        }
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`🔗 ROBUST: Connection state for ${participantId}: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        console.log(`✅ ROBUST: Connected to ${participantId}`);
        resetCircuitBreaker(participantId);
        isConnecting.current.delete(participantId);
        updateConnectionState('webrtc', 'connected');
        
        // Clear connection timeout
        const timeout = connectionTimeouts.current.get(participantId);
        if (timeout) {
          clearTimeout(timeout);
          connectionTimeouts.current.delete(participantId);
        }
        
      } else if (pc.connectionState === 'failed') {
        console.log(`❌ ROBUST: Connection failed for ${participantId}`);
        recordFailure(participantId);
        cleanupConnection(participantId);
        updateConnectionState('webrtc', 'failed');
        
        // Schedule retry if not circuit breaker open
        if (!isCircuitBreakerOpen(participantId)) {
          setTimeout(() => {
            if (sessionId && !isCircuitBreakerOpen(participantId)) {
              console.log(`🔄 ROBUST: Retrying connection to ${participantId}`);
              createPeerConnection(participantId);
            }
          }, DESKTOP_CONFIG.retryDelay);
        }
      }
    };
    
    pc.ontrack = (event) => {
      console.log(`🎥 ROBUST: Received track from ${participantId}`);
      const [stream] = event.streams;
      
      if (stream) {
        console.log(`📹 ROBUST: Stream received:`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          active: stream.active
        });
        
        // Register with stream synchronizer
        streamSynchronizer.registerStream(participantId, stream);
        
        // Dispatch event for components
        window.dispatchEvent(new CustomEvent(`stream-received-${participantId}`, {
          detail: { participantId, stream, timestamp: Date.now() }
        }));
      }
    };
    
    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.log(`⏰ ROBUST: Connection timeout for ${participantId}`);
      recordFailure(participantId);
      cleanupConnection(participantId);
      updateConnectionState('webrtc', 'failed');
    }, DESKTOP_CONFIG.connectionTimeout);
    
    connectionTimeouts.current.set(participantId, connectionTimeout);
    
    // Set ICE timeout
    const iceTimeout = setTimeout(() => {
      console.log(`⏰ ROBUST: ICE timeout for ${participantId}`);
      if (pc.iceGatheringState !== 'complete') {
        console.log(`❌ ROBUST: ICE gathering incomplete for ${participantId}`);
        recordFailure(participantId);
        cleanupConnection(participantId);
      }
    }, DESKTOP_CONFIG.iceTimeout);
    
    iceTimeouts.current.set(participantId, iceTimeout);
    
    return pc;
  }, [sessionId, isCircuitBreakerOpen, cleanupConnection, recordFailure, resetCircuitBreaker, updateConnectionState]);

  const initializeAsHost = useCallback(async (sessionId: string) => {
    console.log(`🖥️ ROBUST: Initializing as host for session ${sessionId}`);
    
    try {
      updateConnectionState('websocket', 'connecting');
      
      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(sessionId, 'host');
      
      updateConnectionState('websocket', 'connected');
      console.log(`✅ ROBUST: Host initialized for session ${sessionId}`);
      
    } catch (error) {
      console.error(`❌ ROBUST: Failed to initialize host:`, error);
      updateConnectionState('websocket', 'failed');
      throw error;
    }
  }, [updateConnectionState]);

  const initializeAsParticipant = useCallback(async (sessionId: string, participantId: string, stream: MediaStream) => {
    console.log(`👤 ROBUST: Initializing as participant ${participantId}`);
    
    try {
      localStream.current = stream;
      updateConnectionState('websocket', 'connecting');
      
      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await unifiedWebSocketService.connect();
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      
      updateConnectionState('websocket', 'connected');
      console.log(`✅ ROBUST: Participant initialized: ${participantId}`);
      
    } catch (error) {
      console.error(`❌ ROBUST: Failed to initialize participant:`, error);
      updateConnectionState('websocket', 'failed');
      throw error;
    }
  }, [updateConnectionState]);

  const connectToHost = useCallback(async () => {
    if (!localStream.current) {
      throw new Error('No local stream available');
    }
    
    console.log(`🔗 ROBUST: Connecting to host`);
    updateConnectionState('webrtc', 'connecting');
    
    try {
      const pc = createPeerConnection('host');
      
      // Add local stream tracks
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      unifiedWebSocketService.sendOffer('host', offer);
      console.log(`📤 ROBUST: Offer sent to host`);
      
    } catch (error) {
      console.error(`❌ ROBUST: Failed to connect to host:`, error);
      updateConnectionState('webrtc', 'failed');
      throw error;
    }
  }, [createPeerConnection, updateConnectionState]);

  const forceReset = useCallback(() => {
    console.log(`🔥 ROBUST: Force reset all connections`);
    
    // Clear all connections
    peerConnections.current.forEach((pc, participantId) => {
      cleanupConnection(participantId);
    });
    
    // Reset circuit breakers
    circuitBreaker.current.clear();
    retryAttempts.current.clear();
    isConnecting.current.clear();
    
    // Reset state
    setConnectionState({
      websocket: unifiedWebSocketService.isConnected() ? 'connected' : 'disconnected',
      webrtc: 'disconnected',
      overall: unifiedWebSocketService.isConnected() ? 'connected' : 'disconnected'
    });
    
    toast({
      title: "Conexão Reiniciada",
      description: "Sistema WebRTC foi reiniciado com sucesso",
    });
  }, [cleanupConnection, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`🧹 ROBUST: Cleaning up all connections`);
      peerConnections.current.forEach((pc, participantId) => {
        cleanupConnection(participantId);
      });
    };
  }, [cleanupConnection]);

  return {
    connectionState,
    initializeAsHost,
    initializeAsParticipant,
    connectToHost,
    forceReset,
    createPeerConnection,
    cleanupConnection
  };
};