
import { useCallback, useRef } from 'react';

interface StreamOperation {
  participantId: string;
  streamId: string;
  timestamp: number;
  promise: Promise<void>;
}

interface StreamState {
  currentStreamId: string | null;
  isProcessing: boolean;
  lastUpdate: number;
  skipCount: number;
}

export const useStreamManager = () => {
  const streamStatesRef = useRef(new Map<string, StreamState>());
  const activeOperationsRef = useRef(new Map<string, StreamOperation>());
  const globalDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const shouldProcessStream = useCallback((participantId: string, stream: MediaStream): boolean => {
    const currentState = streamStatesRef.current.get(participantId);
    const now = Date.now();
    
    // Debounce muito agressivo de 1 segundo para evitar piscar
    if (currentState && (now - currentState.lastUpdate) < 1000) {
      console.log(`⏸️ AGGRESSIVE DEBOUNCE: Blocking stream update for ${participantId} (${now - currentState.lastUpdate}ms ago)`);
      return false;
    }
    
    // Verificar se já está processando o mesmo stream
    if (currentState && 
        currentState.currentStreamId === stream.id && 
        currentState.isProcessing) {
      console.log(`⏸️ DUPLICATE BLOCK: Already processing stream ${stream.id} for ${participantId}`);
      return false;
    }

    // Verificar se há muitas tentativas consecutivas (possível loop)
    if (currentState && currentState.skipCount > 3) {
      console.log(`🚫 LOOP PREVENTION: Too many skips for ${participantId}, forcing reset`);
      streamStatesRef.current.delete(participantId);
    }
    
    return true;
  }, []);
  
  const markStreamProcessing = useCallback((participantId: string, stream: MediaStream): void => {
    const currentState = streamStatesRef.current.get(participantId);
    streamStatesRef.current.set(participantId, {
      currentStreamId: stream.id,
      isProcessing: true,
      lastUpdate: Date.now(),
      skipCount: currentState?.skipCount || 0
    });
  }, []);
  
  const markStreamComplete = useCallback((participantId: string): void => {
    const currentState = streamStatesRef.current.get(participantId);
    if (currentState) {
      streamStatesRef.current.set(participantId, {
        ...currentState,
        isProcessing: false,
        skipCount: 0
      });
    }
  }, []);

  const markStreamSkipped = useCallback((participantId: string): void => {
    const currentState = streamStatesRef.current.get(participantId);
    if (currentState) {
      streamStatesRef.current.set(participantId, {
        ...currentState,
        skipCount: (currentState.skipCount || 0) + 1
      });
    }
  }, []);
  
  const cancelActiveOperation = useCallback(async (participantId: string): Promise<void> => {
    const activeOp = activeOperationsRef.current.get(participantId);
    if (activeOp) {
      console.log(`🚫 FORCE CANCEL: Canceling active operation for ${participantId}`);
      activeOperationsRef.current.delete(participantId);
      try {
        await activeOp.promise;
      } catch (error) {
        console.log(`⚠️ Operation canceled for ${participantId}:`, error);
      }
    }
  }, []);
  
  const registerOperation = useCallback((participantId: string, stream: MediaStream, promise: Promise<void>): void => {
    const operation: StreamOperation = {
      participantId,
      streamId: stream.id,
      timestamp: Date.now(),
      promise
    };
    
    activeOperationsRef.current.set(participantId, operation);
    
    promise.finally(() => {
      const currentOp = activeOperationsRef.current.get(participantId);
      if (currentOp && currentOp.timestamp === operation.timestamp) {
        activeOperationsRef.current.delete(participantId);
      }
      markStreamComplete(participantId);
    });
  }, [markStreamComplete]);
  
  const processStreamSafely = useCallback(async (
    participantId: string, 
    stream: MediaStream, 
    processor: (participantId: string, stream: MediaStream) => Promise<void>
  ): Promise<void> => {
    const operationId = `${participantId}-${Date.now()}`;
    console.log(`🔐 CRITICAL: Starting SAFE stream processing for ${participantId} (${operationId})`);
    
    // Limpar qualquer debounce global pendente
    if (globalDebounceRef.current) {
      clearTimeout(globalDebounceRef.current);
      globalDebounceRef.current = null;
    }
    
    // Verificar se deve processar
    if (!shouldProcessStream(participantId, stream)) {
      markStreamSkipped(participantId);
      return;
    }
    
    // Cancelar operação ativa se existir
    await cancelActiveOperation(participantId);
    
    // Marcar como processando
    markStreamProcessing(participantId, stream);
    
    // Implementar debounce global para evitar múltiplas chamadas simultâneas
    return new Promise((resolve, reject) => {
      globalDebounceRef.current = setTimeout(async () => {
        try {
          const processingPromise = processor(participantId, stream);
          registerOperation(participantId, stream, processingPromise);
          
          await processingPromise;
          console.log(`✅ CRITICAL: Stream processing completed for ${participantId} (${operationId})`);
          resolve();
        } catch (error) {
          console.error(`❌ CRITICAL: Stream processing failed for ${participantId} (${operationId}):`, error);
          reject(error);
        }
      }, 200); // Debounce de 200ms
    });
  }, [shouldProcessStream, cancelActiveOperation, markStreamProcessing, registerOperation, markStreamSkipped]);
  
  const resetParticipantState = useCallback((participantId: string) => {
    console.log(`🔄 RESET: Resetting state for ${participantId}`);
    streamStatesRef.current.delete(participantId);
    activeOperationsRef.current.delete(participantId);
  }, []);
  
  return {
    processStreamSafely,
    shouldProcessStream,
    markStreamProcessing,
    markStreamComplete,
    resetParticipantState
  };
};
