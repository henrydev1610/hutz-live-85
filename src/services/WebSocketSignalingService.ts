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
  private mockMode = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  constructor() {
    this.connect();
  }

  private connect() {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    
    console.log(`🔄 Attempting to connect to signaling server: ${socketUrl} (attempt ${this.connectionAttempts + 1})`);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000, // Reduzir timeout para falhar mais rápido
      reconnection: false, // Desabilitar reconexão automática
      forceNew: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to signaling server');
      this.connectionAttempts = 0;
      this.mockMode = false;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
      this.stopHeartbeat();
      this.tryFallbackMode();
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.connectionAttempts++;
      this.tryFallbackMode();
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

  private tryFallbackMode() {
    if (this.connectionAttempts >= this.maxConnectionAttempts && !this.mockMode) {
      console.log('🔄 Switching to mock mode for local development');
      this.mockMode = true;
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    }
  }

  // Entrar na sala
  joinRoom(roomId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentRoomId = roomId;
      this.currentUserId = userId;

      console.log(`🚪 Joining room ${roomId} as ${userId}`);

      if (this.mockMode || !this.socket?.connected) {
        console.log('🔧 Using mock mode - simulating successful connection');
        setTimeout(() => {
          resolve();
        }, 100);
        return;
      }
      
      this.socket.emit('join-room', { roomId, userId });
      
      // Iniciar heartbeat
      this.startHeartbeat();
      
      // Aguardar confirmação (timeout reduzido)
      const timeout = setTimeout(() => {
        console.warn('⚠️ Timeout joining room, switching to mock mode');
        this.mockMode = true;
        resolve();
      }, 3000); // Reduzido de 5000 para 3000

      const onConnected = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.socket.once('ice-servers', onConnected);
    });
  }

  // Sair da sala
  leaveRoom() {
    if (!this.currentRoomId) return;

    console.log(`🚪 Leaving room ${this.currentRoomId}`);
    
    if (this.socket?.connected && !this.mockMode) {
      this.socket.emit('leave-room');
    }
    
    this.stopHeartbeat();
    
    this.currentRoomId = null;
    this.currentUserId = null;
  }

  // Enviar oferta WebRTC
  sendOffer(offer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (this.mockMode) {
      console.log('🔧 Mock mode: offer would be sent to:', targetSocketId || 'all');
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

  // Enviar resposta WebRTC
  sendAnswer(answer: RTCSessionDescriptionInit, targetSocketId?: string) {
    if (this.mockMode) {
      console.log('🔧 Mock mode: answer would be sent to:', targetSocketId || 'all');
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

  // Enviar candidato ICE
  sendIceCandidate(candidate: RTCIceCandidateInit, targetSocketId?: string) {
    if (this.mockMode) {
      console.log('🔧 Mock mode: ICE candidate would be sent to:', targetSocketId || 'all');
      return;
    }

    if (!this.socket?.connected || !this.currentRoomId) return;

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
      if (this.mockMode) {
        return; // Não enviar heartbeat em mock mode
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

  // Parar heartbeat
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Verificar se está conectado
  isConnected(): boolean {
    return this.mockMode || (this.socket?.connected || false);
  }

  // Obter ID do socket atual
  getSocketId(): string | null {
    if (this.mockMode) {
      return `mock-socket-${Date.now()}`;
    }
    return this.socket?.id || null;
  }

  // Verificar se está em modo mock
  isMockMode(): boolean {
    return this.mockMode;
  }

  // Desconectar
  disconnect() {
    this.leaveRoom();
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.mockMode = false;
    this.connectionAttempts = 0;
  }
}

// Instância singleton
export const signalingService = new WebSocketSignalingService();
export default signalingService;
