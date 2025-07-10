import { useCallback, useRef, useState } from 'react';

interface PendingStream {
  participantId: string;
  stream: MediaStream;
  timestamp: number;
  retryCount: number;
}

export const useStreamBuffer = () => {
  const [pendingStreams, setPendingStreams] = useState<PendingStream[]>([]);
  const processingRef = useRef<Set<string>>(new Set());
  const retryTimeoutRef = useRef<{[key: string]: NodeJS.Timeout}>({});

  const addToBuffer = useCallback((participantId: string, stream: MediaStream) => {
    console.log('📦 Adding stream to buffer:', participantId);
    
    setPendingStreams(prev => {
      const filtered = prev.filter(p => p.participantId !== participantId);
      return [...filtered, {
        participantId,
        stream,
        timestamp: Date.now(),
        retryCount: 0
      }];
    });
  }, []);

  const processBuffer = useCallback(async (
    processFunction: (participantId: string, stream: MediaStream) => Promise<boolean>
  ) => {
    const streams = [...pendingStreams];
    
    for (const pending of streams) {
      if (processingRef.current.has(pending.participantId)) {
        continue;
      }

      processingRef.current.add(pending.participantId);
      
      try {
        console.log('🔄 Processing buffered stream:', pending.participantId);
        const success = await processFunction(pending.participantId, pending.stream);
        
        if (success) {
          console.log('✅ Successfully processed buffered stream:', pending.participantId);
          setPendingStreams(prev => prev.filter(p => p.participantId !== pending.participantId));
          if (retryTimeoutRef.current[pending.participantId]) {
            clearTimeout(retryTimeoutRef.current[pending.participantId]);
            delete retryTimeoutRef.current[pending.participantId];
          }
        } else {
          // Schedule retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, pending.retryCount), 10000);
          console.log(`⏰ Scheduling retry for ${pending.participantId} in ${retryDelay}ms`);
          
          setPendingStreams(prev => prev.map(p => 
            p.participantId === pending.participantId 
              ? { ...p, retryCount: p.retryCount + 1 }
              : p
          ));

          retryTimeoutRef.current[pending.participantId] = setTimeout(() => {
            processingRef.current.delete(pending.participantId);
            processBuffer(processFunction);
          }, retryDelay);
        }
      } catch (error) {
        console.error('❌ Error processing buffered stream:', error);
      } finally {
        processingRef.current.delete(pending.participantId);
      }
    }
  }, [pendingStreams]);

  const removeFromBuffer = useCallback((participantId: string) => {
    setPendingStreams(prev => prev.filter(p => p.participantId !== participantId));
    if (retryTimeoutRef.current[participantId]) {
      clearTimeout(retryTimeoutRef.current[participantId]);
      delete retryTimeoutRef.current[participantId];
    }
  }, []);

  const cleanup = useCallback(() => {
    Object.values(retryTimeoutRef.current).forEach(clearTimeout);
    retryTimeoutRef.current = {};
    setPendingStreams([]);
    processingRef.current.clear();
  }, []);

  return {
    addToBuffer,
    processBuffer,
    removeFromBuffer,
    cleanup,
    pendingCount: pendingStreams.length
  };
};