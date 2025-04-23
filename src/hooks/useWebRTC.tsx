
import { useState, useEffect, useRef, useCallback } from 'react';
import { Participant } from '@/types/live';
import { useToast } from '@/hooks/use-toast';

interface WebRTCOptions {
  sessionId: string | null;
  onNewParticipant?: (participant: Participant) => void;
  onParticipantLeft?: (participantId: string) => void;
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
}

export const useWebRTC = ({ sessionId, onNewParticipant, onParticipantLeft }: WebRTCOptions) => {
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connections, setConnections] = useState<PeerConnection[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const connectionRef = useRef<PeerConnection[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Enhanced configuration with multiple STUN servers for better connectivity
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan',
    iceCandidatePoolSize: 10
  };
  
  // Set H.264 codec preference for better compatibility
  const setH264Preference = (sdp: string) => {
    // Split the SDP into lines
    const lines = sdp.split('\r\n');
    // Find the video media section
    const videoMLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (videoMLineIndex === -1) {
      return sdp;
    }
    
    // Find all codec payload types
    let payloadTypes = [];
    for (let i = videoMLineIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('m=')) {
        break; // Next media section
      }
      
      if (lines[i].indexOf('a=rtpmap:') === 0) {
        const parts = lines[i].split(' ');
        if (parts.length > 1) {
          const pt = parts[0].split(':')[1];
          payloadTypes.push({ pt, line: lines[i] });
        }
      }
    }
    
    // Find H.264 payload types
    const h264Types = payloadTypes
      .filter(pt => pt.line.indexOf('H264') !== -1)
      .map(pt => pt.pt);
    
    if (h264Types.length === 0) {
      console.log('H.264 codec not found in SDP');
      return sdp;
    }
    
    // Reorder payload types in the m=video line to prioritize H.264
    const mLine = lines[videoMLineIndex].split(' ');
    const mLineFormat = mLine.slice(0, 3); // Keep "m=video <port> <proto>"
    let newPayloadOrder = h264Types;
    
    // Add other payload types
    const otherTypes = mLine.slice(3).filter(pt => !h264Types.includes(pt));
    newPayloadOrder = [...newPayloadOrder, ...otherTypes];
    
    // Construct new m=video line
    lines[videoMLineIndex] = [...mLineFormat, ...newPayloadOrder].join(' ');
    
    return lines.join('\r\n');
  };

  // Initialize camera for host - with protection against multiple initializations
  const initializeHostCamera = useCallback(async () => {
    if (isInitializing || localStreamRef.current) {
      console.log('[useWebRTC] Camera already initializing or initialized');
      return localStreamRef.current;
    }
    
    try {
      setIsInitializing(true);
      console.log('[useWebRTC] Attempting to initialize host camera');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      
      console.log('[useWebRTC] Host camera initialized successfully');
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsHost(true);
      setIsInitializing(false);
      return stream;
    } catch (err) {
      console.error('[useWebRTC] Error accessing media devices:', err);
      setIsInitializing(false);
      toast({
        title: 'Erro de câmera',
        description: 'Não foi possível acessar a câmera ou microfone.',
        variant: 'destructive'
      });
      return null;
    }
  }, [isInitializing, toast]);
  
  // Initialize camera for participant - with protection against multiple initializations
  const initializeParticipantCamera = useCallback(async () => {
    if (isInitializing || localStreamRef.current) {
      console.log('[useWebRTC] Camera already initializing or initialized');
      return localStreamRef.current;
    }
    
    try {
      setIsInitializing(true);
      console.log('[useWebRTC] Attempting to initialize participant camera');
      
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[useWebRTC] Participant camera initialized successfully');
      
      // Apply consistent video constraints
      stream.getVideoTracks().forEach(track => {
        const settings = {
          width: 1280,
          height: 720,
          frameRate: 30
        };
        
        try {
          track.applyConstraints(settings);
        } catch (e) {
          console.warn('[useWebRTC] Could not apply ideal constraints:', e);
        }
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsHost(false);
      setIsInitializing(false);
      return stream;
    } catch (err) {
      console.error('[useWebRTC] Error accessing media devices:', err);
      setIsInitializing(false);
      toast({
        title: 'Erro de câmera',
        description: 'Não foi possível acessar a câmera ou microfone.',
        variant: 'destructive'
      });
      return null;
    }
  }, [isInitializing, toast]);
  
  // Create peer connection with enhanced error handling
  const createPeerConnection = useCallback((participantId: string) => {
    console.log(`[useWebRTC] Creating peer connection for ${participantId}`);
    try {
      const peerConnection = new RTCPeerConnection(rtcConfig);
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[useWebRTC] New ICE candidate for ${participantId}:`, event.candidate);
          // In a real implementation, this would send the ICE candidate to the remote peer
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log(`[useWebRTC] Connection state changed for ${participantId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          console.log(`[useWebRTC] Connection established with ${participantId}`);
          setIsConnected(true);
        } else if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
          console.log(`[useWebRTC] Connection ${peerConnection.connectionState} with ${participantId}`);
          // Remove the connection
          setConnections(prev => prev.filter(conn => conn.id !== participantId));
          connectionRef.current = connectionRef.current.filter(conn => conn.id !== participantId);
          
          if (onParticipantLeft) {
            onParticipantLeft(participantId);
          }
        }
      };
      
      peerConnection.ontrack = (event) => {
        console.log(`[useWebRTC] Received track from ${participantId}:`, event.streams[0]);
        if (onNewParticipant && event.streams[0]) {
          onNewParticipant({
            id: participantId,
            name: `Participante ${participantId.substring(0, 5)}`,
            stream: event.streams[0]
          });
        }
      };
      
      // Add local stream tracks to the connection if available
      if (localStreamRef.current) {
        console.log(`[useWebRTC] Adding ${localStreamRef.current.getTracks().length} tracks to connection for ${participantId}`);
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      } else {
        console.warn(`[useWebRTC] No local stream available to add to connection for ${participantId}`);
      }
      
      const newConnection = { id: participantId, connection: peerConnection };
      setConnections(prev => [...prev, newConnection]);
      connectionRef.current = [...connectionRef.current, newConnection];
      
      return peerConnection;
    } catch (error) {
      console.error(`[useWebRTC] Error creating peer connection for ${participantId}:`, error);
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível criar conexão com o participante.',
        variant: 'destructive'
      });
      return null;
    }
  }, [onNewParticipant, onParticipantLeft, rtcConfig, toast]);
  
  // Create offer with H.264 preference
  const createOffer = useCallback(async (participantId: string) => {
    const peerConnection = createPeerConnection(participantId);
    if (!peerConnection) return null;
    
    try {
      console.log(`[useWebRTC] Creating offer for ${participantId}`);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Modify SDP to prefer H.264
      if (offer.sdp) {
        offer.sdp = setH264Preference(offer.sdp);
      }
      
      await peerConnection.setLocalDescription(offer);
      console.log(`[useWebRTC] Offer created for ${participantId}:`, offer);
      
      return {
        peerConnection,
        offer
      };
    } catch (err) {
      console.error(`[useWebRTC] Error creating offer for ${participantId}:`, err);
      return null;
    }
  }, [createPeerConnection, setH264Preference]);
  
  // Process answer from remote peer
  const processAnswer = useCallback(async (participantId: string, answer: RTCSessionDescriptionInit) => {
    console.log(`[useWebRTC] Processing answer from ${participantId}`);
    const peerConnection = connections.find(conn => conn.id === participantId)?.connection;
    
    if (!peerConnection) {
      console.error(`[useWebRTC] No peer connection found for ${participantId}`);
      return;
    }
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`[useWebRTC] Remote description set for ${participantId}`);
    } catch (err) {
      console.error(`[useWebRTC] Error setting remote description for ${participantId}:`, err);
    }
  }, [connections]);
  
  // Process ICE candidate
  const processIceCandidate = useCallback(async (participantId: string, candidate: RTCIceCandidateInit) => {
    console.log(`[useWebRTC] Processing ICE candidate for ${participantId}`);
    const peerConnection = connections.find(conn => conn.id === participantId)?.connection;
    
    if (!peerConnection) {
      console.error(`[useWebRTC] No peer connection found for ${participantId}`);
      return;
    }
    
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`[useWebRTC] ICE candidate added for ${participantId}`);
    } catch (err) {
      console.error(`[useWebRTC] Error adding ICE candidate for ${participantId}:`, err);
    }
  }, [connections]);
  
  // Clean up connections
  const cleanupConnections = useCallback(() => {
    console.log('[useWebRTC] Cleaning up all connections');
    connections.forEach(({ connection }) => {
      connection.close();
    });
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    setConnections([]);
    connectionRef.current = [];
    setLocalStream(null);
    setIsConnected(false);
    setIsInitializing(false);
  }, [connections]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupConnections();
    };
  }, [cleanupConnections]);
  
  return {
    localStream,
    connections,
    isConnected,
    isHost,
    isInitializing,
    initializeHostCamera,
    initializeParticipantCamera,
    createPeerConnection,
    createOffer,
    processAnswer,
    processIceCandidate,
    cleanupConnections
  };
};
