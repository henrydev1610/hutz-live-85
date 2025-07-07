
import { io, Socket } from 'socket.io-client';

interface SignalingCallbacks {
  onUserConnected?: (data: any) => void;
  onUserDisconnected?: (data: any) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onOffer?: (data: any) => void;
  onAnswer?: (data: any) => void;
  onIceCandidate?: (data: any) => void;
  onStreamStarted?: (data: any) => void;
  onVideoStream?: (data: any) => void;
  onParticipantVideo?: (data: any) => void;
  onError?: (error: any) => void;
}

class MobileWebSocketService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private isConnected = false;
  private currentRoom: string | null = null;
  private currentUserId: string | null = null;
  private connectionAttempts = 0;
  private maxAttempts = 3;
  private isMobile = false;
  private forceWebSocketMode = true; // Força modo WebSocket no mobile

  constructor() {
    this.detectMobile();
    console.log('📱 Mobile WebSocket Service initialized - Mobile detected:', this.isMobile);
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
    console.log('📞 Mobile WebSocket callbacks set');
  }

  async connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || 'http://localhost:3001';
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log(`🔌 Mobile WebSocket connecting to: ${url} (Attempt: ${this.connectionAttempts + 1})`);
    
    // Configurações otimizadas especificamente para mobile
    const mobileConfig = {
      transports: ['websocket'], // APENAS WebSocket no mobile
      upgrade: false, // Não fazer upgrade, manter WebSocket
      timeout: 8000, // Timeout menor e mais agressivo
      forceNew: true,
      reconnection: false, // Desabilitar reconexão automática
      autoConnect: true,
      withCredentials: false,
      pingTimeout: 20000,
      pingInterval: 15000
    };

    console.log('⚙️ Mobile WebSocket config:', mobileConfig);

    this.socket = io(url, mobileConfig);
    this.connectionAttempts++;

    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        console.warn('⏱️ Mobile WebSocket timeout after 8s');
        
        if (this.connectionAttempts < this.maxAttempts) {
          console.log(`🔄 Retry ${this.connectionAttempts}/${this.maxAttempts}`);
          this.connect(serverUrl).then(resolve).catch(reject);
        } else {
          console.error('❌ Mobile WebSocket max attempts reached');
          reject(new Error('Mobile WebSocket connection failed'));
        }
      }, 8000);

      this.socket!.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log('✅ Mobile WebSocket connected! Socket ID:', this.socket!.id);
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.forceWebSocketMode = true;
        this.setupEventListeners();
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        console.error('❌ Mobile WebSocket connection error:', error);
        
        if (this.connectionAttempts < this.maxAttempts) {
          console.log(`🔄 Retry ${this.connectionAttempts}/${this.maxAttempts} in 1s`);
          setTimeout(() => {
            this.connect(serverUrl).then(resolve).catch(reject);
          }, 1000);
        } else {
          console.error('❌ Mobile WebSocket all attempts failed');
          reject(error);
        }
      });

      this.socket!.on('disconnect', (reason) => {
        console.log('🔌 Mobile WebSocket disconnected:', reason);
        this.isConnected = false;
        
        if (reason === 'io server disconnect' && this.forceWebSocketMode) {
          console.log('🔄 Server disconnected, force reconnecting...');
          setTimeout(() => this.socket?.connect(), 1000);
        }
      });

      this.socket!.on('error', (error) => {
        console.error('❌ Mobile WebSocket error:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      });
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    console.log('🎧 Setting up Mobile WebSocket event listeners');

    this.socket.on('user-connected', (data) => {
      console.log('👤 Mobile WebSocket: User connected:', data);
      if (this.callbacks.onUserConnected) {
        this.callbacks.onUserConnected(data);
      }
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('👤 Mobile WebSocket: User disconnected:', data);
      if (this.callbacks.onUserDisconnected) {
        this.callbacks.onUserDisconnected(data);
      }
    });

    this.socket.on('participants-update', (data) => {
      console.log('👥 Mobile WebSocket: Participants update:', data);
      if (this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(data.participants || []);
      }
    });

    this.socket.on('offer', (data) => {
      console.log('📤 Mobile WebSocket: Received offer');
      if (this.callbacks.onOffer) {
        this.callbacks.onOffer(data);
      }
    });

    this.socket.on('answer', (data) => {
      console.log('📥 Mobile WebSocket: Received answer');
      if (this.callbacks.onAnswer) {
        this.callbacks.onAnswer(data);
      }
    });

    this.socket.on('ice-candidate', (data) => {
      console.log('🧊 Mobile WebSocket: Received ICE candidate');
      if (this.callbacks.onIceCandidate) {
        this.callbacks.onIceCandidate(data);
      }
    });

    this.socket.on('stream-started', (data) => {
      console.log('🎥 Mobile WebSocket: Stream started');
      if (this.callbacks.onStreamStarted) {
        this.callbacks.onStreamStarted(data);
      }
    });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🏠 Mobile WebSocket joining room: ${roomId} as user: ${userId}`);
    
    this.currentRoom = roomId;
    this.currentUserId = userId;

    if (!this.socket || !this.isConnected) {
      console.log('🔄 Socket not connected, connecting...');
      await this.connect();
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', {
        roomId,
        userId,
        timestamp: Date.now(),
        isMobile: true,
        connectionType: 'websocket-mobile'
      });
      console.log('✅ Mobile WebSocket room join request sent');
    } else {
      throw new Error('Mobile WebSocket connection failed');
    }
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    console.log(`📹 Mobile WebSocket: Notifying stream started for: ${participantId}`);
    
    if (this.socket && this.isConnected) {
      this.socket.emit('stream-started', {
        participantId,
        roomId: this.currentRoom,
        streamInfo: {
          ...streamInfo,
          isMobile: true,
          connectionType: 'websocket-mobile'
        },
        timestamp: Date.now()
      });
    }
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('offer', {
        targetUserId,
        offer,
        roomId: this.currentRoom,
        fromUserId: this.currentUserId,
        isMobile: true
      });
    }
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('answer', {
        targetUserId,
        answer,
        roomId: this.currentRoom,
        fromUserId: this.currentUserId,
        isMobile: true
      });
    }
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice-candidate', {
        targetUserId,
        candidate,
        roomId: this.currentRoom,
        fromUserId: this.currentUserId,
        isMobile: true
      });
    }
  }

  isReady(): boolean {
    return this.isConnected && this.forceWebSocketMode;
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  getConnectionStatus(): string {
    if (this.isConnected && this.forceWebSocketMode) return 'connected';
    if (this.connectionAttempts > 0) return 'connecting';
    return 'disconnected';
  }

  disconnect(): void {
    console.log('🔌 Mobile WebSocket disconnecting');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUserId = null;
    this.connectionAttempts = 0;
    this.forceWebSocketMode = false;
  }
}

export default new MobileWebSocketService();
