
import { useCallback, useRef, useState } from 'react';
import { streamLogger } from '@/utils/debug/StreamLogger';

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
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    console.log('📦 Adding stream to buffer:', participantId);
    
    streamLogger.log(
      'VALIDATION' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      {
        streamId: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      },
      'BUFFER',
      'Stream added to buffer'
    );
    
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
      
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const deviceType = isMobile ? 'mobile' : 'desktop';
      
      try {
        console.log('🔄 Processing buffered stream:', pending.participantId);
        
        streamLogger.log(
          'VALIDATION' as any,
          pending.participantId,
          isMobile,
          deviceType,
          { timestamp: Date.now(), duration: 0, retryCount: pending.retryCount },
          {
            streamId: pending.stream.id,
            active: pending.stream.active
          },
          'BUFFER_PROCESS',
          'Processing buffered stream'
        );
        
        const success = await processFunction(pending.participantId, pending.stream);
        
        if (success) {
          console.log('✅ Successfully processed buffered stream:', pending.participantId);
          
          streamLogger.log(
            'STREAM_SUCCESS' as any,
            pending.participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: 0 },
            undefined,
            'BUFFER_SUCCESS',
            'Buffered stream processed successfully'
          );
          
          setPendingStreams(prev => prev.filter(p => p.participantId !== pending.participantId));
          if (retryTimeoutRef.current[pending.participantId]) {
            clearTimeout(retryTimeoutRef.current[pending.participantId]);
            delete retryTimeoutRef.current[pending.participantId];
          }
        } else {
          // Schedule retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, pending.retryCount), 10000);
          console.log(`⏰ Scheduling retry for ${pending.participantId} in ${retryDelay}ms`);
          
          streamLogger.log(
            'VALIDATION' as any,
            pending.participantId,
            isMobile,
            deviceType,
            { timestamp: Date.now(), duration: retryDelay, retryCount: pending.retryCount + 1 },
            undefined,
            'BUFFER_RETRY',
            `Scheduling retry in ${retryDelay}ms`
          );
          
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
        
        streamLogger.logStreamError(
          pending.participantId,
          isMobile,
          deviceType,
          error as Error,
          pending.retryCount
        );
      } finally {
        processingRef.current.delete(pending.participantId);
      }
    }
  }, [pendingStreams]);

  const removeFromBuffer = useCallback((participantId: string) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    streamLogger.log(
      'VALIDATION' as any,
      participantId,
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'BUFFER_REMOVE',
      'Stream removed from buffer'
    );
    
    setPendingStreams(prev => prev.filter(p => p.participantId !== participantId));
    if (retryTimeoutRef.current[participantId]) {
      clearTimeout(retryTimeoutRef.current[participantId]);
      delete retryTimeoutRef.current[participantId];
    }
  }, []);

  const cleanup = useCallback(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const deviceType = isMobile ? 'mobile' : 'desktop';
    
    streamLogger.log(
      'VALIDATION' as any,
      'system',
      isMobile,
      deviceType,
      { timestamp: Date.now(), duration: 0 },
      undefined,
      'BUFFER_CLEANUP',
      'Stream buffer cleanup initiated'
    );
    
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
