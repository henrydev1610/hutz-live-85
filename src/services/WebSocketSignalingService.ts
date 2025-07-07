
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

class WebSocketSignalingService {
  private socket: Socket | null = null;
  private callbacks: SignalingCallbacks = {};
  private isConnected = false;
  private currentRoom: string | null = null;
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private fallbackMode = false;

  constructor() {
    console.log('🔧 WebSocket Signaling Service initialized');
  }

  setCallbacks(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
    console.log('📞 Signaling callbacks set:', Object.keys(callbacks));
  }

  async connect(serverUrl?: string): Promise<void> {
    const url = serverUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    
    console.log(`🔌 Connecting to signaling server: ${url}`);
    
    try {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      return new Promise((resolve, reject) => {
        const connectTimeout = setTimeout(() => {
          console.warn('⚠️ Connection timeout, enabling fallback mode');
          this.fallbackMode = true;
          resolve();
        }, 5000);

        this.socket!.on('connect', () => {
          clearTimeout(connectTimeout);
          console.log('✅ Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.fallbackMode = false;
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(connectTimeout);
          console.error('❌ Connection error:', error);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('⚠️ Max reconnection attempts reached, enabling fallback mode');
            this.fallbackMode = true;
            resolve();
          } else {
            reject(error);
          }
        });

        this.socket!.on('disconnect', (reason) => {
          console.log('🔌 Disconnected from signaling server:', reason);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            console.log('🔄 Attempting to reconnect...');
            this.socket!.connect();
          }
        });

        this.socket!.on('error', (error) => {
          console.error('❌ Socket error:', error);
          
          // Handle TypeID validation errors specifically
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
      console.error('❌ Failed to initialize socket connection:', error);
      this.fallbackMode = true;
      throw error;
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

    // WebRTC signaling events
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

    // Stream events - NEW!
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
      // Don't propagate TypeID errors to UI
      if (!error.message?.includes('TypeID')) {
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      }
    });
  }

  async joinRoom(roomId: string, userId: string): Promise<void> {
    console.log(`🏠 Joining room: ${roomId} as user: ${userId}`);
    
    this.currentRoom = roomId;
    this.currentUserId = userId;

    if (!this.socket || this.fallbackMode) {
      await this.connect();
    }

    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('join-room', {
          roomId,
          userId,
          timestamp: Date.now()
        });
        console.log('✅ Join room request sent');
      } catch (error) {
        console.error('❌ Failed to join room:', error);
        if (error.message?.includes('TypeID')) {
          console.warn('⚠️ TypeID error ignored, continuing in fallback mode');
          this.fallbackMode = true;
        }
      }
    } else {
      console.warn('⚠️ Operating in fallback mode - no server connection');
      this.fallbackMode = true;
    }
  }

  // NEW: Notify about stream events
  notifyStreamStarted(participantId: string, streamInfo: any): void {
    console.log(`📹 Notifying stream started for: ${participantId}`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('stream-started', {
          participantId,
          roomId: this.currentRoom,
          streamInfo,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('❌ Failed to notify stream started:', error);
      }
    }
  }

  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    console.log(`📤 Sending offer to: ${targetUserId}`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('offer', {
          targetUserId,
          offer,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId
        });
      } catch (error) {
        console.error('❌ Failed to send offer:', error);
      }
    } else {
      console.warn('⚠️ Cannot send offer - no connection');
    }
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    console.log(`📥 Sending answer to: ${targetUserId}`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('answer', {
          targetUserId,
          answer,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId
        });
      } catch (error) {
        console.error('❌ Failed to send answer:', error);
      }
    } else {
      console.warn('⚠️ Cannot send answer - no connection');
    }
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidate): void {
    console.log(`🧊 Sending ICE candidate to: ${targetUserId}`);
    
    if (this.socket && this.isConnected && !this.fallbackMode) {
      try {
        this.socket.emit('ice-candidate', {
          targetUserId,
          candidate,
          roomId: this.currentRoom,
          fromUserId: this.currentUserId
        });
      } catch (error) {
        console.error('❌ Failed to send ICE candidate:', error);
      }
    } else {
      console.warn('⚠️ Cannot send ICE candidate - no connection');
    }
  }

  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  isReady(): boolean {
    return this.isConnected && !this.fallbackMode;
  }

  disconnect(): void {
    console.log('🔌 Disconnecting from signaling server');
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.currentRoom = null;
    this.currentUserId = null;
    this.fallbackMode = false;
    this.reconnectAttempts = 0;
  }
}

export default new WebSocketSignalingService();
