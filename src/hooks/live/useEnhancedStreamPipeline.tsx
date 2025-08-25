// FASE 1 & 2: ENHANCED STREAM PIPELINE WITH DETERMINISTIC FLOW
import { useCallback, useEffect, useRef } from 'react';
import { videoRenderingCentralizer } from '@/utils/webrtc/VideoRenderingCentralizer';

interface StreamPipelineEvent {
  participantId: string;
  stream: MediaStream;
  correlationId: string;
  source: string;
  timestamp: number;
}

export const useEnhancedStreamPipeline = () => {
  const pipelineRef = useRef(new Map<string, StreamPipelineEvent>());

  useEffect(() => {
    // Register this pipeline
    videoRenderingCentralizer.registerRenderingSource('EnhancedStreamPipeline');
    
    return () => {
      videoRenderingCentralizer.unregisterRenderingSource('EnhancedStreamPipeline');
    };
  }, []);

  // FASE 1: DETERMINISTIC STREAM PROCESSING
  const processPipelineEvent = useCallback((event: CustomEvent<StreamPipelineEvent>) => {
    const { participantId, stream, correlationId, source, timestamp } = event.detail;
    
    console.log(`🌊 PIPELINE: Processing stream event`, {
      participantId,
      streamId: stream.id,
      correlationId,
      source,
      timestamp,
      videoTracks: stream.getVideoTracks().length
    });

    // Validate stream before processing
    if (!stream || stream.getVideoTracks().length === 0) {
      console.warn(`🌊 PIPELINE: Invalid stream for ${participantId} - no video tracks`);
      return;
    }

    // Check for duplicate processing
    const existingEvent = pipelineRef.current.get(participantId);
    if (existingEvent && existingEvent.timestamp === timestamp) {
      console.log(`🌊 PIPELINE: Duplicate event ignored for ${participantId}`);
      return;
    }

    // Store event for deduplication
    pipelineRef.current.set(participantId, { participantId, stream, correlationId, source, timestamp });

    // FASE 2: ROUTE TO CENTRALIZED DISPLAY MANAGER
    console.log(`🌊 PIPELINE: Routing to StreamDisplayManager for ${participantId}`);
    
    // Dispatch enhanced event for StreamDisplayManager to handle
    window.dispatchEvent(new CustomEvent('enhanced-stream-ready', {
      detail: { participantId, stream, correlationId, source, timestamp }
    }));

    // Emit pipeline processed event
    window.dispatchEvent(new CustomEvent('stream-pipeline-processed', {
      detail: { participantId, correlationId, timestamp: Date.now() }
    }));
  }, []);

  useEffect(() => {
    console.log('🌊 PIPELINE: Setting up enhanced stream event listeners');

    // Listen for the main stream event
    const handleStreamConnected = (event: CustomEvent) => {
      processPipelineEvent(event);
    };

    // FASE 1: LISTEN FOR ALL STREAM EVENTS WITH CORRELATION
    window.addEventListener('participant-stream-connected', handleStreamConnected as EventListener);

    return () => {
      window.removeEventListener('participant-stream-connected', handleStreamConnected as EventListener);
    };
  }, [processPipelineEvent]);

  // FASE 1: PIPELINE METRICS AND DEBUGGING
  const getPipelineMetrics = useCallback(() => {
    return {
      processedEvents: pipelineRef.current.size,
      events: Array.from(pipelineRef.current.values()),
      renderingCentralizer: videoRenderingCentralizer.getStats()
    };
  }, []);

  // Global debug access
  useEffect(() => {
    (window as any).__streamPipelineDebug = {
      getMetrics: getPipelineMetrics,
      clearPipeline: () => {
        pipelineRef.current.clear();
        console.log('🧹 PIPELINE: Cleared all pipeline events');
      },
      testEvent: (participantId: string) => {
        const testStream = new MediaStream();
        const testEvent = {
          participantId,
          stream: testStream,
          correlationId: `test-${Date.now()}`,
          source: 'manual-test',
          timestamp: Date.now()
        };
        
        window.dispatchEvent(new CustomEvent('participant-stream-connected', {
          detail: testEvent
        }));
        
        console.log('🧪 PIPELINE: Test event dispatched for', participantId);
      }
    };

    return () => {
      delete (window as any).__streamPipelineDebug;
    };
  }, [getPipelineMetrics]);

  return {
    getPipelineMetrics
  };
};