
import { io, Socket } from 'socket.io-client';

interface SignalingCallbacks {
  onUserConnected?: (data: any) => void;
  onUserDisconnected?: (data: any) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onOffer?: (data: any) => void;
  onAnswer?: (data: any) => void;
  onIceCandidate?: (data: any) => void;
  onError?: (error: any) => void;
}

class WebSocketSignalingService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private connectionAttempts = 0;
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;
  private fallbackMode = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;

  constructor() {
    console.log('🔧 WebSocket Signaling Service initialized');
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🚪 Joining room ${roomId} as ${userId}`);
    
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    
    return new Promise((resolve, reject) => {
      this.connectWithRetry(roomId, userId, resolve, reject);
    });
  }

  private connectWithRetry(roomId: string, userId: string, resolve: Function, reject: Function) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    
    console.log(`🔄 Attempting WebSocket connection to: ${baseUrl} (attempt ${this.connectionAttempts + 1})`);
    
    this.socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected to signaling server');
      this.connectionAttempts = 0;
      this.fallbackMode = false;
      
      // Join the room
      this.socket!.emit('join-room', { roomId, userId });
    });

    this.socket.on('ice-servers', (data) => {
      console.log('📡 Received ICE servers:', data.servers);
    });

    this.socket.on('room-participants', (data) => {
      console.log('👥 Room participants via WebSocket:', data.participants);
      if (this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(data.participants);
      }
      resolve();
    });

    this.socket.on('user-connected', (data) => {
      console.log('👤 User connected via WebSocket:', data);
      if (this.callbacks.onUserConnected) {
        this.callbacks.onUserConnected(data);
      }
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('👤 User disconnected via WebSocket:', data);
      if (this.callbacks.onUserDisconnected) {
        this.callbacks.onUserDisconnected(data);
      }
    });

    // WebRTC signaling events
    this.socket.on('offer', (data) => {
      console.log('📤 Received offer via WebSocket:', data);
      if (this.callbacks.onOffer) {
        this.callbacks.onOffer(data);
      }
    });

    this.socket.on('answer', (data) => {
      console.log('📥 Received answer via WebSocket:', data);
      if (this.callbacks.onAnswer) {
        this.callbacks.onAnswer(data);
      }
    });

    this.socket.on('ice', (data) => {
      console.log('🧊 Received ICE candidate via WebSocket:', data);
      if (this.callbacks.onIceCandidate) {
        this.callbacks.onIceCandidate(data);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.warn(`⚠️ WebSocket connection failed (attempt ${this.connectionAttempts + 1}):`, error);
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxRetries) {
        console.log('❌ Max WebSocket retries reached, enabling fallback mode');
        this.fallbackMode = true;
        if (this.callbacks.onError) {
          this.callbacks.onError({ message: 'WebSocket connection failed, operating in fallback mode' });
        }
        resolve(); // Resolve even in fallback mode
      } else {
        this.retryTimeout = setTimeout(() => {
          this.connectWithRetry(roomId, userId, resolve, reject);
        }, 2000 * this.connectionAttempts);
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    });
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescription) {
    if (this.socket && this.socket.connected && this.currentRoomId) {
      console.log('📤 Sending offer to:', targetUserId);
      this.socket.emit('offer', {
        roomId: this.currentRoomId,
        targetSocketId: targetUserId,
        offer: offer
      });
    }
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescription) {
    if (this.socket && this.socket.connected && this.currentRoomId) {
      console.log('📥 Sending answer to:', targetUserId);
      this.socket.emit('answer', {
        roomId: this.currentRoomId,
        targetSocketId: targetUserId,
        answer: answer
      });
    }
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate) {
    if (this.socket && this.socket.connected && this.currentRoomId) {
      console.log('🧊 Sending ICE candidate to:', targetUserId);
      this.socket.emit('ice', {
        roomId: this.currentRoomId,
        targetSocketId: targetUserId,
        candidate: candidate
      });
    }
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  disconnect() {
    console.log('🔌 Disconnecting from signaling server');
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionAttempts = 0;
    this.fallbackMode = false;
    this.currentRoomId = null;
    this.currentUserId = null;
  }
}

const signalingService = new WebSocketSignalingService();
export default signalingService;
