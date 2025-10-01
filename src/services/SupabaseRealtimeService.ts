import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionFailed?: (error: any) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  onStreamStarted?: (participantId: string, streamInfo: any) => void;
  onOffer?: (data: any) => void;
  onAnswer?: (data: any) => void;
  onIceCandidate?: (data: any) => void;
}

interface PresenceState {
  [key: string]: Array<{
    user_id: string;
    online_at: string;
    stream_info?: any;
  }>;
}

export class SupabaseRealtimeService {
  private channel: RealtimeChannel | null = null;
  private callbacks: RealtimeCallbacks = {};
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'failed' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  constructor() {
    console.log('🚀 [SUPABASE REALTIME] Service initialized');
  }

  setCallbacks(callbacks: RealtimeCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('📋 [SUPABASE REALTIME] Callbacks configured');
  }

  async connect(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      console.log('⚠️ [SUPABASE REALTIME] Already connected or connecting');
      return;
    }

    this.connectionStatus = 'connecting';
    console.log('🔗 [SUPABASE REALTIME] Connecting to Supabase Realtime...');

    try {
      // Test Supabase connection
      const { error } = await supabase.from('signaling_rooms').select('count').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = table not found, which is ok
        console.warn('⚠️ [SUPABASE REALTIME] Supabase connection warning:', error);
      }

      this.connectionStatus = 'connected';
      console.log('✅ [SUPABASE REALTIME] Connected successfully');
      
      this.callbacks.onConnected?.();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ [SUPABASE REALTIME] Connection failed:', error);
      this.connectionStatus = 'failed';
      this.callbacks.onConnectionFailed?.(error);
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`🔄 [SUPABASE REALTIME] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => this.connect(), delay);
      }
    }
  }

  async joinRoom(sessionId: string, userId: string): Promise<void> {
    console.log(`🚪 [SUPABASE REALTIME] Joining room: ${sessionId} as ${userId}`);
    
    this.currentSessionId = sessionId;
    this.currentUserId = userId;

    // Clean up existing channel
    if (this.channel) {
      await supabase.removeChannel(this.channel);
    }

    // Create channel for this session
    this.channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId }
      }
    });

    // Setup presence tracking
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState() as PresenceState;
        console.log('👥 [SUPABASE REALTIME] Presence sync:', Object.keys(state).length, 'participants');
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👤 [SUPABASE REALTIME] User joined:', key);
        this.callbacks.onUserJoined?.(key);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log('👋 [SUPABASE REALTIME] User left:', key);
        this.callbacks.onUserLeft?.(key);
      });

    // Setup broadcast listeners for WebRTC signaling
    this.channel
      .on('broadcast', { event: 'webrtc-offer' }, ({ payload }) => {
        console.log('📥 [SUPABASE REALTIME] Received WebRTC offer');
        this.callbacks.onOffer?.(payload);
      })
      .on('broadcast', { event: 'webrtc-answer' }, ({ payload }) => {
        console.log('📥 [SUPABASE REALTIME] Received WebRTC answer');
        this.callbacks.onAnswer?.(payload);
      })
      .on('broadcast', { event: 'webrtc-candidate' }, ({ payload }) => {
        console.log('📥 [SUPABASE REALTIME] Received ICE candidate');
        this.callbacks.onIceCandidate?.(payload);
      })
      .on('broadcast', { event: 'stream-started' }, ({ payload }) => {
        console.log('📥 [SUPABASE REALTIME] Stream started:', payload);
        this.callbacks.onStreamStarted?.(payload.participantId, payload.streamInfo);
      });

    // Subscribe to channel
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ [SUPABASE REALTIME] Subscribed to channel');
        
        // Track presence
        await this.channel!.track({
          user_id: userId,
          online_at: new Date().toISOString()
        });

        // Call coordinator edge function to register
        try {
          const { data, error } = await supabase.functions.invoke('webrtc-coordinator', {
            body: {
              action: 'join-session',
              sessionId,
              participantId: userId
            }
          });

          if (error) throw error;
          console.log('✅ [SUPABASE REALTIME] Registered with coordinator:', data);
        } catch (error) {
          console.error('❌ [SUPABASE REALTIME] Failed to register with coordinator:', error);
        }
      }
    });
  }

  async leaveRoom(): Promise<void> {
    if (!this.channel || !this.currentSessionId || !this.currentUserId) {
      return;
    }

    console.log('👋 [SUPABASE REALTIME] Leaving room');

    try {
      // Notify coordinator
      await supabase.functions.invoke('webrtc-coordinator', {
        body: {
          action: 'leave-session',
          sessionId: this.currentSessionId,
          participantId: this.currentUserId
        }
      });
    } catch (error) {
      console.error('❌ [SUPABASE REALTIME] Failed to notify coordinator:', error);
    }

    // Untrack presence
    await this.channel.untrack();
    
    // Remove channel
    await supabase.removeChannel(this.channel);
    
    this.channel = null;
    this.currentSessionId = null;
    this.currentUserId = null;
  }

  // WebRTC signaling methods
  sendOffer(targetUserId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.channel) {
      console.error('❌ [SUPABASE REALTIME] Cannot send offer: not in a room');
      return;
    }

    console.log('📤 [SUPABASE REALTIME] Sending WebRTC offer to:', targetUserId);
    
    this.channel.send({
      type: 'broadcast',
      event: 'webrtc-offer',
      payload: {
        fromUserId: this.currentUserId,
        targetUserId,
        offer
      }
    });
  }

  sendAnswer(targetUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.channel) {
      console.error('❌ [SUPABASE REALTIME] Cannot send answer: not in a room');
      return;
    }

    console.log('📤 [SUPABASE REALTIME] Sending WebRTC answer to:', targetUserId);
    
    this.channel.send({
      type: 'broadcast',
      event: 'webrtc-answer',
      payload: {
        fromUserId: this.currentUserId,
        targetUserId,
        answer
      }
    });
  }

  sendIceCandidate(targetUserId: string, candidate: RTCIceCandidateInit): void {
    if (!this.channel) {
      console.error('❌ [SUPABASE REALTIME] Cannot send ICE candidate: not in a room');
      return;
    }

    this.channel.send({
      type: 'broadcast',
      event: 'webrtc-candidate',
      payload: {
        fromUserId: this.currentUserId,
        targetUserId,
        candidate
      }
    });
  }

  emit(event: string, data: any): void {
    if (!this.channel) {
      console.error('❌ [SUPABASE REALTIME] Cannot emit: not in a room');
      return;
    }

    console.log('📤 [SUPABASE REALTIME] Emitting event:', event);
    
    this.channel.send({
      type: 'broadcast',
      event,
      payload: data
    });
  }

  disconnect(): void {
    console.log('🔌 [SUPABASE REALTIME] Disconnecting');
    
    if (this.channel) {
      this.leaveRoom();
    }

    this.connectionStatus = 'disconnected';
    this.callbacks.onDisconnected?.();
  }

  isReady(): boolean {
    return this.connectionStatus === 'connected' && this.channel !== null;
  }

  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  // Heartbeat to keep connection alive
  startHeartbeat(): void {
    setInterval(async () => {
      if (this.currentSessionId && this.currentUserId) {
        try {
          await supabase.functions.invoke('webrtc-coordinator', {
            body: {
              action: 'heartbeat',
              sessionId: this.currentSessionId,
              participantId: this.currentUserId
            }
          });
        } catch (error) {
          console.error('❌ [SUPABASE REALTIME] Heartbeat failed:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }
}

// Singleton instance
export const supabaseRealtimeService = new SupabaseRealtimeService();
