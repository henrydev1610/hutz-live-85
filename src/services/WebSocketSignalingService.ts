
import { io, Socket } from 'socket.io-client';
import { httpFallbackService } from './HttpFallbackService';

interface SignalingCallbacks {
  onOffer?: (data: { offer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onAnswer?: (data: { answer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidateInit; fromSocketId: string; fromUserId: string }) => void;
  onUserConnected?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onUserDisconnected?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onUserHeartbeat?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onError?: (data: { message: string }) => void;
}

class WebSocketSignalingService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private heartbeatInterval: number | null = null;
  private iceServers: RTCIceServer[] = [];
  private fallbackMode = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 2;

  constructor() {
    // Don't auto-connect in constructor to allow manual control
  }

  private connect() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    
    console.log(`🔄 Attempting WebSocket connection to: ${socketUrl} (attempt ${this.connectionAttempts + 1})`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 3000,
      reconnection: false,
      forceNew: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected to signaling server');
      this.connectionAttempts = 0;
      this.fallbackMode = false;
      
      // Stop HTTP fallback if it was running
      if (httpFallbackService.isPolling()) {
        httpFallbackService.stopPolling();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected from signaling server');
      this.stopHeartbeat();
      this.tryFallbackMode();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.connectionAttempts++;
      this.tryFallbackMode();
    });

    // Receber configuração dos servidores ICE
    this.socket.on('ice-servers', (data: { servers: RTCIceServer[] }) => {
      console.log('📡 Received ICE servers:', data.servers);
      this.iceServers = data.servers;
    });

    this.socket.on('offer', (data) => {
      console.log('📤 Received offer from:', data.fromUserId);
      this.callbacks.onOffer?.(data);
    });

    this.socket.on('answer', (data) => {
      console.log('📥 Received answer from:', data.fromUserId);
      this.callbacks.onAnswer?.(data);
    });

    this.socket.on('ice', (data) => {
      console.log('🧊 Received ICE candidate from:', data.fromUserId);
      this.callbacks.onIceCandidate?.(data);
    });

    this.socket.on('user-connected', (data) => {
      console.log('👤 User connected:', data.userId);
      this.callbacks.onUserConnected?.(data);
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('👤 User disconnected:', data.userId);
      this.callbacks.onUserDisconnected?.(data);
    });

    this.socket.on('user-heartbeat', (data) => {
      this.callbacks.onUserHeartbeat?.(data);
    });

    this.socket.on('room-participants', (data: { participants: Array<{ userId: string; socketId: string }> }) => {
      console.log('👥 Room participants via WebSocket:', data.participants);
      this.callbacks.onParticipantsUpdate?.(data.participants);
    });

    this.socket.on('error', (data) => {
      console.error('❌ Signaling error:', data);
      this.callbacks.onError?.(data);
    });
  }

  private tryFallbackMode() {
    if (this.connectionAttempts >= this.maxConnectionAttempts && !this.fallbackMode) {
      console.log('🔄 Switching to HTTP fallback mode');
      this.fallbackMode = true;
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
      
      // Start HTTP polling if we have a room
      if (this.currentRoomId) {
        this.startHttpFallback();
      }
    }
  }

  private startHttpFallback() {
    if (!this.currentRoomId) return;
    
    console.log('🔄 Starting HTTP fallback for room:', this.currentRoomId);
    
    httpFallbackService.setCallbacks({
      onParticipantsUpdate: (participants) => {
        console.log('👥 Participants updated via HTTP fallback:', participants);
        this.callbacks.onParticipantsUpdate?.(participants);
      },
      onError: (error) => {
        console.error('❌ HTTP fallback error:', error);
        this.callbacks.onError?.({ message: error });
      }
    });
    
    httpFallbackService.startPolling(this.currentRoomId, 3000);
  }

  joinRoom(roomId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentRoomId = roomId;
      this.currentUserId = userId;

      console.log(`🚪 Joining room ${roomId} as ${userId}`);

      // Try WebSocket first
      if (!this.socket) {
        this.connect();
      }

      if (this.fallbackMode || !this.socket) {
        console.log('🔧 Using HTTP fallback mode immediately');
        this.startHttpFallback();
        setTimeout(() => resolve(), 100);
        return;
      }
      
      this.socket.emit('join-room', { roomId, userId });
      this.startHeartbeat();
      
      // Timeout for WebSocket connection
      const timeout = setTimeout(() => {
        console.warn('⚠️ WebSocket timeout, switching to HTTP fallback');
        this.fallbackMode = true;
        this.startHttpFallback();
        resolve();
      }, 2000);

      const onConnected = () => {
        clearTimeout(timeout);
        resolve();
      };

      if (this.socket.connected) {
        onConnected();
      } else {
        this.socket.once('ice-servers', onConnected);
        this.socket.once('connect', onConnected);
      }
    });
  }

  leaveRoom() {
    if (!this.currentRoomId) return;

    console.log(`🚪 Leaving room ${this.currentRoomId}`);
    
    if (this.socket?.connected && !this.fallbackMode) {
      this.socket.emit('leave-room');
    }
    
    // Stop HTTP fallback
    httpFallbackService.stopPolling();
    
    this.stopHeartbeat();
    this.currentRoomId = null;
    this.currentUserId = null;
  }

  // Enviar oferta WebRTC
  sendOffer(offer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (this.fallbackMode) {
      console.log('🔧 HTTP fallback mode: offer would be sent to:', targetSocketId || 'all');
      return;
    }

    if (!this.socket?.connected || !this.currentRoomId) return;

    console.log('📤 Sending offer to:', targetSocketId || 'all');
    
    this.socket.emit('offer', {
      roomId: this.currentRoomId,
      targetSocketId,
      offer
    });
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (this.fallbackMode) {
      console.log('🔧 HTTP fallback mode: answer would be sent to:', targetSocketId || 'all');
      return;
    }

    if (!this.socket?.connected || !this.currentRoomId) return;

    console.log('📥 Sending answer to:', targetSocketId || 'all');
    
    this.socket.emit('answer', {
      roomId: this.currentRoomId,
      targetSocketId,
      answer
    });
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetSocketId?: string) {
    if (this.fallbackMode) {
      console.log('🔧 HTTP fallback mode: ICE candidate would be sent to:', targetSocketId || 'all');
      return;
    }

    if (!this.socket?.connected || !this.currentRoomId) return;

    this.socket.emit('ice', {
      roomId: this.currentRoomId,
      targetSocketId,
      candidate
    });
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getIceServers(): RTCIceServer[] {
    return this.iceServers.length > 0 ? this.iceServers : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.fallbackMode) {
        return;
      }

      if (this.socket?.connected && this.currentRoomId) {
        this.socket.emit('heartbeat', {
          roomId: this.currentRoomId,
          userId: this.currentUserId,
          timestamp: Date.now()
        });
      }
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isConnected(): boolean {
    return this.fallbackMode || (this.socket?.connected || false);
  }

  getSocketId(): string | null {
    if (this.fallbackMode) {
      return `fallback-socket-${Date.now()}`;
    }
    return this.socket?.id || null;
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  disconnect() {
    this.leaveRoom();
    this.stopHeartbeat();
    httpFallbackService.stopPolling();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.fallbackMode = false;
    this.connectionAttempts = 0;
  }
}

export const signalingService = new WebSocketSignalingService();
export default signalingService;
