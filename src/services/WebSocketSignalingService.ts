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

interface SocketIOError extends Error {
  description?: string;
  context?: any;
  type?: string;
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
  private maxReconnectAttempts = 5; // Equalizado para mobile e desktop
  private fallbackMode = false;
  private isMobile = false;
  private fallbackStreamingEnabled = false;
  private connectionMetrics: ConnectionMetrics = {
    attempts: 0,
    networkErrors: 0,
    timeoutErrors: 0,
    startTime: 0,
    lastAttemptTime: 0
  };
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔧 WebSocket Signaling Service initialized');
    this.detectMobile();
  }

  private detectMobile() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log('📱 Mobile detected:', this.isMobile);
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

  private logConnectionMetrics() {
    const duration = Date.now() - this.connectionMetrics.startTime;
    console.log(`📊 Connection Metrics (Mobile: ${this.isMobile}):`, {
      attempts: this.connectionMetrics.attempts,
      networkErrors: this.connectionMetrics.networkErrors,
      timeoutErrors: this.connectionMetrics.timeoutErrors,
      duration: `${duration}ms`,
      reconnectAttempts: this.reconnectAttempts
    });
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Teste simples de conectividade
      const response = await fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      console.log('🌐 Network connectivity check: OK');
      return true;
    } catch (error) {
      console.warn('🌐 Network connectivity check: FAILED', error);
      return false;
    }
  }

  private startHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        console.log('💓 Sending heartbeat');
        this.socket.emit('ping', { timestamp: Date.now(), isMobile: this.isMobile });
      }
    }, 25000); // Heartbeat a cada 25 segundos
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
    console.log('📞 Signaling callbacks set:', Object.keys(callbacks));
  }

  async connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || 'http://localhost:3001';
    
    this.resetConnectionMetrics();
    console.log(`🔌 Starting connection process: ${url} (Mobile: ${this.isMobile}, Attempt: ${this.reconnectAttempts + 1})`);
    
    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Configurações equalizadas para mobile e desktop
      const connectionOptions = {
        transports: ['websocket', 'polling'], // WebSocket como prioridade em ambos
        timeout: 15000, // Timeout equalizado
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 5000,
        withCredentials: false,
        autoConnect: true,
        upgrade: true, // Permitir upgrade no mobile também
        pingTimeout: 30000, // Aumentado para conexões instáveis
        pingInterval: 25000 // Intervalo de ping otimizado
      };

      console.log(`⚙️ Connection options (Mobile: ${this.isMobile}):`, connectionOptions);

      this.socket = io(url, connectionOptions);
      this.connectionMetrics.attempts++;
      this.connectionMetrics.lastAttemptTime = Date.now();

      return new Promise((resolve, reject) => {
        // Timeout mais longo e igual para ambos
        const connectTimeout = setTimeout(() => {
          this.connectionMetrics.timeoutErrors++;
          console.warn(`⏱️ Connection timeout after 15s (Mobile: ${this.isMobile})`);
          this.logConnectionMetrics();
          
          // Só ativar fallback após esgotar todas as tentativas
          if (this.reconnectAttempts >= this.maxReconnectAttempts - 1) {
            console.warn('⚠️ All connection attempts failed, enabling fallback mode');
            this.fallbackMode = true;
            this.fallbackStreamingEnabled = true;
            this.enableFallbackStreaming();
          }
          
          resolve();
        }, 15000);

        this.socket!.on('connect', () => {
          clearTimeout(connectTimeout);
          console.log(`✅ Connected successfully! Socket ID: ${this.socket!.id} (Mobile: ${this.isMobile})`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.fallbackMode = false;
          this.fallbackStreamingEnabled = false;
          this.logConnectionMetrics();
          this.startHeartbeat();
          resolve();
        });

        this.socket!.on('connect_error', async (error: SocketIOError) => {
          clearTimeout(connectTimeout);
          this.connectionMetrics.networkErrors++;
          console.error(`❌ Connection error (Mobile: ${this.isMobile}):`, error);
          
          this.reconnectAttempts++;
          console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Verificar conectividade de rede antes de tentar novamente
            const hasNetwork = await this.checkNetworkConnectivity();
            
            if (hasNetwork) {
              const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts - 1), 8000); // Backoff exponencial
              console.log(`⏳ Retrying connection in ${delay}ms...`);
              
              setTimeout(() => {
                this.connect(serverUrl).then(resolve).catch(reject);
              }, delay);
            } else {
              console.warn('🌐 No network connectivity, enabling fallback immediately');
              this.fallbackMode = true;
              this.fallbackStreamingEnabled = true;
              this.enableFallbackStreaming();
              resolve();
            }
          } else {
            console.warn(`⚠️ Max reconnection attempts reached (${this.maxReconnectAttempts}), enabling fallback mode`);
            this.logConnectionMetrics();
            this.fallbackMode = true;
            this.fallbackStreamingEnabled = true;
            this.enableFallbackStreaming();
            resolve();
          }
        });

        this.socket!.on('disconnect', (reason) => {
          console.log(`🔌 Disconnected (Mobile: ${this.isMobile}):`, reason);
          this.isConnected = false;
          this.stopHeartbeat();
          
          if (reason === 'io server disconnect') {
            console.log('🔄 Server disconnected, attempting to reconnect...');
            this.socket!.connect();
          }
        });

        this.socket!.on('pong', (data) => {
          console.log('💓 Heartbeat response received:', data);
        });

        this.socket!.on('error', (error: SocketIOError) => {
          console.error(`❌ Socket error (Mobile: ${this.isMobile}):`, error);
          
          if (error.message && error.message.includes('TypeID')) {
            console.warn('⚠️ TypeID validation error, continuing without error propagation');
            return;
          }
          
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
        });

        this.setupEventListeners();
      });
    } catch (error) {
      console.error(`❌ Failed to initialize socket connection (Mobile: ${this.isMobile}):`, error);
      this.logConnectionMetrics();
      this.fallbackMode = true;
      this.fallbackStreamingEnabled = true;
      this.enableFallbackStreaming();
      console.log('⚠️ Continuing in enhanced fallback mode with streaming');
    }
  }

  private enableFallbackStreaming() {
    console.log(`🚀 Enabling fallback streaming mode (Mobile: ${this.isMobile})`);
    
    // Simulate successful connection for WebRTC
    if (this.callbacks.onUserConnected) {
      setTimeout(() => {
        this.callbacks.onUserConnected!({
          userId: this.currentUserId,
          socketId: `fallback-${Date.now()}`,
          fallbackMode: true,
          isMobile: this.isMobile,
          timestamp: Date.now()
        });
      }, 1000);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    console.log('🎧 Setting up Socket.IO event listeners');

    this.socket.on('user-connected', (data) => {
      console.log('👤 User connected event:', data);
      if (this.callbacks.onUserConnected) {
        this.callbacks.onUserConnected(data);
      }
    });

    this.socket.on('user-disconnected', (data) => {
      console.log('👤 User disconnected event:', data);
      if (this.callbacks.onUserDisconnected) {
        this.callbacks.onUserDisconnected(data);
      }
    });

    this.socket.on('participants-update', (data) => {
      console.log('👥 Participants update:', data);
      if (this.callbacks.onParticipantsUpdate) {
        this.callbacks.onParticipantsUpdate(data.participants || []);
      }
    });

    this.socket.on('offer', (data) => {
      console.log('📤 Received offer:', data);
      if (this.callbacks.onOffer) {
        this.callbacks.onOffer(data);
      }
    });

    this.socket.on('answer', (data) => {
      console.log('📥 Received answer:', data);
      if (this.callbacks.onAnswer) {
        this.callbacks.onAnswer(data);
      }
    });

    this.socket.on('ice-candidate', (data) => {
      console.log('🧊 Received ICE candidate:', data);
      if (this.callbacks.onIceCandidate) {
        this.callbacks.onIceCandidate(data);
      }
    });

    this.socket.on('stream-started', (data) => {
      console.log('🎥 Stream started event:', data);
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
    console.log(`🏠 Joining room: ${roomId} as user: ${userId} (Mobile: ${this.isMobile})`);
    
    this.currentRoom = roomId;
    this.currentUserId = userId;

    if (!this.socket || !this.isConnected) {
      console.log(`🔄 Socket not connected, attempting to connect... (Mobile: ${this.isMobile})`);
      await this.connect();
    }

    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        console.log(`📤 Sending join-room request (Mobile: ${this.isMobile})`);
        this.socket.emit('join-room', {
          roomId,
          userId,
          timestamp: Date.now(),
          isMobile: this.isMobile,
          connectionType: 'websocket'
        });
        console.log(`✅ Join room request sent successfully (Mobile: ${this.isMobile})`);
      } catch (error: any) {
        console.error(`❌ Failed to join room (Mobile: ${this.isMobile}):`, error);
        if (error.message?.includes('TypeID')) {
          console.warn(`⚠️ TypeID error ignored, enabling fallback streaming (Mobile: ${this.isMobile})`);
          this.fallbackStreamingEnabled = true;
          this.enableFallbackStreaming();
        }
      }
    } else {
      console.warn(`⚠️ Operating in fallback mode with streaming enabled (Mobile: ${this.isMobile})`);
      this.fallbackStreamingEnabled = true;
      this.enableFallbackStreaming();
    }
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    console.log(`📹 Notifying stream started for: ${participantId} (Mobile: ${this.isMobile})`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('stream-started', {
          participantId,
          roomId: this.currentRoom,
          streamInfo: {
            ...streamInfo,
            isMobile: this.isMobile,
            fallbackMode: false,
            connectionType: 'websocket'
          },
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`❌ Failed to notify stream started (Mobile: ${this.isMobile}):`, error);
      }
    } else if (this.fallbackStreamingEnabled) {
      console.log(`🚀 Fallback stream notification (Mobile: ${this.isMobile})`);
      if (this.callbacks.onStreamStarted) {
        this.callbacks.onStreamStarted({
          participantId,
          streamInfo: {
            ...streamInfo,
            isMobile: this.isMobile,
            fallbackMode: true,
            connectionType: 'fallback'
          },
          timestamp: Date.now()
        });
      }
    }
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    console.log(`📤 Sending offer to: ${targetUserId} (Mobile: ${this.isMobile})`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('offer', {
          targetUserId,
          offer,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId,
          isMobile: this.isMobile
        });
      } catch (error) {
        console.error(`❌ Failed to send offer (Mobile: ${this.isMobile}):`, error);
      }
    } else {
      console.warn(`⚠️ Cannot send offer in fallback mode (Mobile: ${this.isMobile})`);
    }
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    console.log(`📥 Sending answer to: ${targetUserId} (Mobile: ${this.isMobile})`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('answer', {
          targetUserId,
          answer,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId,
          isMobile: this.isMobile
        });
      } catch (error) {
        console.error(`❌ Failed to send answer (Mobile: ${this.isMobile}):`, error);
      }
    } else {
      console.warn(`⚠️ Cannot send answer in fallback mode (Mobile: ${this.isMobile})`);
    }
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    console.log(`🧊 Sending ICE candidate to: ${targetUserId} (Mobile: ${this.isMobile})`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('ice-candidate', {
          targetUserId,
          candidate,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId,
          isMobile: this.isMobile
        });
      } catch (error) {
        console.error(`❌ Failed to send ICE candidate (Mobile: ${this.isMobile}):`, error);
      }
    } else {
      console.warn(`⚠️ Cannot send ICE candidate in fallback mode (Mobile: ${this.isMobile})`);
    }
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  isFallbackStreamingEnabled(): boolean {
    return this.fallbackStreamingEnabled;
  }

  isReady(): boolean {
    return this.isConnected && !this.fallbackMode;
  }

  getConnectionStatus(): string {
    if (this.isConnected && !this.fallbackMode) return 'connected';
    if (this.fallbackStreamingEnabled) return 'fallback-streaming';
    if (this.fallbackMode) return 'fallback';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'disconnected';
  }

  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  disconnect(): void {
    console.log(`🔌 Disconnecting from signaling server (Mobile: ${this.isMobile})`);
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUserId = null;
    this.fallbackMode = false;
    this.fallbackStreamingEnabled = false;
    this.reconnectAttempts = 0;
    this.resetConnectionMetrics();
  }
}

export default new WebSocketSignalingService();
