import { useState, useRef, useCallback } from 'react';

interface StreamMutex {
  isLocked: boolean;
  operation: string | null;
  startTime: number | null;
}

export const useStreamMutex = (participantId: string) => {
  const [mutex, setMutex] = useState<StreamMutex>({
    isLocked: false,
    operation: null,
    startTime: null
  });
  
  const lockTimeout = useRef<NodeJS.Timeout | null>(null);
  const MAX_LOCK_DURATION = 30000; // 30 seconds max lock

  const acquireLock = useCallback((operation: string): boolean => {
    if (mutex.isLocked) {
      console.warn(`🔒 [MUTEX] Cannot acquire lock for ${operation} - already locked by ${mutex.operation}`);
      return false;
    }

    console.log(`🔒 [MUTEX] Acquiring lock for operation: ${operation}`);
    
    setMutex({
      isLocked: true,
      operation,
      startTime: Date.now()
    });

    // Auto-release lock after max duration to prevent deadlocks
    lockTimeout.current = setTimeout(() => {
      console.warn(`⏰ [MUTEX] Auto-releasing lock for ${operation} (timeout)`);
      releaseLock();
    }, MAX_LOCK_DURATION);

    return true;
  }, [mutex.isLocked, mutex.operation]);

  const releaseLock = useCallback(() => {
    if (lockTimeout.current) {
      clearTimeout(lockTimeout.current);
      lockTimeout.current = null;
    }

    console.log(`🔓 [MUTEX] Releasing lock for operation: ${mutex.operation}`);
    
    setMutex({
      isLocked: false,
      operation: null,
      startTime: null
    });
  }, [mutex.operation]);

  const isOperationAllowed = useCallback((operation: string): boolean => {
    if (!mutex.isLocked) return true;
    
    // Allow same operation to proceed
    if (mutex.operation === operation) return true;
    
    // Block WebRTC operations during media operations and vice versa
    const mediaOperations = ['initialize-media', 'switch-camera', 'retry-media'];
    const webrtcOperations = ['webrtc-handshake', 'webrtc-offer', 'webrtc-answer'];
    
    const isCurrentMedia = mediaOperations.includes(mutex.operation || '');
    const isCurrentWebRTC = webrtcOperations.includes(mutex.operation || '');
    const isRequestedMedia = mediaOperations.includes(operation);
    const isRequestedWebRTC = webrtcOperations.includes(operation);
    
    // Block conflicting operations
    if ((isCurrentMedia && isRequestedWebRTC) || (isCurrentWebRTC && isRequestedMedia)) {
      console.warn(`🚫 [MUTEX] Blocking ${operation} - conflicts with ${mutex.operation}`);
      return false;
    }
    
    return true;
  }, [mutex.isLocked, mutex.operation]);

  const withMutexLock = useCallback(async (
    operation: string,
    callback: () => Promise<any>
  ): Promise<any> => {
    if (!acquireLock(operation)) {
      console.warn(`🚫 [MUTEX] Cannot execute ${operation} - mutex locked`);
      return null;
    }

    try {
      const result = await callback();
      return result;
    } finally {
      releaseLock();
    }
  }, [acquireLock, releaseLock]);

  return {
    isLocked: mutex.isLocked,
    currentOperation: mutex.operation,
    lockStartTime: mutex.startTime,
    acquireLock,
    releaseLock,
    isOperationAllowed,
    withMutexLock
  };
};