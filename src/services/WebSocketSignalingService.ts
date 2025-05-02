
import { supabase } from '@/integrations/supabase/client';

export interface SignalingMessage {
  type: string;
  senderId?: string;
  targetId?: string;
  sessionId?: string;
  description?: RTCSessionDescription;
  candidate?: RTCIceCandidate;
  timestamp?: number;
  [key: string]: any;
}

export interface SignalingCallback {
  (message: SignalingMessage): void;
}

class WebSocketSignalingService {
  private websocket: WebSocket | null = null;
  private roomId: string | null = null;
  private peerId: string | null = null;
  private callbacks: Map<string, SignalingCallback[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private url: string | null = null;
  private isConnecting: boolean = false;
  private lastMessageTime: number = 0;
  
  constructor() {
    // Initialize callbacks map with empty arrays for each event type
    const eventTypes = ['offer', 'answer', 'candidate', 'user-joined', 'user-left', 'welcome', 'peer-list', 'broadcast', 'error'];
    eventTypes.forEach(eventType => {
      this.callbacks.set(eventType, []);
    });
  }
  
  private getServerUrl(): string {
    const projectId = "vikhirqxfhmpgbkycwra";
    // First try connecting to the deployed edge function
    return `wss://${projectId}.supabase.co/functions/v1/signaling`;
  }
  
  public async connect(roomId: string, peerId: string, userName?: string): Promise<boolean> {
    if (this.isConnecting) {
      console.log('Already attempting to connect, ignoring duplicate request');
      return false;
    }
    
    this.isConnecting = true;
    
    if (this.websocket && this.websocket.readyState !== WebSocket.CLOSED) {
      console.log('WebSocket already connected, closing before reconnect');
      this.disconnect();
    }

    this.roomId = roomId;
    this.peerId = peerId;
    
    try {
      // Store the URL for potential reconnects
      this.url = this.getServerUrl();
      
      // Build connection URL with query parameters
      const connectionUrl = new URL(this.url);
      connectionUrl.searchParams.append('room', roomId);
      connectionUrl.searchParams.append('id', peerId);
      if (userName) {
        connectionUrl.searchParams.append('name', userName);
      }
      
      console.log(`Connecting to signaling server at: ${connectionUrl.toString()}`);
      this.websocket = new WebSocket(connectionUrl.toString());
      
      this.websocket.onopen = () => {
        console.log(`WebSocket connection established for peer ${peerId} in room ${roomId}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.startHeartbeat();
        
        // Update room in database
        this.updateRoomActivity(roomId);
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.lastMessageTime = Date.now();
          
          // Call the appropriate callbacks based on message type
          if (message.type && this.callbacks.has(message.type)) {
            const typeCallbacks = this.callbacks.get(message.type);
            if (typeCallbacks && typeCallbacks.length > 0) {
              typeCallbacks.forEach(callback => callback(message));
            }
          }
          
          // Special case for heartbeat-ack
          if (message.type === 'heartbeat-ack') {
            console.log('Heartbeat acknowledged by server');
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };
      
      this.websocket.onclose = (event) => {
        console.log(`WebSocket connection closed for peer ${peerId} in room ${roomId}. Code: ${event.code}, Reason: ${event.reason}`);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        // Attempt to reconnect unless this was an intentional close
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.websocket.onerror = (event) => {
        console.error(`WebSocket error:`, event);
        this.isConnecting = false;
        
        // Notify error callbacks
        if (this.callbacks.has('error')) {
          const errorCallbacks = this.callbacks.get('error');
          if (errorCallbacks && errorCallbacks.length > 0) {
            errorCallbacks.forEach(callback => callback({ type: 'error', error: 'Connection error' }));
          }
        }
        
        // The connection will close after an error, which will trigger reconnect
      };
      
      // Wait for the connection to establish or fail
      await new Promise<void>((resolve) => {
        const checkState = () => {
          if (this.websocket) {
            if (this.websocket.readyState === WebSocket.OPEN) {
              resolve();
            } else if (this.websocket.readyState === WebSocket.CLOSED) {
              resolve();
            } else {
              setTimeout(checkState, 100);
            }
          } else {
            resolve();
          }
        };
        checkState();
      });
      
      return this.websocket && this.websocket.readyState === WebSocket.OPEN;
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      this.isConnecting = false;
      return false;
    }
  }
  
  public disconnect(): void {
    this.stopHeartbeat();
    
    if (this.websocket) {
      // Only close if not already closed
      if (this.websocket.readyState !== WebSocket.CLOSED) {
        this.websocket.close(1000, 'Disconnected by client');
      }
      this.websocket = null;
    }
    
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  public isConnected(): boolean {
    return this.websocket !== null && this.websocket.readyState === WebSocket.OPEN;
  }
  
  public on(type: string, callback: SignalingCallback): void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    
    const callbacks = this.callbacks.get(type);
    if (callbacks) {
      callbacks.push(callback);
    }
  }
  
  public off(type: string, callback: SignalingCallback): void {
    if (this.callbacks.has(type)) {
      const callbacks = this.callbacks.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }
  
  public send(message: SignalingMessage): boolean {
    if (!this.isConnected()) {
      console.error('Cannot send message: WebSocket is not connected');
      return false;
    }
    
    try {
      // Ensure sender ID is set
      if (!message.senderId && this.peerId) {
        message.senderId = this.peerId;
      }
      
      // Add session ID if needed
      if (!message.sessionId && this.roomId) {
        message.sessionId = this.roomId;
      }
      
      // Add timestamp
      message.timestamp = Date.now();
      
      this.websocket!.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimeout !== null) {
      window.clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30 seconds
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = window.setTimeout(async () => {
      if (this.roomId && this.peerId) {
        console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts})`);
        await this.connect(this.roomId, this.peerId);
      }
    }, delay);
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'heartbeat' });
      } else {
        this.stopHeartbeat();
      }
    }, 30000); // Send heartbeat every 30 seconds
    
    // Also check for stale connections
    window.setInterval(() => {
      const now = Date.now();
      if (this.lastMessageTime > 0 && now - this.lastMessageTime > 90000) { // 90 seconds without messages
        console.warn('Connection appears stale. Last message received more than 90 seconds ago.');
        this.disconnect();
        if (this.roomId && this.peerId) {
          this.connect(this.roomId, this.peerId);
        }
      }
    }, 30000);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private async updateRoomActivity(roomId: string): Promise<void> {
    try {
      await supabase
        .from('signaling_rooms')
        .update({ last_active: new Date().toISOString() })
        .eq('room_id', roomId);
    } catch (e) {
      console.error('Error updating room activity:', e);
    }
  }
}

// Export singleton instance
export const webSocketSignalingService = new WebSocketSignalingService();
