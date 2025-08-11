import { io, Socket } from 'socket.io-client';
import { getWebSocketURL, detectSlowNetwork } from '@/utils/connectionUtils';
import { setDynamicIceServers } from '@/utils/webrtc/WebRTCConfig';
import { WebSocketDiagnostics } from '@/utils/debug/WebSocketDiagnostics';
import { OfflineFallback } from '@/utils/fallback/OfflineFallback';

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

  // FASE 2: Sistema de fallback com múltiplas URLs
  private async connectWithRetry(serverUrl?: string): Promise<{ success: boolean; url?: string; error?: string }> {
    const urls = serverUrl ? [serverUrl] : this.getAlternativeURLs();
    
    for (const url of urls) {
      console.log(`🔄 [WS] Trying URL: ${url}`);
      
      // Diagnóstico específico para esta URL
      try {
        const diagnostics = await WebSocketDiagnostics.runDiagnostics();
        console.log(`📊 [WS] Diagnostics for ${url}:`, diagnostics);
        
        if (diagnostics.success || diagnostics.details.hostReachable) {
          console.log(`✅ [WS] URL ${url} passed diagnostics`);
          return { success: true, url };
        } else {
          console.warn(`⚠️ [WS] URL ${url} failed diagnostics: ${diagnostics.error}`);
        }
      } catch (error) {
        console.warn(`⚠️ [WS] Diagnostics failed for ${url}:`, error);
      }
    }
    
    // Se nenhuma URL passou nos diagnósticos, alertar usuário
    OfflineFallback.createOfflineAlert();
    OfflineFallback.checkServerAfterDelay(30000);
    
    return { 
      success: false, 
      error: `All ${urls.length} server URLs failed diagnostics` 
    };
  }

  private getAlternativeURLs(): string[] {
    const primary = getWebSocketURL();
    const alternatives = [
      primary,
      // Adicionar URLs alternativas baseadas na URL primária
      primary.replace('wss://', 'ws://'),
      primary.replace('ws://', 'wss://'),
    ];
    
    // Remover duplicatas
    return [...new Set(alternatives)];
  }

  async connect(serverUrl?: string): Promise<void> {
    // Log do ambiente antes de conectar
    if (this.metrics.attemptCount === 0) {
      WebSocketDiagnostics.logEnvironmentInfo();
    }

    // Prevenir múltiplas tentativas simultâneas
    if (this.isConnectingFlag || this.isConnecting || this.isConnected()) {
      console.log('📡 [WS] Already connected, connecting, or blocked');
      return;
    }

    this.isConnectingFlag = true;
    this.isConnecting = true;
    this.metrics.status = 'connecting';
    this.metrics.attemptCount++;
    this.metrics.lastAttempt = Date.now();

    console.log(`🔄 [WS] CONNECTION ATTEMPT ${this.metrics.attemptCount}/${this.maxReconnectAttempts}`);

    try {
      // FASE 2: Tentar conectar com múltiplas URLs se necessário
      const connectionResult = await this.connectWithRetry(serverUrl);
      if (!connectionResult.success) {
        throw new Error(`All connection attempts failed: ${connectionResult.error}`);
      }

      await this._doConnect(connectionResult.url!);
      
      this.metrics.lastSuccess = Date.now();
      this.metrics.status = 'connected';
      this.metrics.errorCount = 0;
      this.metrics.consecutiveFailures = 0;
      this.resetReconnectDelay();
      this.resetCircuitBreaker();
      this.startHeartbeat();
      this.callbacks.onConnected?.();
      
      console.log('✅ [WS] CONNECTION SUCCESS: WebSocket connected and ready');
    } catch (error) {
      console.error('❌ [WS] CONNECTION FAILED:', error);
      this.metrics.status = 'failed';
      this.metrics.errorCount++;
      this.metrics.consecutiveFailures++;
      
      // Circuit breaker simplificado
      if (this.metrics.consecutiveFailures >= this.circuitBreakerThreshold) {
        this.openCircuitBreaker();
      }
      
      this.callbacks.onConnectionFailed?.(error);
      
      if (this.shouldReconnect && this.metrics.attemptCount < this.maxReconnectAttempts && !this.isCircuitOpen) {
        this.scheduleReconnect();
      } else {
        console.error(`🛑 [WS] Max attempts reached or circuit open. Connection abandoned.`);
      }
    } finally {
      this.isConnecting = false;
      this.isConnectingFlag = false;
    }
  }

  private async _doConnect(url: string): Promise<void> {
    // DIAGNÓSTICO CRÍTICO: Log detalhado da URL
    console.log(`🔗 [WS] CONNECTION ATTEMPT: ${url}`);
    console.log(`🔍 [WS] URL BREAKDOWN:`, {
      original: url,
      protocol: new URL(url).protocol,
      host: new URL(url).host,
      port: new URL(url).port,
      origin: new URL(url).origin
    });
    
    // Validar se a URL está bem formada
    try {
      new URL(url);
    } catch (error) {
      console.error(`❌ [WS] INVALID URL:`, url, error);
      throw new Error(`Invalid WebSocket URL: ${url}`);
    }

    console.log(`📊 [WS] CONNECTION METRICS:`, {
      attempt: this.metrics.attemptCount,
      consecutiveFailures: this.metrics.consecutiveFailures,
      networkQuality: this.metrics.networkQuality,
      circuitOpen: this.isCircuitOpen
    });

    return new Promise((resolve, reject) => {
      // SIMPLIFICAÇÃO: Timeout fixo mais generoso
      const connectionTimeout = 20000; // 20s fixo para simplicidade
      
      console.log(`⏱️ [WS] CONNECTION TIMEOUT: ${connectionTimeout}ms`);

      const timeout = setTimeout(() => {
        console.error(`❌ [WS] CONNECTION TIMEOUT after ${connectionTimeout}ms`);
        this.disconnect();
        reject(new Error(`Connection timeout after ${connectionTimeout}ms`));
      }, connectionTimeout);

      // FASE 1: Configuração Socket.IO robusta e menos agressiva
      console.log(`🚀 [WS] Creating socket.io connection...`);
      this.socket = io(url, {
        transports: ['websocket', 'polling'], // WebSocket primeiro, polling como fallback
        timeout: 25000, // Aumentado para 25s
        reconnection: false, // Controlamos manualmente
        forceNew: true,
        autoConnect: true,
        upgrade: true, // Permite upgrade para WebSocket
        rememberUpgrade: true // Lembra preferência WebSocket
      });

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('✅ [WS] CONNECTION SUCCESS: WebSocket connected');
        console.log(`📈 [WS] Socket ID: ${this.socket?.id}`);
        console.log(`🔗 [WS] Connected to: ${url}`);
        console.log(`📊 [WS] Connection attempt ${this.metrics.attemptCount} succeeded`);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        clearTimeout(timeout);
        console.error('❌ [WS] CONNECTION ERROR:', error);
        console.error(`📉 [WS] Failed on attempt ${this.metrics.attemptCount}`);
        console.error(`🔍 [WS] Error details:`, {
          message: error.message,
          description: error.description || 'No description',
          context: error.context || 'No context',
          type: error.type || 'Unknown type'
        });
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
          clearTimeout(timeout);
          this.socket?.off('room_joined', handleJoinSuccess);
          this.socket?.off('join-room-response', handleJoinResponse);
          this.socket?.off('error', handleJoinError);
          reject(new Error(response?.error || 'Join room failed'));
        }
      };

      const handleJoinError = (error: any) => {
        console.error(`❌ WEBSOCKET: Join room error for ${roomId}:`, error);
        clearTimeout(timeout);
        this.socket?.off('room_joined', handleJoinSuccess);
        this.socket?.off('join-room-response', handleJoinResponse);
        this.socket?.off('error', handleJoinError);
        reject(error);
      };

      this.socket?.on('room_joined', handleJoinSuccess);
      this.socket?.on('join-room-response', handleJoinResponse);
      this.socket?.on('error', handleJoinError);

      console.log(`📡 WEBSOCKET: Sending join-room for ${roomId} as ${userId}`);
      this.socket?.emit('join-room', { roomId, userId, timestamp: Date.now() });
    });
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error('Cannot send offer: not connected');
      return;
    }

    console.log(`📞 WEBSOCKET: Sending offer to ${targetUserId}`);
    this.socket?.emit('offer', {
      offer,
      targetUserId,
      fromUserId: this.currentUserId,
      timestamp: Date.now()
    });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.isConnected()) {
      console.error('Cannot send answer: not connected');
      return;
    }

    console.log(`✅ WEBSOCKET: Sending answer to ${targetUserId}`);
    this.socket?.emit('answer', {
      answer,
      targetUserId,
      fromUserId: this.currentUserId,
      timestamp: Date.now()
    });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    if (!this.isConnected()) {
      console.error('Cannot send ICE candidate: not connected');
      return;
    }

    console.log(`🧊 WEBSOCKET: Sending ICE candidate to ${targetUserId}`);
    this.socket?.emit('ice-candidate', {
      candidate,
      targetUserId,
      fromUserId: this.currentUserId,
      timestamp: Date.now()
    });
  }

  notifyStreamStarted(participantId: string, streamInfo: any): void {
    if (!this.isConnected()) {
      console.error('Cannot notify stream started: not connected');
      return;
    }

    console.log(`🎥 WEBSOCKET: Notifying stream started for ${participantId}:`, streamInfo);
    this.socket?.emit('stream-started', {
      participantId,
      streamInfo,
      timestamp: Date.now()
    });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect(): void {
    console.log('🔌 WEBSOCKET: Disconnecting...');
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
      this.circuitBreakerTimer = null;
    }

    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentRoomId = null;
    this.currentUserId = null;
    this.metrics.status = 'disconnected';
    this.isConnecting = false;
    this.isConnectingFlag = false;
    
    console.log('✅ WEBSOCKET: Disconnected successfully');
  }

  emit(event: string, data: any): void {
    if (!this.isConnected()) {
      console.error(`Cannot emit ${event}: not connected`);
      return;
    }

    console.log(`📡 WEBSOCKET: Emitting ${event}:`, data);
    this.socket?.emit(event, data);
  }

  // FASE 1: Utilities
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // FASE 3: Métricas para debugging
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  // FASE 3: Reset completo para casos extremos
  resetService(): void {
    console.log('🔄 WEBSOCKET: Resetting service completely...');
    this.disconnect();
    this.metrics = {
      attemptCount: 0,
      lastAttempt: 0,
      lastSuccess: 0,
      errorCount: 0,
      status: 'disconnected',
      consecutiveFailures: 0,
      networkQuality: 'unknown'
    };
    this.isCircuitOpen = false;
    this.shouldReconnect = true;
    this.detectNetworkQuality();
    console.log('✅ WEBSOCKET: Service reset completed');
  }

  // FASE 3: Métodos adicionais para compatibilidade
  healthCheck(): Promise<boolean> {
    return Promise.resolve(this.isConnected());
  }

  forceReconnect(): Promise<void> {
    console.log('🔄 WEBSOCKET: Force reconnecting...');
    this.disconnect();
    return this.connect();
  }

  isReady(): boolean {
    return this.isConnected();
  }

  getConnectionStatus(): string {
    return this.metrics.status;
  }
}

// Export singleton
export const unifiedWebSocketService = new UnifiedWebSocketService();