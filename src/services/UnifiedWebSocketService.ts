import { io, Socket } from 'socket.io-client';
import { getWebSocketURL, detectSlowNetwork } from '@/utils/connectionUtils';
import { setDynamicIceServers } from '@/utils/webrtc/WebRTCConfig';

export interface UnifiedSignalingCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionFailed?: (error: any) => void;
  onUserConnected?: (data: { userId: string, socketId: string, timestamp: number, networkQuality: string }) => void;
  onUserDisconnected?: (userId: string) => void;
  onParticipantsUpdate?: (participants: any[]) => void;
  onOffer?: (data: { offer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => void;
  onAnswer?: (data: { answer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => void;
  onIceCandidate?: (data: { candidate: RTCIceCandidate, fromUserId: string, fromSocketId: string }) => void;
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
    networkQuality: 'unknown'
  };
  
  // CORREÇÃO: Configuração menos agressiva para evitar loops
  private maxReconnectAttempts = 3; // Reduzido de 15 para 3
  private reconnectDelay = 5000; // Aumentado para 5s
  private maxReconnectDelay = 30000; // Reduzido para 30s
  private backoffMultiplier = 2;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  
  // CORREÇÃO 3: Circuit breaker TEMPORARIAMENTE desabilitado para reconexão
  private circuitBreakerThreshold = 20; // Aumentado para 20 tentativas (quase desabilitado)
  private circuitBreakerTimeout = 10000; // Reduzido para 10s (recovery rápido)
  private circuitBreakerTimer: NodeJS.Timeout | null = null;
  private isCircuitOpen = false;
  private isConnectingFlag = false; // Flag para prevenir conexões simultâneas

  constructor() {
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log('🔧 [WS] Service initialized');
    this.detectNetworkQuality();
  }

  // FASE 5: Network quality detection
  private detectNetworkQuality(): void {
    const isSlowNetwork = detectSlowNetwork();
    this.metrics.networkQuality = isSlowNetwork ? 'slow' : 'fast';
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) console.log(`📶 [WS] Network: ${this.metrics.networkQuality}`);
    
    // Adjust settings based on network quality
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
    // FASE 3: Circuit breaker check
    if (this.isCircuitOpen) {
      console.log('🚫 CIRCUIT BREAKER: Connection blocked due to repeated failures');
      throw new Error('Circuit breaker open - too many connection failures');
    }

    // CORREÇÃO: Prevenir múltiplas tentativas simultâneas
    if (this.isConnectingFlag || this.isConnecting || this.isConnected()) {
      console.log('📡 CONNECTION: Already connected, connecting, or blocked');
      return;
    }

    this.isConnectingFlag = true;
    this.isConnecting = true;
    this.metrics.status = 'connecting';
    this.metrics.attemptCount++;
    this.metrics.lastAttempt = Date.now();

    console.log(`🔄 CONNECTION ATTEMPT ${this.metrics.attemptCount}/${this.maxReconnectAttempts} (Network: ${this.metrics.networkQuality})`);

    try {
      await this._doConnect(serverUrl);
      this.metrics.lastSuccess = Date.now();
      this.metrics.status = 'connected';
      this.metrics.errorCount = 0;
      this.metrics.consecutiveFailures = 0;
      this.resetReconnectDelay();
      this.resetCircuitBreaker();
      this.startHeartbeat();
      this.callbacks.onConnected?.();
      
      console.log('✅ CONNECTION: Successfully connected to WebSocket');
    } catch (error) {
      console.error('❌ CONNECTION: Failed to connect:', error);
      this.metrics.status = 'failed';
      this.metrics.errorCount++;
      this.metrics.consecutiveFailures++;
      
      // FASE 3: Circuit breaker logic
      if (this.metrics.consecutiveFailures >= this.circuitBreakerThreshold) {
        this.openCircuitBreaker();
      }
      
      this.callbacks.onConnectionFailed?.(error);
      
      if (this.shouldReconnect && this.metrics.attemptCount < this.maxReconnectAttempts && !this.isCircuitOpen) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
      this.isConnectingFlag = false;
    }
  }

  private async _doConnect(serverUrl?: string): Promise<void> {
    const url = serverUrl || getWebSocketURL();
    console.log(`🔗 CONNECTION: Attempting to connect to ${url}`);
    console.log(`📊 CONNECTION METRICS:`, {
      attempt: this.metrics.attemptCount,
      consecutiveFailures: this.metrics.consecutiveFailures,
      networkQuality: this.metrics.networkQuality,
      circuitOpen: this.isCircuitOpen
    });

    return new Promise((resolve, reject) => {
      // FASE 2: Progressive timeouts com fallback melhorado
      const isMobile = this.isMobileDevice();
      const isSlowNetwork = this.metrics.networkQuality === 'slow';
      
      let connectionTimeout;
      if (isMobile && isSlowNetwork) {
        connectionTimeout = 60000; // Aumentado para 60s em mobile + rede lenta
      } else if (isMobile || isSlowNetwork) {
        connectionTimeout = 45000; // Aumentado para 45s
      } else {
        connectionTimeout = 30000; // Aumentado para 30s em desktop + rede rápida
      }
      
      console.log(`⏱️ CONNECTION TIMEOUT: ${connectionTimeout}ms (Mobile: ${isMobile}, Slow: ${isSlowNetwork})`);

      const timeout = setTimeout(() => {
        this.disconnect();
        reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
      }, connectionTimeout);

      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: Math.min(connectionTimeout - 5000, 25000), // Socket timeout slightly less than connection timeout
        reconnection: false, // We handle reconnection ourselves
        forceNew: true,
        upgrade: true,
        rememberUpgrade: true,
        extraHeaders: isMobile ? {
          'User-Agent': 'MobileWebRTCClient/1.0',
          'X-Network-Quality': this.metrics.networkQuality
        } : {
          'X-Network-Quality': this.metrics.networkQuality
        }
      });

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ CONNECTION: WebSocket connected successfully');
        console.log(`📈 CONNECTION SUCCESS: Attempt ${this.metrics.attemptCount}, Network: ${this.metrics.networkQuality}`);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('❌ CONNECTION: Connection error:', error);
        console.error(`📉 CONNECTION FAILED: Attempt ${this.metrics.attemptCount}, Error: ${error.message}`);
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

  // FASE 3: Circuit breaker implementation
  private openCircuitBreaker(): void {
    console.log(`🚫 CIRCUIT BREAKER: Opening circuit after ${this.metrics.consecutiveFailures} consecutive failures`);
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
    this.metrics.consecutiveFailures = 0;
    console.log('✅ CIRCUIT BREAKER: Reset automaticamente em conexão bem-sucedida');
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('user-connected', (data: { userId: string, socketId: string, timestamp: number, networkQuality: string }) => {
      console.log('👤 USER CONNECTED:', data);
      
      // CORREÇÃO CRÍTICA: Validar formato do payload
      if (!data || typeof data !== 'object') {
        console.error('❌ onUserConnected: Payload inválido:', data);
        return;
      }
      
      const { userId } = data;
      console.log('🔍 CRÍTICO: Disparando eventos de descoberta para:', userId);
      
      // Disparar múltiplos eventos para garantir detecção
      setTimeout(() => {
        console.log('🔄 DISCOVERY: Enviando participant-joined via callback');
        this.callbacks.onUserConnected?.(data);
        
        // Disparar evento customizado também
        window.dispatchEvent(new CustomEvent('participant-discovered', {
          detail: { participantId: userId, timestamp: data.timestamp }
        }));
        
        // BroadcastChannel para comunicação cross-tab
        try {
          const bc = new BroadcastChannel('participant-discovery');
          bc.postMessage({
            type: 'participant-joined',
            participantId: userId,
            timestamp: data.timestamp
          });
          bc.close();
        } catch (error) {
          console.warn('⚠️ BroadcastChannel não disponível:', error);
        }
      }, 100);
    });

    this.socket.on('user-disconnected', (userId: string) => {
      console.log('👤 USER DISCONNECTED:', userId);
      this.callbacks.onUserDisconnected?.(userId);
    });

    this.socket.on('participants-update', (participants: any[]) => {
      console.log('📊 PARTICIPANTS UPDATE:', participants);
      this.callbacks.onParticipantsUpdate?.(participants);
    });

    // FASE 1: Receber configuração ICE servers do backend
this.socket.on('ice-servers', (data) => {
  console.log('🧊 ICE Servers received from backend:', {
    count: data?.iceServers?.length,
    preview: (data?.iceServers || []).map((s: any) => ({
      urls: s.urls, username: s.username, hasCredential: !!s.credential
    }))
  });

  // aplica no config dinâmico usado pelo RTCPeerConnection
  setDynamicIceServers(data.iceServers);

  // mantém o evento para quem ouve no front
  window.dispatchEvent(new CustomEvent('ice-servers-updated', {
    detail: { iceServers: data.iceServers }
  }));
});

    this.socket.on('offer', (data: { offer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => {
      console.log('📞 OFFER received from:', data.fromUserId || data.fromSocketId);
      this.callbacks.onOffer?.(data);
    });

    this.socket.on('answer', (data: { answer: RTCSessionDescriptionInit, fromUserId: string, fromSocketId: string }) => {
      console.log('✅ ANSWER received from:', data.fromUserId || data.fromSocketId);
      this.callbacks.onAnswer?.(data);
    });

    this.socket.on('ice-candidate', (data: { candidate: RTCIceCandidate, fromUserId: string, fromSocketId: string }) => {
      console.log(`🧊 [WS] ICE candidate from: ${data.fromUserId || data.fromSocketId}`);
      this.callbacks.onIceCandidate?.(data);
    });

    this.socket.on('stream-started', (participantId: string, streamInfo: any) => {
      console.log('🎥 STREAM STARTED:', participantId, streamInfo);
      
      // CORREÇÃO 3: Auto-handshake quando host recebe stream-started
      if (this.currentUserId === 'host') {
        console.log('🤝 CRÍTICO: Host auto-iniciando handshake com', participantId);
        window.dispatchEvent(new CustomEvent('auto-handshake-request', {
          detail: { participantId, streamInfo }
        }));
      }
      
      this.callbacks.onStreamStarted?.(participantId, streamInfo);
    });

    // Heartbeat response
    this.socket.on('pong', () => {
      console.log('💓 HEARTBEAT: Pong received');
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    // CORREÇÃO: Heartbeat menos frequente para reduzir logs
    const heartbeatInterval = 60000; // 60s fixo para todos
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, heartbeatInterval);
    
    console.log(`💓 HEARTBEAT: Started with ${heartbeatInterval}ms interval`);
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

    // FASE 3: Enhanced exponential backoff with jitter
    const baseDelay = this.reconnectDelay * Math.pow(this.backoffMultiplier, this.metrics.attemptCount - 1);
    const jitter = Math.random() * 1000; // Add up to 1s jitter
    const delay = Math.min(baseDelay + jitter, this.maxReconnectDelay);

    console.log(`🔄 CONNECTION: Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.metrics.attemptCount}/${this.maxReconnectAttempts})`);
    console.log(`📊 RETRY METRICS: Base delay: ${baseDelay}ms, Jitter: ${Math.round(jitter)}ms, Final: ${Math.round(delay)}ms`);

    this.reconnectTimer = setTimeout(() => {
      console.log('🔄 CONNECTION: Attempting reconnect...');
      this.connect();
    }, delay);
  }

  private resetReconnectDelay(): void {
    this.reconnectDelay = this.metrics.networkQuality === 'slow' ? 3000 : 2000;
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
      // FASE 2: Progressive join timeout based on network
      const baseTimeout = this.metrics.networkQuality === 'slow' ? 30000 : 20000;
      const isMobile = this.isMobileDevice();
      const joinTimeout = isMobile ? baseTimeout + 10000 : baseTimeout;
      
      console.log(`⏱️ JOIN TIMEOUT: ${joinTimeout}ms (Network: ${this.metrics.networkQuality}, Mobile: ${isMobile})`);

      const timeout = setTimeout(() => {
        console.error(`❌ WEBSOCKET: Join room timeout for ${roomId} after ${joinTimeout}ms`);
        reject(new Error(`Join room timeout after ${joinTimeout}ms`));
      }, joinTimeout);

      const handleJoinSuccess = (data: any) => {
        console.log(`✅ WEBSOCKET: Successfully joined room ${roomId}:`, data);
        clearTimeout(timeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        resolve();
      };

      const handleJoinResponse = (response: any) => {
        console.log(`📡 WEBSOCKET: Join room response:`, response);
        if (response?.success) {
          clearTimeout(timeout);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('error', handleJoinError);
          resolve();
        } else {
          reject(new Error(response?.error || 'Failed to join room'));
        }
      };

      const handleJoinError = (error: any) => {
        console.error(`❌ WEBSOCKET: Failed to join room ${roomId}:`, error);
        clearTimeout(timeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        reject(new Error(`Failed to join room: ${error.message || error}`));
      };

      this.socket?.once('room_joined', handleJoinSuccess);
      this.socket?.once('join-room-response', handleJoinResponse);
      this.socket?.once('error', handleJoinError);

      const sendJoinRequest = (attempt = 1) => {
        console.log(`📡 WEBSOCKET: Sending join request (attempt ${attempt})`);
        
        try {
          this.socket?.emit('join_room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt,
            networkQuality: this.metrics.networkQuality
          });
          
          this.socket?.emit('join-room', { 
            roomId, 
            userId,
            timestamp: Date.now(),
            attempt,
            networkQuality: this.metrics.networkQuality
          });
          
          if (attempt < 3) {
            setTimeout(() => {
              if (this.currentRoomId === roomId) {
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
    
    if (!this.currentRoomId) {
      console.error('❌ SIGNALING: Cannot send offer - not joined to any room');
      return;
    }

    // FASE 4: Validação e log detalhado do payload
    const payload = {
      roomId: this.currentRoomId,
      targetUserId,
      offer,
      fromUserId: this.currentUserId
    };

    console.log(`📤 [WS] Sending offer to: ${targetUserId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) {
      console.log('📊 [WS] Offer payload:', {
        type: offer.type,
        sdpLength: offer.sdp?.length || 0,
        targetUserId,
        hasVideoInSDP: offer.sdp?.includes('m=video') || false
      });
    }

    this.socket!.emit('offer', payload);
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot send answer - not connected');
      return;
    }
    
    if (!this.currentRoomId) {
      console.error('❌ SIGNALING: Cannot send answer - not joined to any room');
      return;
    }

    // FASE 4: Validação e log detalhado do payload
    const payload = {
      roomId: this.currentRoomId,
      targetUserId,
      answer,
      fromUserId: this.currentUserId
    };

    console.log(`📤 [WS] Sending answer to: ${targetUserId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) {
      console.log('📊 [WS] Answer payload:', {
        type: answer.type,
        sdpLength: answer.sdp?.length || 0,
        targetUserId,
        hasRecvOnly: answer.sdp?.includes('a=recvonly') || false
      });
    }

    this.socket!.emit('answer', payload);
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot send ICE candidate - not connected');
      return;
    }
    
    if (!this.currentRoomId) {
      console.error('❌ SIGNALING: Cannot send ICE candidate - not joined to any room');
      return;
    }

    // FASE 4: Validação e log detalhado do payload
    const payload = {
      roomId: this.currentRoomId,
      targetUserId,
      candidate,
      fromUserId: this.currentUserId
    };

    console.log(`🧊 [WS] Sending ICE candidate to: ${targetUserId}`);
    const DEBUG = sessionStorage.getItem('DEBUG') === 'true';
    if (DEBUG) {
      console.log('📊 [WS] ICE payload:', {
        type: candidate.type,
        protocol: candidate.protocol,
        targetUserId,
        roomId: this.currentRoomId,
        fromUserId: this.currentUserId
      });
    }

    this.socket!.emit('ice-candidate', payload);
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    if (!this.isConnected()) {
      console.error('❌ SIGNALING: Cannot notify stream started - not connected');
      return;
    }
    
    if (!this.currentRoomId) {
      console.error('❌ SIGNALING: Cannot notify stream started - not joined to any room');
      return;
    }

    console.log('📡 CRÍTICO: Enviando notificação stream-started para:', participantId);
    console.log('🔍 CRÍTICO: Stream info:', streamInfo);
    
    // FASE 1: CORREÇÃO CRÍTICA - Tentar múltiplas formas de emitir
    try {
      // Método principal
      this.socket!.emit('stream-started', { 
        participantId, 
        streamInfo,
        roomId: this.currentRoomId,
        timestamp: Date.now()
      });
      
      // Backup com formato alternativo
      this.socket!.emit('stream_started', { 
        participantId, 
        streamInfo,
        roomId: this.currentRoomId,
        timestamp: Date.now()
      });
      
      // Log para debug
      console.log('✅ CRÍTICO: stream-started emitido com sucesso');
      
    } catch (error) {
      console.error('❌ CRÍTICO: Erro ao emitir stream-started:', error);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  isReady(): boolean {
    return this.isConnected() && !this.isCircuitOpen;
  }

  // FASE 2: Método para compatibilidade com WebRTC Manager
  getConnectionState(): { websocket: string; connected: boolean } {
    const connected = this.isConnected();
    return {
      websocket: connected ? 'connected' : this.metrics.status,
      connected
    };
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

  // FASE 3: Enhanced health check with circuit breaker awareness
  async healthCheck(): Promise<boolean> {
    if (!this.isConnected() || this.isCircuitOpen) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8000); // Increased timeout
      
      this.socket!.emit('ping', (response: any) => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  async forceReconnect(): Promise<void> {
    console.log('🔄 CONNECTION: Forcing reconnect...');
    this.disconnect();
    this.resetCircuitBreaker();
    this.shouldReconnect = true;
    await this.connect();
  }

  // FASE 1: CORREÇÃO CRÍTICA - Adicionar método emit que estava faltando
  emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      console.warn(`❌ EMIT: Cannot emit '${event}' - socket not connected`);
      return;
    }
    
    console.log(`📡 EMIT: Sending event '${event}' with data:`, data);
    this.socket.emit(event, data);
  }

  disconnect(): void {
    console.log('🔌 CONNECTION: Disconnecting...');
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
// ✅ Expor método emit diretamente para uso externo



// Export singleton instance
export default new UnifiedWebSocketService();
