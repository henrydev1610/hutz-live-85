import { io, Socket } from 'socket.io-client';
import { getWebSocketURL } from '@/utils/connectionUtils';

interface MobileSignalingCallbacks {
  onConnected?: () => void;
  onConnectionFailed?: (error: any) => void;
  onUserConnected?: (data: any) => void;
  onUserDisconnected?: (data: any) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onOffer?: (data: any) => void;
  onAnswer?: (data: any) => void;
  onIceCandidate?: (data: any) => void;
  onStreamStarted?: (data: any) => void;
}

class MobileWebSocketService {
  private socket: Socket | null = null;
  private callbacks: MobileSignalingCallbacks = {};
  private isConnected = false;
  private currentRoom: string | null = null;
  private currentUserId: string | null = null;
  private connectPromise: Promise<void> | null = null;

  constructor() {
    console.log('📱 MOBILE WebSocket Service initialized');
  }

  setCallbacks(callbacks: MobileSignalingCallbacks) {
    this.callbacks = callbacks;
    console.log('📱 MOBILE: Callbacks set');
  }

  async connect(serverUrl?: string): Promise<void> {
    // Evitar múltiplas conexões simultâneas
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this._doConnect(serverUrl);
    return this.connectPromise;
  }

  private async _doConnect(serverUrl?: string): Promise<void> {
    const url = serverUrl || getWebSocketURL();
    
    console.log(`📱 MOBILE: Starting connection to ${url}`);
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Configuração ESPECÍFICA para mobile Chrome
    const mobileOptions = {
      transports: ['polling', 'websocket'], // Polling primeiro no mobile
      timeout: 30000, // Timeout longo para mobile
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      maxHttpBufferSize: 1e6, // 1MB buffer
      withCredentials: false,
      autoConnect: false, // Conectar manualmente
      upgrade: true, // Permitir upgrade para WebSocket
      pingTimeout: 60000,
      pingInterval: 25000,
      // Headers específicos para mobile
      extraHeaders: {
        'User-Agent': navigator.userAgent
      }
    };

    console.log('📱 MOBILE: Using mobile-specific Socket.IO options');

    this.socket = io(url, mobileOptions);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        console.error('📱 MOBILE: Connection timeout');
        this.callbacks.onConnectionFailed?.(new Error('Connection timeout'));
        reject(new Error('Mobile WebSocket connection timeout'));
      }, 35000); // 35s timeout

      this.socket!.on('connect', () => {
        clearTimeout(timeoutId);
        console.log(`📱 MOBILE: Connected successfully! Socket ID: ${this.socket!.id}`);
        this.isConnected = true;
        this.setupEventListeners();
        this.callbacks.onConnected?.();
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(timeoutId);
        console.error('📱 MOBILE: Connection error:', error);
        this.callbacks.onConnectionFailed?.(error);
        reject(new Error(`Mobile connection failed: ${error.message || error}`));
      });

      this.socket!.on('disconnect', (reason) => {
        console.log('📱 MOBILE: Disconnected:', reason);
        this.isConnected = false;
        
        // Auto-reconectar em casos específicos
        if (reason === 'io server disconnect' || reason === 'transport close') {
          console.log('📱 MOBILE: Auto-reconnecting...');
          setTimeout(() => {
            if (!this.isConnected && this.socket) {
              this.socket.connect();
            }
          }, 3000);
        }
      });

      this.socket!.on('error', (error) => {
        console.error('📱 MOBILE: Socket error:', error);
        this.callbacks.onConnectionFailed?.(error);
      });

      // Conectar manualmente
      console.log('📱 MOBILE: Starting manual connection...');
      this.socket!.connect();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    console.log('📱 MOBILE: Setting up event listeners');

    this.socket.on('user-connected', (data) => {
      console.log('📱 MOBILE: User connected:', data);
      this.callbacks.onUserConnected?.(data);
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('📱 MOBILE: User disconnected:', data);
      this.callbacks.onUserDisconnected?.(data);
    });

    this.socket.on('participants-update', (data) => {
      console.log('📱 MOBILE: Participants update:', data);
      this.callbacks.onParticipantsUpdate?.(data.participants || []);
    });

    this.socket.on('room-participants', (data) => {
      console.log('📱 MOBILE: Room participants:', data);
      this.callbacks.onParticipantsUpdate?.(data.participants || []);
    });

    this.socket.on('offer', (data) => {
      console.log('📱 MOBILE: Received offer');
      this.callbacks.onOffer?.(data);
    });

    this.socket.on('answer', (data) => {
      console.log('📱 MOBILE: Received answer');
      this.callbacks.onAnswer?.(data);
    });

    this.socket.on('ice', (data) => {
      console.log('📱 MOBILE: Received ICE candidate');
      this.callbacks.onIceCandidate?.(data);
    });

    this.socket.on('ice-candidate', (data) => {
      console.log('📱 MOBILE: Received ICE candidate (new format)');
      this.callbacks.onIceCandidate?.(data);
    });

    this.socket.on('stream-started', (data) => {
      console.log('📱 MOBILE: Stream started:', data);
      this.callbacks.onStreamStarted?.(data);
    });

    this.socket.on('room-error', (error) => {
      console.error('📱 MOBILE: Room error:', error);
      this.callbacks.onConnectionFailed?.(error);
    });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`📱 MOBILE: Joining room ${roomId} as ${userId}`);
    
    this.currentRoom = roomId;
    this.currentUserId = userId;

    if (!this.socket || !this.isConnected) {
      console.log('📱 MOBILE: Socket not connected, connecting...');
      await this.connect();
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', {
        roomId,
        userId,
        timestamp: Date.now(),
        isMobile: true,
        userAgent: navigator.userAgent
      });
      console.log('📱 MOBILE: Join room request sent');
    } else {
      throw new Error('Mobile WebSocket connection failed');
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
      console.log('📱 MOBILE: Offer sent');
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
      console.log('📱 MOBILE: Answer sent');
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
      console.log('📱 MOBILE: ICE candidate sent');
    }
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    console.log(`📱 MOBILE: Notifying stream started for ${participantId}`);
    
    if (this.socket && this.isConnected) {
      this.socket.emit('stream-started', {
        participantId,
        roomId: this.currentRoom,
        streamInfo: {
          ...streamInfo,
          isMobile: true,
          userAgent: navigator.userAgent
        },
        timestamp: Date.now()
      });
    }
  }

  isReady(): boolean {
    const ready = this.isConnected && this.socket && this.socket.connected;
    console.log(`📱 MOBILE: Connection ready check: ${ready}`);
    return ready;
  }

  getConnectionStatus(): string {
    if (this.isConnected && this.socket?.connected) return 'connected';
    if (this.connectPromise) return 'connecting';
    return 'disconnected';
  }

  disconnect(): void {
    console.log('📱 MOBILE: Disconnecting');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUserId = null;
    this.connectPromise = null;
  }
}

export default new MobileWebSocketService();