
import { io, Socket } from 'socket.io-client';

interface SignalingCallbacks {
  onOffer?: (data: { offer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onAnswer?: (data: { answer: RTCSessionDescriptionInit; fromSocketId: string; fromUserId: string }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidateInit; fromSocketId: string; fromUserId: string }) => void;
  onUserConnected?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onUserDisconnected?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onUserHeartbeat?: (data: { userId: string; socketId: string; timestamp: number }) => void;
  onError?: (data: { message: string }) => void;
}

class WebSocketSignalingService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private heartbeatInterval: number | null = null;
  private iceServers: RTCIceServer[] = [];

  constructor() {
    this.connect();
  }

  private connect() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to signaling server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
      this.stopHeartbeat();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    // Receber configuração dos servidores ICE
    this.socket.on('ice-servers', (data: { servers: RTCIceServer[] }) => {
      console.log('📡 Received ICE servers:', data.servers);
      this.iceServers = data.servers;
    });

    // Eventos WebRTC
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

    // Eventos de participantes
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
      console.log('👥 Room participants:', data.participants);
    });

    // Eventos de erro
    this.socket.on('error', (data) => {
      console.error('❌ Signaling error:', data);
      this.callbacks.onError?.(data);
    });
  }

  // Entrar na sala
  joinRoom(roomId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.currentRoomId = roomId;
      this.currentUserId = userId;

      console.log(`🚪 Joining room ${roomId} as ${userId}`);
      
      this.socket.emit('join-room', { roomId, userId });
      
      // Iniciar heartbeat
      this.startHeartbeat();
      
      // Aguardar confirmação (timeout de 5 segundos)
      const timeout = setTimeout(() => {
        reject(new Error('Timeout joining room'));
      }, 5000);

      const onConnected = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.socket.once('ice-servers', onConnected);
    });
  }

  // Sair da sala
  leaveRoom() {
    if (!this.socket || !this.currentRoomId) return;

    console.log(`🚪 Leaving room ${this.currentRoomId}`);
    
    this.socket.emit('leave-room');
    this.stopHeartbeat();
    
    this.currentRoomId = null;
    this.currentUserId = null;
  }

  // Enviar oferta WebRTC
  sendOffer(offer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (!this.socket || !this.currentRoomId) return;

    console.log('📤 Sending offer to:', targetSocketId || 'all');
    
    this.socket.emit('offer', {
      roomId: this.currentRoomId,
      targetSocketId,
      offer
    });
  }

  // Enviar resposta WebRTC
  sendAnswer(answer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (!this.socket || !this.currentRoomId) return;

    console.log('📥 Sending answer to:', targetSocketId || 'all');
    
    this.socket.emit('answer', {
      roomId: this.currentRoomId,
      targetSocketId,
      answer
    });
  }

  // Enviar candidato ICE
  sendIceCandidate(candidate: RTCIceCandidateInit, targetSocketId?: string) {
    if (!this.socket || !this.currentRoomId) return;

    this.socket.emit('ice', {
      roomId: this.currentRoomId,
      targetSocketId,
      candidate
    });
  }

  // Configurar callbacks
  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Obter servidores ICE
  getIceServers(): RTCIceServer[] {
    return this.iceServers.length > 0 ? this.iceServers : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }

  // Iniciar heartbeat
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket && this.currentRoomId) {
        this.socket.emit('heartbeat', {
          roomId: this.currentRoomId,
          userId: this.currentUserId,
          timestamp: Date.now()
        });
      }
    }, 5000); // A cada 5 segundos
  }

  // Parar heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Verificar se está conectado
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Obter ID do socket atual
  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  // Desconectar
  disconnect() {
    this.leaveRoom();
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Instância singleton
export const signalingService = new WebSocketSignalingService();
export default signalingService;
