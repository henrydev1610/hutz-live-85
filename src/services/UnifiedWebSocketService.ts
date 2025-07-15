import { io, Socket } from 'socket.io-client';
import { getWebSocketURL } from '@/utils/connectionUtils';

export interface UnifiedSignalingCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionFailed?: (error: any) => void;
  onUserConnected?: (userId: string) => void;
  onUserDisconnected?: (userId: string) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onOffer?: (fromUserId: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (fromUserId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (fromUserId: string, candidate: RTCIceCandidate) => void;
  onStreamStarted?: (participantId: string, streamInfo: any) => void;
  onError?: (error: any) => void;
}

interface ConnectionMetrics {
  attemptCount: number;
  lastAttempt: number;
  lastSuccess: number;
  errorCount: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

class UnifiedWebSocketService {
  private socket: Socket | null = null;
  private callbacks: UnifiedSignalingCallbacks = {};
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private isConnecting: boolean = false;
  private metrics: ConnectionMetrics = {
    attemptCount: 0,
    lastAttempt: 0,
    lastSuccess: 0,
    errorCount: 0,
    status: 'disconnected'
  };
  
  // Mobile-optimized reconnection settings
  private maxReconnectAttempts = 10; // Menos tentativas
  private reconnectDelay = 1000; // Delay menor inicial
  private maxReconnectDelay = 15000; // Máximo menor
  private backoffMultiplier = 1.2; // Backoff mais suave
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  
  // URLs de fallback para robustez
  private fallbackUrls: string[] = [];

  constructor() {
    console.log('🔧 UNIFIED WebSocket Service initialized');
    this.setupFallbackUrls();
  }
  
  private setupFallbackUrls() {
    const { protocol, host } = window.location;
    
    // Lista de URLs de fallback baseada no ambiente
    this.fallbackUrls = [];
    
    // Adicionar URL principal primeiro
    this.fallbackUrls.push(getWebSocketURL());
    
    // URLs de fallback específicas por ambiente
    if (host.includes('lovableproject.com')) {
      this.fallbackUrls.push('https://server-hutz-live.onrender.com');
      this.fallbackUrls.push(`${protocol}//${host}`);
    } else if (host.includes('onrender.com')) {
      this.fallbackUrls.push('https://server-hutz-live.onrender.com');
    } else if (host.includes('localhost') || host.includes('192.168.') || host.includes('172.26.')) {
      this.fallbackUrls.push('http://172.26.204.230:3001');
      this.fallbackUrls.push('http://localhost:3001');
    }
    
    // Remover duplicatas
    this.fallbackUrls = [...new Set(this.fallbackUrls)];
    
    console.log('🔗 FALLBACK URLs configured:', this.fallbackUrls);
  }

  setCallbacks(callbacks: UnifiedSignalingCallbacks): void {
    this.callbacks = callbacks;
  }

  async connect(serverUrl?: string): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      console.log('📡 CONNECTION: Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.metrics.status = 'connecting';
    this.metrics.attemptCount++;
    this.metrics.lastAttempt = Date.now();

    // URLs para tentar em ordem
    const urlsToTry = serverUrl ? [serverUrl] : [...this.fallbackUrls];
    
    console.log(`🔗 CONNECTION: Will try ${urlsToTry.length} URLs:`, urlsToTry);

    let lastError: Error | null = null;

    for (let i = 0; i < urlsToTry.length; i++) {
      const url = urlsToTry[i];
      console.log(`🔗 CONNECTION: Attempting URL ${i + 1}/${urlsToTry.length}: ${url}`);
      
      try {
        await this._doConnect(url);
        this.metrics.lastSuccess = Date.now();
        this.metrics.status = 'connected';
        this.metrics.errorCount = 0;
        this.resetReconnectDelay();
        this.startHeartbeat();
        this.callbacks.onConnected?.();
        console.log(`✅ CONNECTION: Successfully connected to: ${url}`);
        return;
      } catch (error) {
        console.warn(`❌ CONNECTION: Failed to connect to ${url}:`, error);
        lastError = error as Error;
        
        // Pequeno delay entre tentativas
        if (i < urlsToTry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Se chegou aqui, todas as URLs falharam
    console.error('❌ CONNECTION: All URLs failed, last error:', lastError);
    this.metrics.status = 'failed';
    this.metrics.errorCount++;
    this.callbacks.onConnectionFailed?.(lastError);
    
    if (this.shouldReconnect && this.metrics.attemptCount < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
    
    this.isConnecting = false;
  }

  private async _doConnect(url: string): Promise<void> {
    console.log(`🔗 CONNECTION: Attempting to connect to ${url}`);

    return new Promise((resolve, reject) => {
      const isMobile = this.isMobileDevice();
      const timeout = isMobile ? 20000 : 15000; // Timeout mais curto
      
      const connectionTimeout = setTimeout(() => {
        console.error(`❌ CONNECTION: Timeout after ${timeout}ms (${isMobile ? 'MOBILE' : 'DESKTOP'})`);
        if (this.socket) {
          this.socket.disconnect();
          this.socket = null;
        }
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      try {
        this.socket = io(url, {
          transports: ['websocket', 'polling'], // WebSocket primeiro para todos
          timeout: isMobile ? 15000 : 10000, // Timeout menor
          reconnection: false, // Gerenciamos nossa própria reconexão
          forceNew: true,
          upgrade: true,
          rememberUpgrade: true, // Lembrar do upgrade
          autoConnect: true, // Conectar automaticamente
          withCredentials: true, // Credenciais para CORS
          extraHeaders: isMobile ? {
            'User-Agent': 'MobileWebRTCClient/1.0',
            'X-Mobile-Device': 'true'
          } : {},
          query: {
            'timestamp': Date.now(), // Evitar cache
            'client': isMobile ? 'mobile' : 'desktop'
          }
        });

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          console.log(`✅ CONNECTION: WebSocket connected successfully to ${url}`);
          this.setupEventListeners();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.error(`❌ CONNECTION: Connection error to ${url}:`, error);
          if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
          }
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log(`🔄 CONNECTION: Disconnected from ${url}:`, reason);
          this.metrics.status = 'disconnected';
          this.stopHeartbeat();
          this.callbacks.onDisconnected?.();

          if (this.shouldReconnect && reason !== 'io client disconnect') {
            this.scheduleReconnect();
          }
        });

        this.socket.on('error', (error) => {
          console.error(`❌ CONNECTION: Socket error from ${url}:`, error);
          this.metrics.errorCount++;
          this.callbacks.onError?.(error);
        });
      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error(`❌ CONNECTION: Failed to create socket for ${url}:`, error);
        reject(error);
      }
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('user-connected', (userId: string) => {
      console.log('👤 USER CONNECTED:', userId);
      this.callbacks.onUserConnected?.(userId);
    });

    this.socket.on('user-disconnected', (userId: string) => {
      console.log('👤 USER DISCONNECTED:', userId);
      this.callbacks.onUserDisconnected?.(userId);
    });

    this.socket.on('participants-update', (participants: any[]) => {
      console.log('📊 PARTICIPANTS UPDATE:', participants);
      this.callbacks.onParticipantsUpdate?.(participants);
    });

    this.socket.on('offer', (fromUserId: string, offer: RTCSessionDescriptionInit) => {
      console.log('📞 OFFER received from:', fromUserId);
      this.callbacks.onOffer?.(fromUserId, offer);
    });

    this.socket.on('answer', (fromUserId: string, answer: RTCSessionDescriptionInit) => {
      console.log('✅ ANSWER received from:', fromUserId);
      this.callbacks.onAnswer?.(fromUserId, answer);
    });

    this.socket.on('ice-candidate', (fromUserId: string, candidate: RTCIceCandidate) => {
      console.log('🧊 ICE CANDIDATE received from:', fromUserId);
      this.callbacks.onIceCandidate?.(fromUserId, candidate);
    });

    this.socket.on('stream-started', (participantId: string, streamInfo: any) => {
      console.log('🎥 STREAM STARTED:', participantId, streamInfo);
      this.callbacks.onStreamStarted?.(participantId, streamInfo);
    });

    // Heartbeat response
    this.socket.on('pong', () => {
      console.log('💓 HEARTBEAT: Pong received');
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const isMobile = this.isMobileDevice();
    const heartbeatInterval = isMobile ? 10000 : 30000; // 10s para mobile, 30s para desktop
    
    console.log(`💓 HEARTBEAT: Starting ${isMobile ? 'MOBILE' : 'DESKTOP'} heartbeat every ${heartbeatInterval}ms`);
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        console.log(`💓 HEARTBEAT: Sending ping (${isMobile ? 'MOBILE' : 'DESKTOP'})`);
        this.socket.emit('ping');
      } else {
        console.warn('💓 HEARTBEAT: Socket not connected, stopping heartbeat');
        this.stopHeartbeat();
      }
    }, heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(this.backoffMultiplier, this.metrics.attemptCount - 1),
      this.maxReconnectDelay
    );

    console.log(`🔄 CONNECTION: Scheduling reconnect in ${delay}ms (attempt ${this.metrics.attemptCount})`);

    this.reconnectTimer = setTimeout(() => {
      console.log('🔄 CONNECTION: Attempting reconnect...');
      this.connect();
    }, delay);
  }

  private resetReconnectDelay(): void {
    this.reconnectDelay = 1000;
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🚪 WEBSOCKET: Joining room ${roomId} as ${userId}`);
    
    if (!this.isConnected()) {
      console.log('🔗 CONNECTION: Not connected, connecting first...');
      await this.connect();
    }

    if (!this.isConnected()) {
      throw new Error('Failed to establish connection');
    }

    this.currentRoomId = roomId;
    this.currentUserId = userId;

    return new Promise((resolve, reject) => {
      const isMobile = this.isMobileDevice();
      const joinTimeout = isMobile ? 30000 : 20000; // Timeout menor
      
      const timeoutHandle = setTimeout(() => {
        console.error(`❌ WEBSOCKET: Join room timeout for ${roomId} after ${joinTimeout}ms (${isMobile ? 'MOBILE' : 'DESKTOP'})`);
        reject(new Error(`Join room timeout after ${joinTimeout}ms`));
      }, joinTimeout);

      // Success handler
      const handleJoinSuccess = (data: any) => {
        console.log(`✅ WEBSOCKET: Successfully joined room ${roomId}:`, data);
        clearTimeout(timeoutHandle);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('room-joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        resolve();
      };

      // Response handler for different event types
      const handleJoinResponse = (response: any) => {
        console.log(`📡 WEBSOCKET: Join room response:`, response);
        if (response?.success) {
          clearTimeout(timeoutHandle);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('room-joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('error', handleJoinError);
          resolve();
        } else {
          reject(new Error(response?.error || 'Failed to join room'));
        }
      };

      // Error handler
      const handleJoinError = (error: any) => {
        console.error(`❌ WEBSOCKET: Failed to join room ${roomId}:`, error);
        clearTimeout(timeoutHandle);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('room-joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        reject(new Error(`Failed to join room: ${error.message || error}`));
      };

      // Setup listeners for both event formats
      this.socket?.once('room_joined', handleJoinSuccess);
      this.socket?.once('room-joined', handleJoinSuccess); // Hífen também
      this.socket?.once('join-room-response', handleJoinResponse);
      this.socket?.once('error', handleJoinError);

      // Send join request with both formats for compatibility
      const sendJoinRequest = (attempt = 1) => {
        console.log(`📡 WEBSOCKET: Sending join request (attempt ${attempt})`);
        
        try {
          // Enviar ambos os formatos para compatibilidade
          this.socket?.emit('join-room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt
          });
          
          this.socket?.emit('join_room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt
          });
          
          // Auto-retry após delay se não houver resposta
          if (attempt < 2) { // Menos tentativas
            setTimeout(() => {
              if (this.currentRoomId === roomId) {
                sendJoinRequest(attempt + 1);
              }
            }, 3000 * attempt); // Delay menor
          }
        } catch (error) {
          console.error(`❌ WEBSOCKET: Error sending join request:`, error);
          handleJoinError(error);
        }
      };

      sendJoinRequest();
    });
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot send offer - not connected');
      return;
    }

    console.log('📞 SIGNALING: Sending offer to:', targetUserId);
    this.socket!.emit('offer', { targetUserId, offer });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot send answer - not connected');
      return;
    }

    console.log('✅ SIGNALING: Sending answer to:', targetUserId);
    this.socket!.emit('answer', { targetUserId, answer });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot send ICE candidate - not connected');
      return;
    }

    console.log('🧊 SIGNALING: Sending ICE candidate to:', targetUserId);
    this.socket!.emit('ice-candidate', { targetUserId, candidate });
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot notify stream started - not connected');
      return;
    }

    console.log('🎥 SIGNALING: Notifying stream started:', participantId);
    this.socket!.emit('stream-started', { participantId, streamInfo });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  isReady(): boolean {
    return this.isConnected();
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  getConnectionStatus(): string {
    return this.metrics.status;
  }

  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  disconnect(): void {
    console.log('🔌 CONNECTION: Disconnecting...');
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.metrics.status = 'disconnected';
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isConnecting = false;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      
      this.socket!.emit('ping', (response: any) => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  // Force reconnection
  async forceReconnect(): Promise<void> {
    console.log('🔄 CONNECTION: Forcing reconnect...');
    this.disconnect();
    this.shouldReconnect = true;
    await this.connect();
  }
}

// Export singleton instance
export default new UnifiedWebSocketService();