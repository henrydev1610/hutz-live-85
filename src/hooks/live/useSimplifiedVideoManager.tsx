import { useCallback, useEffect, useRef } from 'react';

// SISTEMA SIMPLIFICADO PARA SUBSTITUIR TODOS OS GERENCIADORES COMPLEXOS
export const useSimplifiedVideoManager = () => {
  const processedStreams = useRef(new Set<string>());

  // Event listener simples para streams
  useEffect(() => {
    const handleStreamEvent = (event: CustomEvent) => {
      const { participantId, stream } = event.detail;
      
      if (!participantId || !stream) {
        console.warn('🚫 SIMPLIFIED: Invalid stream event data');
        return;
      }

      const streamKey = `${participantId}-${stream.id}`;
      
      if (processedStreams.current.has(streamKey)) {
        console.log('🔄 SIMPLIFIED: Stream already processed:', streamKey);
        return;
      }

      console.log('📹 SIMPLIFIED: Processing new stream:', participantId, stream.id);
      processedStreams.current.add(streamKey);

      // Encontrar container unificado
      const container = document.getElementById(`unified-video-container-${participantId}`);
      const videoElement = container?.querySelector('video') as HTMLVideoElement;

      if (!container || !videoElement) {
        console.warn('🚫 SIMPLIFIED: Container or video not found for:', participantId);
        return;
      }

      // Aplicar stream se diferente
      if (videoElement.srcObject !== stream) {
        console.log('🎬 SIMPLIFIED: Applying stream to video element');
        videoElement.srcObject = stream;
        
        videoElement.play().then(() => {
          console.log('✅ SIMPLIFIED: Video playing for:', participantId);
        }).catch(err => {
          console.error('❌ SIMPLIFIED: Play failed for:', participantId, err);
        });
      }
    };

    // Listen to multiple stream events for compatibility
    const events = [
      'participant-stream-connected',
      'enhanced-stream-ready',
      'stream-received'
    ];

    events.forEach(eventName => {
      window.addEventListener(eventName, handleStreamEvent as EventListener);
    });

    console.log('🎧 SIMPLIFIED: Video manager initialized');

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, handleStreamEvent as EventListener);
      });
      processedStreams.current.clear();
    };
  }, []);

  // Clean stream processing when needed
  const clearProcessedStreams = useCallback(() => {
    processedStreams.current.clear();
    console.log('🧹 SIMPLIFIED: Cleared processed streams');
  }, []);

  return {
    clearProcessedStreams
  };
};