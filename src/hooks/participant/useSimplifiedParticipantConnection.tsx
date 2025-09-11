import { useState, useCallback, useRef } from 'react';
import { initParticipantWebRTC, getWebRTCManager } from '@/utils/webrtc';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface SimplifiedConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  error: string | null;
  signalingStatus: string;
  webrtcState: string;
}

interface UseSimplifiedParticipantConnectionProps {
  sessionId: string | null;
  participantId: string;
}

export const useSimplifiedParticipantConnection = ({
  sessionId,
  participantId
}: UseSimplifiedParticipantConnectionProps) => {
  // FASE 3: Estado simplificado para conexão participant
  const [state, setState] = useState<SimplifiedConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionStatus: 'disconnected',
    error: null,
    signalingStatus: 'disconnected',
    webrtcState: 'disconnected'
  });

  const connectionAttempts = useRef(0);
  const maxAttempts = 3;
  const isConnectingRef = useRef(false);

  const updateState = useCallback((updates: Partial<SimplifiedConnectionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const connectToSession = useCallback(async (stream?: MediaStream | null) => {
    // FASE 3: Prevenção de conexões múltiplas
    if (isConnectingRef.current || !sessionId) {
      console.log('🔄 FASE 3: Connection already in progress or no sessionId');
      return;
    }

    console.log('🚀 FASE 3: Starting simplified participant connection', {
      sessionId,
      participantId,
      hasStream: !!stream,
      attempt: connectionAttempts.current + 1
    });

    isConnectingRef.current = true;
    connectionAttempts.current++;
    
    updateState({
      isConnecting: true,
      connectionStatus: 'connecting',
      error: null
    });

    try {
      // FASE 3: Passo 1 - Inicializar WebSocket primeiro
      console.log('📡 FASE 3: Step 1 - Connecting to WebSocket');
      updateState({ signalingStatus: 'connecting' });
      
      if (!unifiedWebSocketService.isConnected()) {
        await unifiedWebSocketService.connect();
      }
      
      if (!unifiedWebSocketService.isConnected()) {
        throw new Error('Failed to establish WebSocket connection');
      }
      
      updateState({ signalingStatus: 'connected' });
      console.log('✅ FASE 3: WebSocket connected');

      // FASE 3: Passo 2 - Aguardar estabilização (crítico para mobile)
      console.log('⏳ FASE 3: Step 2 - Connection stabilization wait');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // FASE 3: Passo 3 - Inicializar WebRTC com stream
      console.log('🔗 FASE 3: Step 3 - Initializing WebRTC');
      updateState({ webrtcState: 'connecting' });
      
      const { webrtc } = await initParticipantWebRTC(sessionId, participantId, stream);
      
      if (!webrtc) {
        throw new Error('WebRTC initialization failed - manager not returned');
      }

      updateState({ webrtcState: 'connected' });
      console.log('✅ FASE 3: WebRTC initialized successfully');

      // FASE 3: Passo 4 - Verificação final de conexão
      console.log('🔍 FASE 3: Step 4 - Final connection verification');
      const finalConnectionState = webrtc.getConnectionState();
      
      if (typeof finalConnectionState === 'string' && (finalConnectionState === 'connected' || finalConnectionState === 'connecting')) {
        updateState({
          isConnected: true,
          isConnecting: false,
          connectionStatus: 'connected',
          error: null
        });
        
        connectionAttempts.current = 0; // Reset on success
        console.log('🎉 FASE 3: Participant connection successful!');
        
        // FASE 3: Notificar sucesso globalmente
        window.dispatchEvent(new CustomEvent('participant-connected', {
          detail: { sessionId, participantId, hasStream: !!stream }
        }));
        
      } else {
        throw new Error(`WebRTC in unexpected state: ${finalConnectionState}`);
      }

    } catch (error: any) {
      console.error('❌ FASE 3: Connection failed:', error);
      
      const errorMessage = error?.message || 'Unknown connection error';
      
      updateState({
        isConnected: false,
        isConnecting: false,
        connectionStatus: 'failed',
        error: errorMessage,
        signalingStatus: 'failed',
        webrtcState: 'failed'
      });

      // FASE 3: Auto-retry logic com backoff
      if (connectionAttempts.current < maxAttempts) {
        const retryDelay = Math.min(2000 * connectionAttempts.current, 8000);
        console.log(`🔄 FASE 3: Auto-retry in ${retryDelay}ms (attempt ${connectionAttempts.current}/${maxAttempts})`);
        
        setTimeout(() => {
          if (stream) {
            connectToSession(stream);
          }
        }, retryDelay);
      } else {
        console.error('💀 FASE 3: Max connection attempts reached, giving up');
        updateState({ error: `Connection failed after ${maxAttempts} attempts: ${errorMessage}` });
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [sessionId, participantId, updateState]);

  const disconnectFromSession = useCallback(async () => {
    console.log('🔌 FASE 3: Disconnecting from session');
    
    try {
      // FASE 3: Cleanup WebRTC
      const webrtc = getWebRTCManager();
      if (webrtc) {
        webrtc.cleanup();
      }

      // FASE 3: Disconnect WebSocket
      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
      }

      updateState({
        isConnected: false,
        isConnecting: false,
        connectionStatus: 'disconnected',
        error: null,
        signalingStatus: 'disconnected',
        webrtcState: 'disconnected'
      });

      connectionAttempts.current = 0;
      console.log('✅ FASE 3: Disconnection complete');

    } catch (error) {
      console.error('❌ FASE 3: Disconnect error:', error);
    }
  }, [updateState]);

  const retryConnection = useCallback(async (stream?: MediaStream | null) => {
    console.log('🔄 FASE 3: Manual retry requested');
    connectionAttempts.current = 0; // Reset counter for manual retry
    await disconnectFromSession();
    
    // Small delay before reconnecting
    setTimeout(() => {
      connectToSession(stream);
    }, 1000);
  }, [connectToSession, disconnectFromSession]);

  return {
    ...state,
    connectToSession,
    disconnectFromSession,
    retryConnection,
    connectionAttempts: connectionAttempts.current,
    maxAttempts
  };
};