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
    console.log('🔍 [SUPABASE REALTIME] Project ID: fuhvpzprzqdfcojueswo');

    try {
      // Test Edge Function coordinator availability
      console.log('🧪 [SUPABASE REALTIME] Testing webrtc-coordinator Edge Function...');
      const { data, error } = await supabase.functions.invoke('webrtc-coordinator', {
        body: { action: 'heartbeat', sessionId: 'test', participantId: 'test' }
      });

      if (error) {
        console.error('❌ [SUPABASE REALTIME] Coordinator error:', error);
        console.error('❌ [SUPABASE REALTIME] Make sure Edge Functions are deployed!');
        console.error('❌ [SUPABASE REALTIME] Visit: https://supabase.com/dashboard/project/fuhvpzprzqdfcojueswo/functions');
        throw new Error(`Coordinator test failed: ${error.message || JSON.stringify(error)}`);
      }

      console.log('✅ [SUPABASE REALTIME] Coordinator test successful:', data);

      this.connectionStatus = 'connected';
      console.log('✅ [SUPABASE REALTIME] Connected successfully');
      
      this.callbacks.onConnected?.();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ [SUPABASE REALTIME] Connection failed:', error);
      console.error('❌ [SUPABASE REALTIME] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      this.connectionStatus = 'failed';
      this.callbacks.onConnectionFailed?.(error);
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`🔄 [SUPABASE REALTIME] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('❌ [SUPABASE REALTIME] Max reconnection attempts reached');
        console.error('❌ [SUPABASE REALTIME] Check Edge Functions deployment at: https://supabase.com/dashboard/project/fuhvpzprzqdfcojueswo/functions');
      }
    }
  }

  async joinRoom(sessionId: string, userId: string): Promise<void> {
    console.log(`🚪 [SUPABASE REALTIME] Joining room: ${sessionId} as ${userId}`);
    console.log('🔍 [SUPABASE REALTIME] Current connection status:', this.connectionStatus);
    
    if (this.connectionStatus !== 'connected') {
      console.error('❌ [SUPABASE REALTIME] Cannot join room: not connected. Call connect() first.');
      throw new Error('Not connected. Call connect() first.');
    }
    
    this.currentSessionId = sessionId;
    this.currentUserId = userId;

    // Clean up existing channel
    if (this.channel) {
      console.log('🧹 [SUPABASE REALTIME] Cleaning up existing channel');
      await supabase.removeChannel(this.channel);
    }

    // Create channel for this session
    console.log('📡 [SUPABASE REALTIME] Creating channel...');
    this.channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId }
      }
    });

    // Setup presence tracking
    console.log('👥 [SUPABASE REALTIME] Setting up presence tracking...');
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState() as PresenceState;
        console.log('👥 [SUPABASE REALTIME] Presence sync:', Object.keys(state).length, 'participants');
        console.log('👥 [SUPABASE REALTIME] Participants:', Object.keys(state));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👤 [SUPABASE REALTIME] User joined:', key, newPresences);
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
    console.log('📡 [SUPABASE REALTIME] Subscribing to channel...');
    await this.channel.subscribe(async (status) => {
      console.log('📡 [SUPABASE REALTIME] Channel subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ [SUPABASE REALTIME] Successfully subscribed to channel');
        
        // Track presence
        console.log('👤 [SUPABASE REALTIME] Tracking presence...');
        const presenceStatus = await this.channel!.track({
          user_id: userId,
          online_at: new Date().toISOString()
        });
        console.log('👤 [SUPABASE REALTIME] Presence track status:', presenceStatus);

        // Call coordinator edge function to register
        try {
          console.log('📝 [SUPABASE REALTIME] Registering with coordinator...');
          const { data, error } = await supabase.functions.invoke('webrtc-coordinator', {
            body: {
              action: 'join-session',
              sessionId,
              participantId: userId
            }
          });

          if (error) {
            console.error('❌ [SUPABASE REALTIME] Coordinator registration error:', error);
            console.error('❌ [SUPABASE REALTIME] Check Edge Functions at: https://supabase.com/dashboard/project/fuhvpzprzqdfcojueswo/functions');
            throw error;
          }
          console.log('✅ [SUPABASE REALTIME] Registered with coordinator:', data);
          
          // Start heartbeat
          console.log('💓 [SUPABASE REALTIME] Starting heartbeat...');
          this.startHeartbeat();
        } catch (error) {
          console.error('❌ [SUPABASE REALTIME] Failed to register with coordinator:', error);
          console.error('❌ [SUPABASE REALTIME] WebRTC may not work properly without coordinator');
        }
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ [SUPABASE REALTIME] Channel subscription error');
      } else if (status === 'TIMED_OUT') {
        console.error('❌ [SUPABASE REALTIME] Channel subscription timed out');
      } else if (status === 'CLOSED') {
        console.warn('⚠️ [SUPABASE REALTIME] Channel closed');
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
    
    this.stopHeartbeat();
    
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
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  startHeartbeat(): void {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log('💓 [SUPABASE REALTIME] Heartbeat started (30s interval)');

    this.heartbeatInterval = setInterval(async () => {
      if (this.currentSessionId && this.currentUserId) {
        try {
          console.log('💓 [SUPABASE REALTIME] Sending heartbeat...');
          const { data, error } = await supabase.functions.invoke('webrtc-coordinator', {
            body: {
              action: 'heartbeat',
              sessionId: this.currentSessionId,
              participantId: this.currentUserId
            }
          });

          if (error) {
            console.error('❌ [SUPABASE REALTIME] Heartbeat error:', error);
          } else {
            console.log('✅ [SUPABASE REALTIME] Heartbeat sent successfully');
          }
        } catch (error) {
          console.error('❌ [SUPABASE REALTIME] Heartbeat failed:', error);
        }
      } else {
        console.warn('⚠️ [SUPABASE REALTIME] Heartbeat skipped - no session/user');
      }
    }, 30000); // Every 30 seconds
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💓 [SUPABASE REALTIME] Heartbeat stopped');
    }
  }
}

// Singleton instance
export const supabaseRealtimeService = new SupabaseRealtimeService();
