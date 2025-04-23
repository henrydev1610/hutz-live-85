
import { useState, useEffect, useRef } from 'react';
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
  
  // Configuration with H.264 codec preference
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan',
    iceCandidatePoolSize: 10
  };
  
  // Set H.264 codec preference
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
  const initializeHostCamera = async () => {
    if (isInitializing || localStreamRef.current) {
      console.log('Camera already initializing or initialized');
      return localStreamRef.current;
    }
    
    try {
      setIsInitializing(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsHost(true);
      setIsInitializing(false);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setIsInitializing(false);
      toast({
        title: 'Erro de câmera',
        description: 'Não foi possível acessar a câmera ou microfone.',
        variant: 'destructive'
      });
      return null;
    }
  };
  
  // Initialize camera for participant - with protection against multiple initializations
  const initializeParticipantCamera = async () => {
    if (isInitializing || localStreamRef.current) {
      console.log('Camera already initializing or initialized');
      return localStreamRef.current;
    }
    
    try {
      setIsInitializing(true);
      
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      };
      
      // Add codec preference for browsers that support it
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
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
          console.warn('Could not apply ideal constraints:', e);
        }
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsHost(false);
      setIsInitializing(false);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setIsInitializing(false);
      toast({
        title: 'Erro de câmera',
        description: 'Não foi possível acessar a câmera ou microfone.',
        variant: 'destructive'
      });
      return null;
    }
  };
  
  // Create peer connection with H.264 preference
  const createPeerConnection = (participantId: string) => {
    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send the ICE candidate to the remote peer
        // This would be done through your signaling server
        console.log('ICE candidate', event.candidate);
      }
    };
    
    peerConnection.ontrack = (event) => {
      console.log('Received remote track', event.streams[0]);
      if (onNewParticipant && event.streams[0]) {
        onNewParticipant({
          id: participantId,
          name: `Participante ${participantId.substring(0, 5)}`,
          stream: event.streams[0]
        });
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setIsConnected(true);
      } else if (peerConnection.connectionState === 'failed' || 
                peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'closed') {
        // Remove the connection
        setConnections(prev => prev.filter(conn => conn.id !== participantId));
        connectionRef.current = connectionRef.current.filter(conn => conn.id !== participantId);
        
        if (onParticipantLeft) {
          onParticipantLeft(participantId);
        }
      }
    };
    
    // Add local stream tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }
    
    const newConnection = { id: participantId, connection: peerConnection };
    setConnections(prev => [...prev, newConnection]);
    connectionRef.current = [...connectionRef.current, newConnection];
    
    return peerConnection;
  };
  
  // Create offer with H.264 preference
  const createOffer = async (participantId: string) => {
    const peerConnection = createPeerConnection(participantId);
    
    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      // Modify SDP to prefer H.264
      offer.sdp = setH264Preference(offer.sdp || '');
      
      await peerConnection.setLocalDescription(offer);
      
      return {
        peerConnection,
        offer
      };
    } catch (err) {
      console.error('Error creating offer:', err);
      return null;
    }
  };
  
  // Process answer from remote peer
  const processAnswer = async (participantId: string, answer: RTCSessionDescriptionInit) => {
    const peerConnection = connections.find(conn => conn.id === participantId)?.connection;
    
    if (!peerConnection) {
      console.error('No peer connection found for participant', participantId);
      return;
    }
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Error setting remote description:', err);
    }
  };
  
  // Process ICE candidate
  const processIceCandidate = async (participantId: string, candidate: RTCIceCandidateInit) => {
    const peerConnection = connections.find(conn => conn.id === participantId)?.connection;
    
    if (!peerConnection) {
      console.error('No peer connection found for participant', participantId);
      return;
    }
    
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };
  
  // Clean up connections
  const cleanupConnections = () => {
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
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupConnections();
    };
  }, []);
  
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
