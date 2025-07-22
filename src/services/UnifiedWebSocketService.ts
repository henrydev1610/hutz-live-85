import { io, Socket } from 'socket.io-client';
import { getWebSocketURL, detectSlowNetwork } from '@/utils/connectionUtils';
import { signalingResolver } from '@/utils/signaling/SignalingResolver';

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
  consecutiveFailures: number;
  networkQuality: 'fast' | 'slow' | 'unknown';
  activeSignalingType: 'node' | 'supabase' | 'unknown';
  lastSignalingUrl: string;
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
    status: 'disconnected',
    consecutiveFailures: 0,
    networkQuality: 'unknown',
    activeSignalingType: 'unknown',
    lastSignalingUrl: ''
  };
  
  // Enhanced reconnection settings with resolver integration
  private maxReconnectAttempts = 15;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 60000;
  private backoffMultiplier = 2;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  
  // Circuit breaker pattern
  private circuitBreakerThreshold = 5;
  private circuitBreakerTimeout = 30000;
  private circuitBreakerTimer: NodeJS.Timeout | null = null;
  private isCircuitOpen = false;

  constructor() {
    console.log('🔧 UNIFIED WebSocket Service initialized with SignalingResolver integration');
    this.detectNetworkQuality();
  }

  private detectNetworkQuality(): void {
    const isSlowNetwork = detectSlowNetwork();
    this.metrics.networkQuality = isSlowNetwork ? 'slow' : 'fast';
    console.log(`📶 NETWORK QUALITY: ${this.metrics.networkQuality}`);
    
    if (isSlowNetwork) {
      this.maxReconnectAttempts = 20;
      this.reconnectDelay = 3000;
      this.maxReconnectDelay = 90000;
      console.log('🐌 SLOW NETWORK: Adjusted connection parameters for stability');
    }
  }

  setCallbacks(callbacks: UnifiedSignalingCallbacks): void {
    this.callbacks = callbacks;
  }

  async connect(serverUrl?: string): Promise<void> {
    if (this.isCircuitOpen) {
      console.log('🚫 CIRCUIT BREAKER: Connection blocked due to repeated failures');
      throw new Error('Circuit breaker open - too many connection failures');
    }

    if (this.isConnecting || this.isConnected()) {
      console.log('📡 CONNECTION: Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.metrics.status = 'connecting';
    this.metrics.attemptCount++;
    this.metrics.lastAttempt = Date.now();

    console.log(`🔄 CONNECTION ATTEMPT ${this.metrics.attemptCount}/${this.maxReconnectAttempts} (Network: ${this.metrics.networkQuality})`);

    try {
      // Use SignalingResolver to determine optimal connection if no URL specified
      let finalUrl = serverUrl;
      
      if (!finalUrl) {
        console.log('🎯 RESOLVER: Determining optimal signaling configuration...');
        const optimalConfig = await signalingResolver.resolveOptimalSignaling();
        finalUrl = optimalConfig.url;
        this.metrics.activeSignalingType = optimalConfig.type;
        console.log(`🎯 RESOLVER: Selected ${optimalConfig.type} signaling at ${finalUrl}`);
      } else {
        // Determine signaling type from URL
        if (finalUrl.includes('supabase.co')) {
          this.metrics.activeSignalingType = 'supabase';
        } else {
          this.metrics.activeSignalingType = 'node';
        }
      }

      this.metrics.lastSignalingUrl = finalUrl;
      
      await this._doConnect(finalUrl);
      this.metrics.lastSuccess = Date.now();
      this.metrics.status = 'connected';
      this.metrics.errorCount = 0;
      this.metrics.consecutiveFailures = 0;
      this.resetReconnectDelay();
      this.resetCircuitBreaker();
      this.startHeartbeat();
      this.callbacks.onConnected?.();
      
      console.log(`✅ CONNECTION: Successfully connected to ${this.metrics.activeSignalingType} signaling`);
    } catch (error) {
      console.error('❌ CONNECTION: Failed to connect:', error);
      this.metrics.status = 'failed';
      this.metrics.errorCount++;
      this.metrics.consecutiveFailures++;
      
      if (this.metrics.consecutiveFailures >= this.circuitBreakerThreshold) {
        this.openCircuitBreaker();
      }
      
      this.callbacks.onConnectionFailed?.(error);
      
      if (this.shouldReconnect && this.metrics.attemptCount < this.maxReconnectAttempts && !this.isCircuitOpen) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private async _doConnect(serverUrl: string): Promise<void> {
    console.log(`🔗 CONNECTION: Attempting to connect to ${serverUrl} (${this.metrics.activeSignalingType} signaling)`);
    console.log(`📊 CONNECTION METRICS:`, {
      attempt: this.metrics.attemptCount,
      consecutiveFailures: this.metrics.consecutiveFailures,
      networkQuality: this.metrics.networkQuality,
      signalingType: this.metrics.activeSignalingType,
      circuitOpen: this.isCircuitOpen
    });

    return new Promise((resolve, reject) => {
      const isMobile = this.isMobileDevice();
      const isSlowNetwork = this.metrics.networkQuality === 'slow';
      
      let connectionTimeout;
      if (isMobile && isSlowNetwork) {
        connectionTimeout = 45000;
      } else if (isMobile || isSlowNetwork) {
        connectionTimeout = 30000;
      } else {
        connectionTimeout = 20000;
      }
      
      console.log(`⏱️ CONNECTION TIMEOUT: ${connectionTimeout}ms (Mobile: ${isMobile}, Slow: ${isSlowNetwork}, Type: ${this.metrics.activeSignalingType})`);

      const timeout = setTimeout(() => {
        this.disconnect();
        reject(new Error(`Connection timeout after ${connectionTimeout}ms (${this.metrics.activeSignalingType} signaling)`));
      }, connectionTimeout);

      // Configure socket based on signaling type
      const socketConfig = {
        transports: ['websocket', 'polling'],
        timeout: Math.min(connectionTimeout - 5000, 25000),
        reconnection: false,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: true,
        extraHeaders: {
          'User-Agent': isMobile ? 'MobileWebRTCClient/1.0' : 'DesktopWebRTCClient/1.0',
          'X-Network-Quality': this.metrics.networkQuality,
          'X-Signaling-Type': this.metrics.activeSignalingType,
          'X-Connection-Attempt': this.metrics.attemptCount.toString()
        }
      };

      this.socket = io(serverUrl, socketConfig);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`✅ CONNECTION: ${this.metrics.activeSignalingType} signaling connected successfully`);
        console.log(`📈 CONNECTION SUCCESS: Attempt ${this.metrics.attemptCount}, Type: ${this.metrics.activeSignalingType}, Network: ${this.metrics.networkQuality}`);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error(`❌ CONNECTION: ${this.metrics.activeSignalingType} signaling error:`, error);
        console.error(`📉 CONNECTION FAILED: Attempt ${this.metrics.attemptCount}, Type: ${this.metrics.activeSignalingType}, Error: ${error.message}`);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`🔄 CONNECTION: ${this.metrics.activeSignalingType} signaling disconnected:`, reason);
        this.metrics.status = 'disconnected';
        this.stopHeartbeat();
        this.callbacks.onDisconnected?.();

        if (this.shouldReconnect && reason !== 'io client disconnect') {
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error(`❌ CONNECTION: ${this.metrics.activeSignalingType} signaling socket error:`, error);
        this.metrics.errorCount++;
        this.callbacks.onError?.(error);
      });
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('user-connected', (userId: string) => {
      console.log(`👤 USER CONNECTED (${this.metrics.activeSignalingType}):`, userId);
      this.callbacks.onUserConnected?.(userId);
    });

    this.socket.on('user-disconnected', (userId: string) => {
      console.log(`👤 USER DISCONNECTED (${this.metrics.activeSignalingType}):`, userId);
      this.callbacks.onUserDisconnected?.(userId);
    });

    this.socket.on('participants-update', (participants: any[]) => {
      console.log(`📊 PARTICIPANTS UPDATE (${this.metrics.activeSignalingType}):`, participants);
      this.callbacks.onParticipantsUpdate?.(participants);
    });

    this.socket.on('offer', (fromUserId: string, offer: RTCSessionDescriptionInit) => {
      console.log(`📞 OFFER received via ${this.metrics.activeSignalingType} from:`, fromUserId);
      this.callbacks.onOffer?.(fromUserId, offer);
    });

    this.socket.on('answer', (fromUserId: string, answer: RTCSessionDescriptionInit) => {
      console.log(`✅ ANSWER received via ${this.metrics.activeSignalingType} from:`, fromUserId);
      this.callbacks.onAnswer?.(fromUserId, answer);
    });

    this.socket.on('ice-candidate', (fromUserId: string, candidate: RTCIceCandidate) => {
      console.log(`🧊 ICE CANDIDATE received via ${this.metrics.activeSignalingType} from:`, fromUserId);
      this.callbacks.onIceCandidate?.(fromUserId, candidate);
    });

    this.socket.on('stream-started', (participantId: string, streamInfo: any) => {
      console.log(`🎥 STREAM STARTED via ${this.metrics.activeSignalingType}:`, participantId, streamInfo);
      this.callbacks.onStreamStarted?.(participantId, streamInfo);
    });

    this.socket.on('pong', () => {
      console.log(`💓 HEARTBEAT: Pong received from ${this.metrics.activeSignalingType}`);
    });
  }

  private openCircuitBreaker(): void {
    console.log(`🚫 CIRCUIT BREAKER: Opening circuit after ${this.metrics.consecutiveFailures} consecutive failures on ${this.metrics.activeSignalingType}`);
    this.isCircuitOpen = true;
    
    this.circuitBreakerTimer = setTimeout(() => {
      console.log('🔄 CIRCUIT BREAKER: Attempting to close circuit');
      this.isCircuitOpen = false;
      this.metrics.consecutiveFailures = 0;
    }, this.circuitBreakerTimeout);
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
      this.circuitBreakerTimer = null;
    }
    this.isCircuitOpen = false;
    console.log(`✅ CIRCUIT BREAKER: Reset for ${this.metrics.activeSignalingType}`);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const heartbeatInterval = this.metrics.networkQuality === 'slow' ? 45000 : 30000;
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, heartbeatInterval);
    
    console.log(`💓 HEARTBEAT: Started with ${heartbeatInterval}ms interval for ${this.metrics.activeSignalingType}`);
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

    const baseDelay = this.reconnectDelay * Math.pow(this.backoffMultiplier, this.metrics.attemptCount - 1);
    const jitter = Math.random() * 1000;
    const delay = Math.min(baseDelay + jitter, this.maxReconnectDelay);

    console.log(`🔄 CONNECTION: Scheduling reconnect to ${this.metrics.activeSignalingType} in ${Math.round(delay)}ms (attempt ${this.metrics.attemptCount}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      console.log(`🔄 CONNECTION: Attempting reconnect to ${this.metrics.activeSignalingType}...`);
      this.connect();
    }, delay);
  }

  private resetReconnectDelay(): void {
    this.reconnectDelay = this.metrics.networkQuality === 'slow' ? 3000 : 2000;
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🚪 WEBSOCKET: Joining room ${roomId} as ${userId} via ${this.metrics.activeSignalingType}`);
    
    if (!this.isConnected()) {
      console.log('🔗 CONNECTION: Not connected, connecting first...');
      await this.connect();
    }

    if (!this.isConnected()) {
      throw new Error(`Failed to establish ${this.metrics.activeSignalingType} connection`);
    }

    this.currentRoomId = roomId;
    this.currentUserId = userId;

    return new Promise((resolve, reject) => {
      const baseTimeout = this.metrics.networkQuality === 'slow' ? 30000 : 20000;
      const isMobile = this.isMobileDevice();
      const joinTimeout = isMobile ? baseTimeout + 10000 : baseTimeout;
      
      console.log(`⏱️ JOIN TIMEOUT: ${joinTimeout}ms (Network: ${this.metrics.networkQuality}, Mobile: ${isMobile}, Signaling: ${this.metrics.activeSignalingType})`);

      const timeout = setTimeout(() => {
        console.error(`❌ WEBSOCKET: Join room timeout for ${roomId} via ${this.metrics.activeSignalingType} after ${joinTimeout}ms`);
        reject(new Error(`Join room timeout after ${joinTimeout}ms (${this.metrics.activeSignalingType} signaling)`));
      }, joinTimeout);

      const handleJoinSuccess = (data: any) => {
        console.log(`✅ WEBSOCKET: Successfully joined room ${roomId} via ${this.metrics.activeSignalingType}:`, data);
        clearTimeout(timeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        resolve();
      };

      const handleJoinResponse = (response: any) => {
        console.log(`📡 WEBSOCKET: Join room response via ${this.metrics.activeSignalingType}:`, response);
        if (response?.success) {
          clearTimeout(timeout);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('error', handleJoinError);
          resolve();
        } else {
          reject(new Error(response?.error || `Failed to join room via ${this.metrics.activeSignalingType}`));
        }
      };

      const handleJoinError = (error: any) => {
        console.error(`❌ WEBSOCKET: Failed to join room ${roomId} via ${this.metrics.activeSignalingType}:`, error);
        clearTimeout(timeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        reject(new Error(`Failed to join room via ${this.metrics.activeSignalingType}: ${error.message || error}`));
      };

      this.socket?.once('room_joined', handleJoinSuccess);
      this.socket?.once('join-room-response', handleJoinResponse);
      this.socket?.once('error', handleJoinError);

      const sendJoinRequest = (attempt = 1) => {
        console.log(`📡 WEBSOCKET: Sending join request via ${this.metrics.activeSignalingType} (attempt ${attempt})`);
        
        try {
          this.socket?.emit('join_room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt,
            networkQuality: this.metrics.networkQuality,
            signalingType: this.metrics.activeSignalingType
          });
          
          this.socket?.emit('join-room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt,
            networkQuality: this.metrics.networkQuality,
            signalingType: this.metrics.activeSignalingType
          });
          
          if (attempt < 3) {
            setTimeout(() => {
              if (this.currentRoomId === roomId) {
                sendJoinRequest(attempt + 1);
              }
            }, 5000 * attempt);
          }
        } catch (error) {
          console.error(`❌ WEBSOCKET: Error sending join request via ${this.metrics.activeSignalingType}:`, error);
          handleJoinError(error);
        }
      };

      sendJoinRequest();
    });
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error(`❌ SIGNALING: Cannot send offer via ${this.metrics.activeSignalingType} - not connected`);
      return;
    }

    console.log(`📞 SIGNALING: Sending offer via ${this.metrics.activeSignalingType} to:`, targetUserId);
    this.socket!.emit('offer', { targetUserId, offer });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error(`❌ SIGNALING: Cannot send answer via ${this.metrics.activeSignalingType} - not connected`);
      return;
    }

    console.log(`✅ SIGNALING: Sending answer via ${this.metrics.activeSignalingType} to:`, targetUserId);
    this.socket!.emit('answer', { targetUserId, answer });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    if (!this.isConnected()) {
      console.error(`❌ SIGNALING: Cannot send ICE candidate via ${this.metrics.activeSignalingType} - not connected`);
      return;
    }

    console.log(`🧊 SIGNALING: Sending ICE candidate via ${this.metrics.activeSignalingType} to:`, targetUserId);
    this.socket!.emit('ice-candidate', { targetUserId, candidate });
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    if (!this.isConnected()) {
      console.error(`❌ SIGNALING: Cannot notify stream started via ${this.metrics.activeSignalingType} - not connected`);
      return;
    }

    console.log(`🎥 SIGNALING: Notifying stream started via ${this.metrics.activeSignalingType}:`, participantId);
    this.socket!.emit('stream-started', { participantId, streamInfo });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  isReady(): boolean {
    return this.isConnected() && !this.isCircuitOpen;
  }

  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  getConnectionStatus(): string {
    if (this.isCircuitOpen) return 'circuit-open';
    return this.metrics.status;
  }

  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConnected() || this.isCircuitOpen) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8000);
      
      this.socket!.emit('ping', (response: any) => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  async forceReconnect(): Promise<void> {
    console.log(`🔄 CONNECTION: Forcing reconnect to ${this.metrics.activeSignalingType}...`);
    this.disconnect();
    this.resetCircuitBreaker();
    this.shouldReconnect = true;
    await this.connect();
  }

  async switchSignalingType(type: 'node' | 'supabase'): Promise<void> {
    console.log(`🔄 SWITCHING: From ${this.metrics.activeSignalingType} to ${type} signaling`);
    
    try {
      await signalingResolver.switchSignaling(type);
      console.log(`✅ SWITCHING: Successfully switched to ${type} signaling`);
    } catch (error) {
      console.error(`❌ SWITCHING: Failed to switch to ${type} signaling:`, error);
      throw error;
    }
  }

  disconnect(): void {
    console.log(`🔌 CONNECTION: Disconnecting from ${this.metrics.activeSignalingType}...`);
    this.shouldReconnect = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
      this.circuitBreakerTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.metrics.status = 'disconnected';
    this.currentRoomId = null;
    this.currentUserId = null;
    this.isConnecting = false;
    this.resetCircuitBreaker();
  }
}

export default new UnifiedWebSocketService();
