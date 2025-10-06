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

      // FASE 2: Validar stream do ref
      if (!streamRef.current) {
        throw new Error('No stream available for connection');
      }

      // Validar tracks
      const videoTracks = streamRef.current.getVideoTracks();
      const audioTracks = streamRef.current.getAudioTracks();
      
      console.log('🔍 PARTICIPANT: Stream validation', {
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
      
      // FASE 5: Verificar conexão WebRTC após 5 segundos
      const streamCheckTimeout = setTimeout(() => {
        const pc = (window as any).__participantPeerConnection;
        if (pc && pc.connectionState !== 'connected') {
          console.warn('⚠️ FASE 5: Stream não conectado em 5s, tentando novamente');
          console.log('🔄 FASE 5: Connection state:', pc.connectionState);
          console.log('🔄 FASE 5: ICE state:', pc.iceConnectionState);
          
          // Retry connection com stream persistente
          if (streamRef.current) {
            console.log('🔄 FASE 5: Retrying connection with existing stream');
            connectToSession(streamRef.current);
          }
        } else if (pc) {
          console.log('✅ FASE 5: WebRTC connection verified:', pc.connectionState);
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
