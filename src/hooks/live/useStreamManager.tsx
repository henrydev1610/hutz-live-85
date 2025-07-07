
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
}

export const useStreamManager = () => {
  const streamStatesRef = useRef(new Map<string, StreamState>());
  const activeOperationsRef = useRef(new Map<string, StreamOperation>());
  
  const shouldProcessStream = useCallback((participantId: string, stream: MediaStream): boolean => {
    const currentState = streamStatesRef.current.get(participantId);
    const now = Date.now();
    
    // Prevenir processamento muito frequente (debounce de 500ms)
    if (currentState && (now - currentState.lastUpdate) < 500) {
      console.log(`⏸️ Debouncing stream update for ${participantId}`);
      return false;
    }
    
    // Verificar se já está processando o mesmo stream
    if (currentState && currentState.currentStreamId === stream.id && currentState.isProcessing) {
      console.log(`⏸️ Already processing stream ${stream.id} for ${participantId}`);
      return false;
    }
    
    return true;
  }, []);
  
  const markStreamProcessing = useCallback((participantId: string, stream: MediaStream): void => {
    streamStatesRef.current.set(participantId, {
      currentStreamId: stream.id,
      isProcessing: true,
      lastUpdate: Date.now()
    });
  }, []);
  
  const markStreamComplete = useCallback((participantId: string): void => {
    const currentState = streamStatesRef.current.get(participantId);
    if (currentState) {
      streamStatesRef.current.set(participantId, {
        ...currentState,
        isProcessing: false
      });
    }
  }, []);
  
  const cancelActiveOperation = useCallback(async (participantId: string): Promise<void> => {
    const activeOp = activeOperationsRef.current.get(participantId);
    if (activeOp) {
      console.log(`🚫 Canceling active operation for ${participantId}`);
      activeOperationsRef.current.delete(participantId);
      // Aguardar a conclusão da operação anterior antes de continuar
      try {
        await activeOp.promise;
      } catch (error) {
        console.log(`⚠️ Previous operation canceled for ${participantId}:`, error);
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
    
    // Remover operação quando completar
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
    console.log(`🔐 SAFE: Starting stream processing for ${participantId} (${operationId})`);
    
    // Verificar se deve processar
    if (!shouldProcessStream(participantId, stream)) {
      return;
    }
    
    // Cancelar operação ativa se existir
    await cancelActiveOperation(participantId);
    
    // Marcar como processando
    markStreamProcessing(participantId, stream);
    
    // Criar e registrar nova operação
    const processingPromise = processor(participantId, stream);
    registerOperation(participantId, stream, processingPromise);
    
    try {
      await processingPromise;
      console.log(`✅ SAFE: Stream processing completed for ${participantId} (${operationId})`);
    } catch (error) {
      console.error(`❌ SAFE: Stream processing failed for ${participantId} (${operationId}):`, error);
      throw error;
    }
  }, [shouldProcessStream, cancelActiveOperation, markStreamProcessing, registerOperation]);
  
  return {
    processStreamSafely,
    shouldProcessStream,
    markStreamProcessing,
    markStreamComplete
  };
};
