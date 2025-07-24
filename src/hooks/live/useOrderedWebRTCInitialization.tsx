/**
 * Hook para inicialização ordenada do sistema WebRTC + WebSocket
 * Resolve problemas de "Not in room" e ordem de execução incorreta
 */

import { useState, useCallback, useRef } from 'react';
import { SequenceManager, SequenceStep } from '@/utils/webrtc/SequenceManager';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface InitializationState {
  step: string | null;
  isInitializing: boolean;
  isReady: boolean;
  error: string | null;
  roomConfirmed: boolean;
  webrtcReady: boolean;
}

export const useOrderedWebRTCInitialization = () => {
  const [state, setState] = useState<InitializationState>({
    step: null,
    isInitializing: false,
    isReady: false,
    error: null,
    roomConfirmed: false,
    webrtcReady: false
  });

  const sequenceManagerRef = useRef<SequenceManager | null>(null);
  const roomConfirmationRef = useRef<Promise<void> | null>(null);

  const initSequenceManager = useCallback(() => {
    if (sequenceManagerRef.current) {
      sequenceManagerRef.current.cleanup();
    }

    sequenceManagerRef.current = new SequenceManager((sequenceState) => {
      setState(prev => ({
        ...prev,
        step: sequenceState.current,
        isInitializing: sequenceState.isRunning
      }));
    });

    console.log('🔄 OrderedWebRTC: SequenceManager initialized');
  }, []);

  /**
   * Inicialização ordenada como HOST
   */
  const initializeAsHost = useCallback(async (sessionId: string): Promise<void> => {
    console.log(`🏠 OrderedWebRTC: Starting host initialization for session ${sessionId}`);
    
    setState(prev => ({ 
      ...prev, 
      isInitializing: true, 
      error: null,
      roomConfirmed: false,
      webrtcReady: false,
      isReady: false
    }));

    initSequenceManager();
    const manager = sequenceManagerRef.current!;

    // PASSO 1: Desconectar WebSocket anterior (se existir)
    manager.addStep({
      id: 'disconnect-previous',
      name: 'Disconnect Previous WebSocket',
      timeout: 5000,
      retries: 1,
      execute: async () => {
        console.log('🧹 HOST Step 1: Disconnecting previous WebSocket connection');
        if (unifiedWebSocketService.isConnected()) {
          unifiedWebSocketService.disconnect();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('✅ HOST Step 1: Previous connection cleaned');
      }
    });

    // PASSO 2: Conectar WebSocket
    manager.addStep({
      id: 'connect-websocket',
      name: 'Connect WebSocket',
      timeout: 20000,
      retries: 2,
      execute: async () => {
        console.log('🔗 HOST Step 2: Connecting to WebSocket server');
        await unifiedWebSocketService.connect();
        console.log('✅ HOST Step 2: WebSocket connected');
      }
    });

    // PASSO 3: Entrar na sala e aguardar confirmação
    manager.addStep({
      id: 'join-room-wait-confirmation',
      name: 'Join Room and Wait Confirmation',
      timeout: 30000,
      retries: 2,
      execute: async () => {
        console.log('🚪 HOST Step 3: Joining room and waiting for confirmation');
        
        const hostId = `host-${Date.now()}`;
        
        // Setup listener para confirmação antes de enviar join
        const confirmationPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Room confirmation timeout'));
          }, 25000);

          const handleWelcome = (data: any) => {
            if (data.roomId === sessionId) {
              console.log('🎉 HOST Step 3: Room entry confirmed by server');
              clearTimeout(timeout);
              setState(prev => ({ ...prev, roomConfirmed: true }));
              resolve();
            }
          };

          // Listen for welcome message (room confirmation)
          unifiedWebSocketService.setCallbacks({
            onError: (error) => {
              console.error('❌ HOST Step 3: Error during room join:', error);
              clearTimeout(timeout);
              reject(error);
            }
          });

          // Manual listener setup since callbacks might not catch welcome
          const socket = (unifiedWebSocketService as any).socket;
          if (socket) {
            socket.once('welcome', handleWelcome);
          }
        });

        roomConfirmationRef.current = confirmationPromise;

        // Send join request
        await unifiedWebSocketService.joinRoom(sessionId, hostId);
        
        // Wait for confirmation
        await confirmationPromise;
        console.log('✅ HOST Step 3: Room joined and confirmed');
      }
    });

    // PASSO 4: Setup WebRTC como host
    manager.addStep({
      id: 'setup-webrtc-host',
      name: 'Setup WebRTC as Host',
      timeout: 10000,
      retries: 1,
      execute: async () => {
        console.log('🔧 HOST Step 4: Setting up WebRTC as host');
        
        // Aguardar confirmação da sala antes de configurar WebRTC
        if (!state.roomConfirmed && roomConfirmationRef.current) {
          await roomConfirmationRef.current;
        }

        setState(prev => ({ ...prev, webrtcReady: true }));
        console.log('✅ HOST Step 4: WebRTC host setup complete');
      }
    });

    try {
      await manager.executeSequence([
        'disconnect-previous',
        'connect-websocket', 
        'join-room-wait-confirmation',
        'setup-webrtc-host'
      ]);

      setState(prev => ({ 
        ...prev, 
        isReady: true, 
        isInitializing: false,
        step: null
      }));
      
      console.log('🎉 OrderedWebRTC: Host initialization completed successfully');
    } catch (error) {
      console.error('❌ OrderedWebRTC: Host initialization failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitializing: false,
        step: null
      }));
      throw error;
    }
  }, [state.roomConfirmed, initSequenceManager]);

  /**
   * Inicialização ordenada como PARTICIPANTE
   */
  const initializeAsParticipant = useCallback(async (
    sessionId: string, 
    participantId: string, 
    stream: MediaStream
  ): Promise<void> => {
    console.log(`👤 OrderedWebRTC: Starting participant initialization for session ${sessionId}`);
    
    if (!stream) {
      throw new Error('Stream is required for participant initialization');
    }

    setState(prev => ({ 
      ...prev, 
      isInitializing: true, 
      error: null,
      roomConfirmed: false,
      webrtcReady: false,
      isReady: false
    }));

    initSequenceManager();
    const manager = sequenceManagerRef.current!;

    // PASSO 1: Validar stream
    manager.addStep({
      id: 'validate-stream',
      name: 'Validate Media Stream',
      timeout: 5000,
      retries: 0,
      execute: async () => {
        console.log('📹 PARTICIPANT Step 1: Validating media stream');
        
        if (!stream.active) {
          throw new Error('Media stream is not active');
        }

        const tracks = stream.getTracks();
        if (tracks.length === 0) {
          throw new Error('Media stream has no tracks');
        }

        const inactiveTracks = tracks.filter(track => track.readyState !== 'live');
        if (inactiveTracks.length > 0) {
          throw new Error(`Media stream has inactive tracks: ${inactiveTracks.map(t => t.kind).join(', ')}`);
        }

        console.log('✅ PARTICIPANT Step 1: Media stream is valid');
      }
    });

    // PASSO 2: Desconectar WebSocket anterior
    manager.addStep({
      id: 'disconnect-previous',
      name: 'Disconnect Previous WebSocket',
      timeout: 5000,
      retries: 1,
      execute: async () => {
        console.log('🧹 PARTICIPANT Step 2: Disconnecting previous WebSocket connection');
        if (unifiedWebSocketService.isConnected()) {
          unifiedWebSocketService.disconnect();
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('✅ PARTICIPANT Step 2: Previous connection cleaned');
      }
    });

    // PASSO 3: Conectar WebSocket
    manager.addStep({
      id: 'connect-websocket',
      name: 'Connect WebSocket',
      timeout: 20000,
      retries: 2,
      execute: async () => {
        console.log('🔗 PARTICIPANT Step 3: Connecting to WebSocket server');
        await unifiedWebSocketService.connect();
        console.log('✅ PARTICIPANT Step 3: WebSocket connected');
      }
    });

    // PASSO 4: Entrar na sala e aguardar confirmação
    manager.addStep({
      id: 'join-room-wait-confirmation',
      name: 'Join Room and Wait Confirmation',
      timeout: 30000,
      retries: 2,
      execute: async () => {
        console.log('🚪 PARTICIPANT Step 4: Joining room and waiting for confirmation');
        
        // Setup listener para confirmação antes de enviar join
        const confirmationPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Room confirmation timeout'));
          }, 25000);

          const handleWelcome = (data: any) => {
            if (data.roomId === sessionId) {
              console.log('🎉 PARTICIPANT Step 4: Room entry confirmed by server');
              clearTimeout(timeout);
              setState(prev => ({ ...prev, roomConfirmed: true }));
              resolve();
            }
          };

          // Manual listener setup
          const socket = (unifiedWebSocketService as any).socket;
          if (socket) {
            socket.once('welcome', handleWelcome);
          }
        });

        roomConfirmationRef.current = confirmationPromise;

        // Send join request
        await unifiedWebSocketService.joinRoom(sessionId, participantId);
        
        // Wait for confirmation
        await confirmationPromise;
        console.log('✅ PARTICIPANT Step 4: Room joined and confirmed');
      }
    });

    // PASSO 5: Setup WebRTC como participante
    manager.addStep({
      id: 'setup-webrtc-participant',
      name: 'Setup WebRTC as Participant',
      timeout: 10000,
      retries: 1,
      execute: async () => {
        console.log('🔧 PARTICIPANT Step 5: Setting up WebRTC as participant');
        
        // Aguardar confirmação da sala antes de configurar WebRTC
        if (!state.roomConfirmed && roomConfirmationRef.current) {
          await roomConfirmationRef.current;
        }

        setState(prev => ({ ...prev, webrtcReady: true }));
        console.log('✅ PARTICIPANT Step 5: WebRTC participant setup complete');
      }
    });

    try {
      await manager.executeSequence([
        'validate-stream',
        'disconnect-previous',
        'connect-websocket',
        'join-room-wait-confirmation',
        'setup-webrtc-participant'
      ]);

      setState(prev => ({ 
        ...prev, 
        isReady: true, 
        isInitializing: false,
        step: null
      }));
      
      console.log('🎉 OrderedWebRTC: Participant initialization completed successfully');
    } catch (error) {
      console.error('❌ OrderedWebRTC: Participant initialization failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isInitializing: false,
        step: null
      }));
      throw error;
    }
  }, [state.roomConfirmed, initSequenceManager]);

  /**
   * Reset do estado
   */
  const reset = useCallback(() => {
    console.log('🔄 OrderedWebRTC: Resetting state');
    
    if (sequenceManagerRef.current) {
      sequenceManagerRef.current.cleanup();
      sequenceManagerRef.current = null;
    }

    roomConfirmationRef.current = null;

    setState({
      step: null,
      isInitializing: false,
      isReady: false,
      error: null,
      roomConfirmed: false,
      webrtcReady: false
    });
  }, []);

  /**
   * Stop da sequência atual
   */
  const stop = useCallback(() => {
    console.log('🛑 OrderedWebRTC: Stopping current sequence');
    
    if (sequenceManagerRef.current) {
      sequenceManagerRef.current.stop();
    }

    setState(prev => ({ 
      ...prev, 
      isInitializing: false,
      step: null
    }));
  }, []);

  return {
    state,
    initializeAsHost,
    initializeAsParticipant,
    reset,
    stop,
    isReady: state.isReady,
    isInitializing: state.isInitializing,
    currentStep: state.step,
    error: state.error,
    roomConfirmed: state.roomConfirmed,
    webrtcReady: state.webrtcReady
  };
};