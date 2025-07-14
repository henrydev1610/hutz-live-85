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
  
  // Reconnection settings
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private backoffMultiplier = 1.5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;

  constructor() {
    console.log('🔧 UNIFIED WebSocket Service initialized');
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

    try {
      await this._doConnect(serverUrl);
      this.metrics.lastSuccess = Date.now();
      this.metrics.status = 'connected';
      this.metrics.errorCount = 0;
      this.resetReconnectDelay();
      this.startHeartbeat();
      this.callbacks.onConnected?.();
    } catch (error) {
      console.error('❌ CONNECTION: Failed to connect:', error);
      this.metrics.status = 'failed';
      this.metrics.errorCount++;
      this.callbacks.onConnectionFailed?.(error);
      
      if (this.shouldReconnect && this.metrics.attemptCount < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private async _doConnect(serverUrl?: string): Promise<void> {
    const url = serverUrl || getWebSocketURL();
    console.log(`🔗 CONNECTION: Attempting to connect to ${url}`);

    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        this.disconnect(); // Use disconnect instead of cleanup
        reject(new Error('Connection timeout'));
      }, 20000); // Aumentado para 20s

      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false, // We handle reconnection ourselves
        forceNew: true,
        extraHeaders: this.isMobileDevice() ? {
          'User-Agent': 'MobileWebRTCClient/1.0'
        } : {}
      });

      this.socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ CONNECTION: WebSocket connected successfully');
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ CONNECTION: Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔄 CONNECTION: Disconnected:', reason);
        this.metrics.status = 'disconnected';
        this.stopHeartbeat();
        this.callbacks.onDisconnected?.();

        if (this.shouldReconnect && reason !== 'io client disconnect') {
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error('❌ CONNECTION: Socket error:', error);
        this.metrics.errorCount++;
        this.callbacks.onError?.(error);
      });
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
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Send heartbeat every 30 seconds
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
    
    // Verificação de parâmetros
    if (!roomId || !userId) {
      throw new Error('Room ID and User ID are required');
    }
    
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
      const joinTimeout = setTimeout(() => {
        console.error(`❌ WEBSOCKET: Join room timeout for ${roomId}`);
        reject(new Error(`Join room timeout after 60 seconds for room: ${roomId}`));
      }, 60000); // Aumentado para 60s para garantir conexão

      // Success handler
      const handleJoinSuccess = (data: any) => {
        console.log(`✅ WEBSOCKET: Successfully joined room ${roomId}:`, data);
        clearTimeout(joinTimeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('join-room-error', handleJoinError);
        this.socket?.off('error', handleJoinError);
        resolve();
      };

      // Response handler for different event types
      const handleJoinResponse = (response: any) => {
        console.log(`📡 WEBSOCKET: Join room response:`, response);
        if (response?.success || response?.status === 'joined') {
          clearTimeout(joinTimeout);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('join-room-error', handleJoinError);
          this.socket?.off('error', handleJoinError);
          resolve();
        } else {
          console.error(`❌ WEBSOCKET: Join room failed:`, response);
          clearTimeout(joinTimeout);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('join-room-error', handleJoinError);
          this.socket?.off('error', handleJoinError);
          reject(new Error(response?.error || response?.message || 'Failed to join room'));
        }
      };

      // Error handler
      const handleJoinError = (error: any) => {
        console.error(`❌ WEBSOCKET: Failed to join room ${roomId}:`, error);
        clearTimeout(joinTimeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('join-room-error', handleJoinError);
        this.socket?.off('error', handleJoinError);
        reject(new Error(`Failed to join room ${roomId}: ${error?.message || error}`));
      };

      // Setup listeners for different possible event names
      this.socket?.once('room_joined', handleJoinSuccess);
      this.socket?.once('join-room-response', handleJoinResponse);
      this.socket?.once('join-room-error', handleJoinError);
      this.socket?.once('error', handleJoinError);

      // Send join request with multiple formats for compatibility
      const sendJoinRequest = (attempt = 1) => {
        console.log(`📡 WEBSOCKET: Sending join request (attempt ${attempt})`);
        
        try {
          // Try multiple event formats for compatibility
          this.socket?.emit('join_room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt
          });
          
          this.socket?.emit('join-room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt
          });
          
          // Auto-retry after delay if no response
          if (attempt < 3) {
            setTimeout(() => {
              if (this.currentRoomId === roomId) { // Still trying to join same room
                sendJoinRequest(attempt + 1);
              }
            }, 5000 * attempt);
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