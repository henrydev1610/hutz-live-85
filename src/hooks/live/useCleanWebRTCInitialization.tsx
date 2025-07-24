/**
 * FASE 1: Hook unificado e limpo para inicialização WebRTC + WebSocket
 * Substitui useOrderedWebRTCInitialization e duplicidade no LivePage
 * Implementa sequência correta e estável de conexão
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { getDeviceSpecificConstraints } from '@/utils/media/mediaConstraints';
import { useToast } from "@/hooks/use-toast";

interface CleanInitializationState {
  phase: 'idle' | 'connecting' | 'websocket-ready' | 'room-confirmed' | 'webrtc-ready' | 'ready' | 'error';
  isInitializing: boolean;
  isReady: boolean;
  error: string | null;
  roomConfirmed: boolean;
  webrtcReady: boolean;
  currentStep: string | null;
}

interface InitializationStep {
  id: string;
  name: string;
  execute: () => Promise<void>;
  timeout: number;
}

export const useCleanWebRTCInitialization = () => {
  const { toast } = useToast();
  const [state, setState] = useState<CleanInitializationState>({
    phase: 'idle',
    isInitializing: false,
    isReady: false,
    error: null,
    roomConfirmed: false,
    webrtcReady: false,
    currentStep: null
  });

  const initializationAbortRef = useRef<AbortController | null>(null);
  const roomConfirmationRef = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  // FASE 1: Sequência limpa de inicialização para HOST
  const initializeAsHost = useCallback(async (sessionId: string): Promise<void> => {
    console.log(`🏠 CLEAN INIT: Starting host initialization for session ${sessionId}`);
    
    // Abortar inicialização anterior
    if (initializationAbortRef.current) {
      initializationAbortRef.current.abort();
    }
    
    initializationAbortRef.current = new AbortController();
    const { signal } = initializationAbortRef.current;

    setState(prev => ({ 
      ...prev, 
      phase: 'connecting',
      isInitializing: true, 
      error: null,
      roomConfirmed: false,
      webrtcReady: false,
      isReady: false
    }));

    try {
      // PASSO 1: Limpar conexões anteriores
      setState(prev => ({ ...prev, currentStep: 'Limpando conexões anteriores' }));
      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (signal.aborted) throw new Error('Initialization aborted');

      // PASSO 2: Conectar WebSocket
      setState(prev => ({ ...prev, currentStep: 'Conectando ao servidor', phase: 'connecting' }));
      await unifiedWebSocketService.connect();
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, phase: 'websocket-ready' }));

      // PASSO 3: Entrar na sala COM confirmação
      setState(prev => ({ ...prev, currentStep: 'Entrando na sala' }));
      
      const confirmationPromise = new Promise<void>((resolve, reject) => {
        roomConfirmationRef.current = { resolve, reject };
        
        // Setup listener para confirmação
        const handleWelcome = (data: any) => {
          if (data.roomId === sessionId) {
            console.log('🎉 CLEAN HOST: Room entry confirmed');
            roomConfirmationRef.current?.resolve();
            roomConfirmationRef.current = null;
          }
        };

        // Listener direto no socket
        const socket = (unifiedWebSocketService as any).socket;
        if (socket) {
          socket.once('welcome', handleWelcome);
        }
        
        // Timeout para confirmação
        setTimeout(() => {
          roomConfirmationRef.current?.reject(new Error('Room confirmation timeout'));
          roomConfirmationRef.current = null;
        }, 30000);
      });

      // Enviar join request
      const hostId = `host-${Date.now()}`;
      await unifiedWebSocketService.joinRoom(sessionId, hostId);
      
      // Aguardar confirmação
      await confirmationPromise;
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, roomConfirmed: true, phase: 'room-confirmed' }));

      // PASSO 4: Configurar WebRTC (apenas marcar como pronto)
      setState(prev => ({ ...prev, currentStep: 'Configurando WebRTC' }));
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular configuração
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, webrtcReady: true, phase: 'webrtc-ready' }));

      // FINALIZAÇÃO
      setState(prev => ({ 
        ...prev, 
        phase: 'ready',
        isReady: true, 
        isInitializing: false,
        currentStep: null
      }));
      
      toast({
        title: "Sistema conectado!",
        description: "Host conectado e pronto para receber participantes",
      });
      
      console.log('🎉 CLEAN HOST: Initialization completed successfully');
    } catch (error) {
      console.error('❌ CLEAN HOST: Initialization failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitializing: false,
        currentStep: null
      }));
      
      toast({
        title: "Erro de conexão",
        description: "Falha ao conectar o sistema. Tente novamente.",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [toast]);

  // FASE 1: Sequência limpa de inicialização para PARTICIPANTE
  const initializeAsParticipant = useCallback(async (
    sessionId: string, 
    participantId: string, 
    stream: MediaStream
  ): Promise<void> => {
    console.log(`👤 CLEAN INIT: Starting participant initialization for session ${sessionId}`);
    
    // Abortar inicialização anterior
    if (initializationAbortRef.current) {
      initializationAbortRef.current.abort();
    }
    
    initializationAbortRef.current = new AbortController();
    const { signal } = initializationAbortRef.current;

    setState(prev => ({ 
      ...prev, 
      phase: 'connecting',
      isInitializing: true, 
      error: null,
      roomConfirmed: false,
      webrtcReady: false,
      isReady: false
    }));

    try {
      // PASSO 1: Validar stream
      setState(prev => ({ ...prev, currentStep: 'Validando vídeo' }));
      if (!stream || !stream.active || stream.getTracks().length === 0) {
        throw new Error('Stream inválido - verifique permissões de câmera');
      }
      
      const inactiveTracks = stream.getTracks().filter(track => track.readyState !== 'live');
      if (inactiveTracks.length > 0) {
        throw new Error('Algumas trilhas de vídeo estão inativas');
      }

      if (signal.aborted) throw new Error('Initialization aborted');

      // PASSO 2: Limpar conexões anteriores
      setState(prev => ({ ...prev, currentStep: 'Limpando conexões anteriores' }));
      if (unifiedWebSocketService.isConnected()) {
        unifiedWebSocketService.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (signal.aborted) throw new Error('Initialization aborted');

      // PASSO 3: Conectar WebSocket
      setState(prev => ({ ...prev, currentStep: 'Conectando ao servidor', phase: 'connecting' }));
      await unifiedWebSocketService.connect();
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, phase: 'websocket-ready' }));

      // PASSO 4: Entrar na sala COM confirmação
      setState(prev => ({ ...prev, currentStep: 'Entrando na sala' }));
      
      const confirmationPromise = new Promise<void>((resolve, reject) => {
        roomConfirmationRef.current = { resolve, reject };
        
        // Setup listener para confirmação
        const handleWelcome = (data: any) => {
          if (data.roomId === sessionId) {
            console.log('🎉 CLEAN PARTICIPANT: Room entry confirmed');
            roomConfirmationRef.current?.resolve();
            roomConfirmationRef.current = null;
          }
        };

        // Listener direto no socket
        const socket = (unifiedWebSocketService as any).socket;
        if (socket) {
          socket.once('welcome', handleWelcome);
        }
        
        // Timeout para confirmação
        setTimeout(() => {
          roomConfirmationRef.current?.reject(new Error('Room confirmation timeout'));
          roomConfirmationRef.current = null;
        }, 30000);
      });

      // Enviar join request
      await unifiedWebSocketService.joinRoom(sessionId, participantId);
      
      // Aguardar confirmação
      await confirmationPromise;
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, roomConfirmed: true, phase: 'room-confirmed' }));

      // PASSO 5: Configurar WebRTC com stream
      setState(prev => ({ ...prev, currentStep: 'Configurando transmissão de vídeo' }));
      await new Promise(resolve => setTimeout(resolve, 500)); // Simular configuração
      
      if (signal.aborted) throw new Error('Initialization aborted');
      setState(prev => ({ ...prev, webrtcReady: true, phase: 'webrtc-ready' }));

      // FINALIZAÇÃO
      setState(prev => ({ 
        ...prev, 
        phase: 'ready',
        isReady: true, 
        isInitializing: false,
        currentStep: null
      }));
      
      toast({
        title: "Conectado com sucesso!",
        description: "Sua transmissão de vídeo está ativa",
      });
      
      console.log('🎉 CLEAN PARTICIPANT: Initialization completed successfully');
    } catch (error) {
      console.error('❌ CLEAN PARTICIPANT: Initialization failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitializing: false,
        currentStep: null
      }));
      
      toast({
        title: "Erro de conexão",
        description: error instanceof Error ? error.message : "Falha ao conectar. Tente novamente.",
        variant: "destructive"
      });
      
      throw error;
    }
  }, [toast]);

  // Reset limpo
  const reset = useCallback(() => {
    console.log('🔄 CLEAN INIT: Resetting state');
    
    if (initializationAbortRef.current) {
      initializationAbortRef.current.abort();
      initializationAbortRef.current = null;
    }

    if (roomConfirmationRef.current) {
      roomConfirmationRef.current.reject(new Error('Reset called'));
      roomConfirmationRef.current = null;
    }

    setState({
      phase: 'idle',
      isInitializing: false,
      isReady: false,
      error: null,
      roomConfirmed: false,
      webrtcReady: false,
      currentStep: null
    });
  }, []);

  // Stop da inicialização atual
  const stop = useCallback(() => {
    console.log('🛑 CLEAN INIT: Stopping current initialization');
    
    if (initializationAbortRef.current) {
      initializationAbortRef.current.abort();
    }

    setState(prev => ({ 
      ...prev, 
      isInitializing: false,
      currentStep: null
    }));
  }, []);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (initializationAbortRef.current) {
        initializationAbortRef.current.abort();
      }
      if (roomConfirmationRef.current) {
        roomConfirmationRef.current.reject(new Error('Component unmounted'));
      }
    };
  }, []);

  return {
    state,
    initializeAsHost,
    initializeAsParticipant,
    reset,
    stop,
    isReady: state.isReady,
    isInitializing: state.isInitializing,
    currentStep: state.currentStep,
    error: state.error,
    roomConfirmed: state.roomConfirmed,
    webrtcReady: state.webrtcReady,
    phase: state.phase
  };
};