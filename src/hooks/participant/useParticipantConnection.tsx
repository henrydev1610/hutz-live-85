import { useEffect, useState, useCallback, useRef } from 'react';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { toast } from 'sonner';

// FASE 1: Flag global para prevenir conexões duplicadas
declare global {
  interface Window {
    __participantConnectionInProgress?: boolean;
  }
}

export const useParticipantConnection = (sessionId: string | undefined, participantId: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  // FASE 1 & 2: Sistema de retry simplificado com stream persistente
  const streamRef = useRef<MediaStream | null>(null);
  const retryCountRef = useRef(0);
  const lastRetryTimeRef = useRef(0);
  const MAX_RETRIES = 2;
  const RETRY_INTERVAL_MS = 10000; // 10 segundos

  const connectToSession = useCallback(async (stream?: MediaStream | null) => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }

    // FASE 1: Prevenir conexões duplicadas
    if (window.__participantConnectionInProgress) {
      console.warn('⏸️ PARTICIPANT: Connection already in progress, skipping');
      return;
    }

    // FASE 1: Check retry limit simplificado
    const now = Date.now();
    const timeSinceLastRetry = now - lastRetryTimeRef.current;
    
    if (retryCountRef.current >= MAX_RETRIES && timeSinceLastRetry < RETRY_INTERVAL_MS) {
      const waitTime = Math.ceil((RETRY_INTERVAL_MS - timeSinceLastRetry) / 1000);
      console.warn(`⏸️ PARTICIPANT: Max retries reached. Wait ${waitTime}s`);
      setError(`Aguarde ${waitTime}s para tentar novamente`);
      return;
    }

    // Reset retry count se passou o intervalo
    if (timeSinceLastRetry >= RETRY_INTERVAL_MS) {
      retryCountRef.current = 0;
    }

    window.__participantConnectionInProgress = true;
    retryCountRef.current++;
    lastRetryTimeRef.current = now;

    // FASE 2: Armazenar stream no ref para persistência
    if (stream) {
      console.log('🎥 PARTICIPANT: Storing stream in ref', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });
      streamRef.current = stream;
    }

    console.log('🚀 PARTICIPANT: Starting connection process', {
      sessionId,
      participantId,
      hasStream: !!streamRef.current,
      streamTracks: streamRef.current?.getTracks().length,
      retryCount: retryCountRef.current
    });

    setIsConnecting(true);
    setError(null);

    try {
      console.log('📡 PARTICIPANT: Checking WebSocket connection...');
      
      // FASE 1: Conectar WebSocket sem ensureConnection (simplificado)
      if (!unifiedWebSocketService.isReady()) {
        console.log('📡 PARTICIPANT: WebSocket not ready, connecting...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
          
          unifiedWebSocketService.on('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          unifiedWebSocketService.connect();
        });
      }

      console.log('✅ PARTICIPANT: WebSocket ready');

      console.log('👤 PARTICIPANT: Joining session via WebSocket...');
      await unifiedWebSocketService.joinRoom(sessionId, participantId);

      await new Promise(resolve => setTimeout(resolve, 500));

      // FASE 4: Validate stream BEFORE connecting
      if (!streamRef.current) {
        throw new Error('No stream available for connection');
      }

      const videoTracks = streamRef.current.getVideoTracks();
      const audioTracks = streamRef.current.getAudioTracks();
      
      console.log('🔍 PATCH FASE 4: Stream validation', {
        streamId: streamRef.current.id,
        active: streamRef.current.active,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks[0]?.enabled,
        videoReadyState: videoTracks[0]?.readyState
      });

      if (videoTracks.length === 0) {
        throw new Error('Stream has no video tracks');
      }
      
      // FASE 4: Check if tracks are live and enabled
      const videoTrack = videoTracks[0];
      if (videoTrack.readyState !== 'live' || !videoTrack.enabled) {
        console.warn('⚠️ PATCH FASE 4: Video track not ready, reinitializing...');
        throw new Error('Video track not ready - needs reinitialization');
      }

      console.log('✅ PATCH FASE 4: Stream validated successfully');

      console.log('🤝 PARTICIPANT: Initializing WebRTC handshake...');
      // WebRTC handshake será iniciado pelo ParticipantHandshake automaticamente
      console.log('✅ PARTICIPANT: WebRTC initialized');

      console.log('✅ PARTICIPANT: Successfully connected to session');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionStatus('connected');
      setError(null);
      
      // Reset retry count on success
      retryCountRef.current = 0;
      
      // FASE 6: Verify WebRTC connection after 5s and reinitialize media if needed
      const streamCheckTimeout = setTimeout(async () => {
        const pc = (window as any).__participantPeerConnection;
        if (pc && pc.connectionState !== 'connected') {
          console.warn('⚠️ PATCH FASE 6: Connection timeout after 5s');
          console.log('🔄 PATCH FASE 6: Connection state:', pc.connectionState);
          console.log('🔄 PATCH FASE 6: ICE state:', pc.iceConnectionState);
          console.log('🔄 PATCH FASE 6: Signaling state:', pc.signalingState);
          
          // FASE 6: Check if stream health is the issue
          const currentStream = (window as any).__participantSharedStream;
          const needsMediaRecovery = !currentStream || 
                                     currentStream.getVideoTracks().length === 0 ||
                                     currentStream.getVideoTracks()[0].readyState !== 'live';
          
          if (needsMediaRecovery) {
            console.log('🔄 PATCH FASE 6: Reinitializing media before retry');
            // Signal to reinitialize media externally
            window.dispatchEvent(new CustomEvent('webrtc-media-recovery-needed'));
          }
          
          // FASE 6: Close PC and retry
          try {
            pc.close();
            console.log('🔄 PATCH FASE 6: Closed stale PeerConnection');
          } catch (err) {
            console.warn('⚠️ PATCH FASE 6: Error closing PC:', err);
          }
          
          (window as any).__participantPeerConnection = null;
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (streamRef.current) {
            console.log('🔄 PATCH FASE 6: Retrying connection with fresh PeerConnection');
            connectToSession(streamRef.current);
          }
        } else if (pc) {
          console.log('✅ PATCH FASE 6: WebRTC connection verified:', pc.connectionState);
        }
      }, 5000);

    } catch (error) {
      console.error('❌ PARTICIPANT: Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Falha ao conectar';
      setError(errorMessage);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      toast.error(`Erro de conexão: ${errorMessage}`);
    } finally {
      window.__participantConnectionInProgress = false;
    }
  }, [sessionId, participantId]);

  const disconnectFromSession = useCallback(async () => {
    console.log('🔌 PARTICIPANT: Disconnecting from session');
    
    try {
      // Disconnect WebSocket
      if (unifiedWebSocketService.isReady()) {
        unifiedWebSocketService.disconnect();
      }
      
      // FASE 2: Limpar stream ref
      streamRef.current = null;
      window.__participantConnectionInProgress = false;
      
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      setError(null);
      
      console.log('✅ PARTICIPANT: Disconnected successfully');
    } catch (error) {
      console.error('❌ PARTICIPANT: Error during disconnect:', error);
    }
  }, [sessionId, participantId]);

  return {
    isConnected,
    isConnecting,
    connectionStatus,
    error,
    connectToSession,
    disconnectFromSession
  };
};
