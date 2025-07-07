
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

interface ConnectionMetrics {
  attempts: number;
  networkErrors: number;
  timeoutErrors: number;
  startTime: number;
  lastAttemptTime: number;
}

class WebSocketSignalingService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private isConnected = false;
  private currentRoom: string | null = null;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private isMobile = false;
  private connectionMetrics: ConnectionMetrics = {
    attempts: 0,
    networkErrors: 0,
    timeoutErrors: 0,
    startTime: 0,
    lastAttemptTime: 0
  };

  constructor() {
    this.detectMobile();
    console.log(`🔧 UNIFIED WebSocket Service initialized (Mobile: ${this.isMobile})`);
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private resetConnectionMetrics() {
    this.connectionMetrics = {
      attempts: 0,
      networkErrors: 0,
      timeoutErrors: 0,
      startTime: Date.now(),
      lastAttemptTime: 0
    };
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
    console.log(`📞 UNIFIED: Callbacks set (Mobile: ${this.isMobile})`);
  }

  async connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || 'http://localhost:3001';
    
    this.resetConnectionMetrics();
    console.log(`🔌 UNIFIED: Starting connection to ${url} (Mobile: ${this.isMobile}, Attempt: ${this.reconnectAttempts + 1})`);
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Configurações inteligentes com fallback para mobile
    const connectionOptions = this.isMobile ? {
      transports: ['websocket', 'polling'], // Permitir ambos no mobile com fallback
      timeout: 20000, // Timeout maior para mobile
      forceNew: true,
      reconnection: true, // Habilitar reconexão automática
      reconnectionAttempts: 5, // Mais tentativas para mobile
      reconnectionDelay: 2000, // Delay maior entre tentativas
      reconnectionDelayMax: 5000,
      withCredentials: false,
      autoConnect: true,
      upgrade: true, // Permitir upgrade para WebSocket
      pingTimeout: 30000, // Ping timeout maior
      pingInterval: 10000, // Ping mais frequente
      // Configurações específicas para mobile
      rememberUpgrade: false,
      rejectUnauthorized: false
    } : {
      transports: ['websocket', 'polling'], // Desktop pode usar ambos
      timeout: 10000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
      withCredentials: false,
      autoConnect: true,
      upgrade: true,
      pingTimeout: 20000,
      pingInterval: 15000
    };

    console.log(`⚙️ UNIFIED: Connection options (Mobile: ${this.isMobile}):`, connectionOptions);

    this.socket = io(url, connectionOptions);
    this.connectionMetrics.attempts++;
    this.connectionMetrics.lastAttemptTime = Date.now();

    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        this.connectionMetrics.timeoutErrors++;
        console.warn(`⏱️ UNIFIED: Connection timeout (Mobile: ${this.isMobile})`);
        
        this.reconnectAttempts++;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`🔄 UNIFIED: Retry ${this.reconnectAttempts}/${this.maxReconnectAttempts} (Mobile: ${this.isMobile})`);
          setTimeout(() => {
            this.connect(serverUrl).then(resolve).catch(reject);
          }, this.isMobile ? 2000 : 1000); // Delay maior no mobile
        } else {
          console.error(`❌ UNIFIED: Max attempts reached (Mobile: ${this.isMobile})`);
          reject(new Error(`WebSocket connection failed after ${this.maxReconnectAttempts} attempts`));
        }
      }, this.isMobile ? 15000 : 10000); // Timeout maior no mobile

      this.socket!.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log(`✅ UNIFIED: Connected successfully! Socket ID: ${this.socket!.id} (Mobile: ${this.isMobile})`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.setupEventListeners();
        resolve();
      });

      this.socket!.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        this.connectionMetrics.networkErrors++;
        console.error(`❌ UNIFIED: Connection error (Mobile: ${this.isMobile}):`, error);
        
        // No mobile, ser mais agressivo com retry
        this.reconnectAttempts++;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.isMobile ? 3000 : 1000; // Delay maior no mobile
          console.log(`🔄 UNIFIED: Retrying in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts}) (Mobile: ${this.isMobile})`);
          
          setTimeout(() => {
            this.connect(serverUrl).then(resolve).catch(reject);
          }, delay);
        } else {
          console.error(`❌ UNIFIED: All attempts failed (Mobile: ${this.isMobile})`);
          reject(new Error(`Connection failed: ${error.message || error}`));
        }
      });

      this.socket!.on('disconnect', (reason) => {
        console.log(`🔌 UNIFIED: Disconnected (Mobile: ${this.isMobile}):`, reason);
        this.isConnected = false;
        
        // No mobile, tentar reconectar mais agressivamente
        if (reason === 'io server disconnect' || (this.isMobile && reason !== 'io client disconnect')) {
          console.log(`🔄 UNIFIED: Auto-reconnecting (Mobile: ${this.isMobile})...`);
          setTimeout(() => {
            if (!this.isConnected) {
              this.socket?.connect();
            }
          }, this.isMobile ? 2000 : 1000);
        }
      });

      this.socket!.on('error', (error) => {
        console.error(`❌ UNIFIED: Socket error (Mobile: ${this.isMobile}):`, error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      });

      // Log de tipo de transporte conectado
      this.socket!.on('connect', () => {
        const transport = this.socket!.io.engine.transport.name;
        console.log(`🔗 UNIFIED: Connected via ${transport} (Mobile: ${this.isMobile})`);
      });

      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    console.log(`🎧 UNIFIED: Setting up event listeners (Mobile: ${this.isMobile})`);

    this.socket.on('user-connected', (data) => {
      console.log(`👤 UNIFIED: User connected (Mobile: ${this.isMobile}):`, data);
      if (this.callbacks.onUserConnected) {
        this.callbacks.onUserConnected(data);
      }
    });

    this.socket.on('user-disconnected', (data) => {
      console.log(`👤 UNIFIED: User disconnected (Mobile: ${this.isMobile}):`, data);
      if (this.callbacks.onUserDisconnected) {
        this.callbacks.onUserDisconnected(data);
      }
    });

    this.socket.on('participants-update', (data) => {
      console.log(`👥 UNIFIED: Participants update (Mobile: ${this.isMobile}):`, data);
      if (this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(data.participants || []);
      }
    });

    this.socket.on('offer', (data) => {
      console.log(`📤 UNIFIED: Received offer (Mobile: ${this.isMobile})`);
      if (this.callbacks.onOffer) {
        this.callbacks.onOffer(data);
      }
    });

    this.socket.on('answer', (data) => {
      console.log(`📥 UNIFIED: Received answer (Mobile: ${this.isMobile})`);
      if (this.callbacks.onAnswer) {
        this.callbacks.onAnswer(data);
      }
    });

    this.socket.on('ice-candidate', (data) => {
      console.log(`🧊 UNIFIED: Received ICE candidate (Mobile: ${this.isMobile})`);
      if (this.callbacks.onIceCandidate) {
        this.callbacks.onIceCandidate(data);
      }
    });

    this.socket.on('stream-started', (data) => {
      console.log(`🎥 UNIFIED: Stream started (Mobile: ${this.isMobile}):`, data);
      if (this.callbacks.onStreamStarted) {
        this.callbacks.onStreamStarted(data);
      }
    });

    this.socket.on('video-stream', (data) => {
      console.log('📹 Video stream event:', data);
      if (this.callbacks.onVideoStream) {
        this.callbacks.onVideoStream(data);
      }
    });

    this.socket.on('participant-video', (data) => {
      console.log('🎬 Participant video event:', data);
      if (this.callbacks.onParticipantVideo) {
        this.callbacks.onParticipantVideo(data);
      }
    });

    this.socket.on('room-error', (error) => {
      console.error('🏠 Room error:', error);
      if (!error.message?.includes('TypeID')) {
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      }
    });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🏠 UNIFIED: Joining room ${roomId} as ${userId} (Mobile: ${this.isMobile})`);
    
    this.currentRoom = roomId;
    this.currentUserId = userId;

    if (!this.socket || !this.isConnected) {
      console.log(`🔄 UNIFIED: Socket not connected, connecting... (Mobile: ${this.isMobile})`);
      await this.connect();
    }

    if (this.socket && this.isConnected) {
      this.socket.emit('join-room', {
        roomId,
        userId,
        timestamp: Date.now(),
        isMobile: this.isMobile,
        connectionType: 'unified-websocket'
      });
      console.log(`✅ UNIFIED: Join room request sent (Mobile: ${this.isMobile})`);
    } else {
      throw new Error('Unified WebSocket connection failed');
    }
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    console.log(`📹 UNIFIED: Notifying stream started for ${participantId} (Mobile: ${this.isMobile})`);
    
    if (this.socket && this.isConnected) {
      this.socket.emit('stream-started', {
        participantId,
        roomId: this.currentRoom,
        streamInfo: {
          ...streamInfo,
          isMobile: this.isMobile,
          connectionType: 'unified-websocket'
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
        isMobile: this.isMobile
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
        isMobile: this.isMobile
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
        isMobile: this.isMobile
      });
    }
  }

  isReady(): boolean {
    const ready = this.isConnected && this.socket && this.socket.connected;
    console.log(`🔍 UNIFIED: Connection ready check (Mobile: ${this.isMobile}): ${ready}`);
    return ready;
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  getConnectionStatus(): string {
    if (this.isConnected && this.socket?.connected) return 'connected';
    if (this.reconnectAttempts > 0) return 'connecting';
    return 'disconnected';
  }

  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  disconnect(): void {
    console.log(`🔌 UNIFIED: Disconnecting (Mobile: ${this.isMobile})`);
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
    this.resetConnectionMetrics();
  }
}

export default new WebSocketSignalingService();
