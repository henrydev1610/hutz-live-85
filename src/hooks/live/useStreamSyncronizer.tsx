import { useEffect, useRef, useCallback } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';

interface UseStreamSynchronizerProps {
  participantStreams: {[id: string]: MediaStream};
  participantList: Participant[];
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  sessionId: string | null;
}

export const useStreamSynchronizer = ({
  participantStreams,
  participantList,
  transmissionWindowRef,
  sessionId
}: UseStreamSynchronizerProps) => {
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncStatusRef = useRef<{activeStreams: number, sharedStreams: number}>({
    activeStreams: 0,
    sharedStreams: 0
  });

  // CRITICAL: Aggressive stream synchronization
  const performStreamSync = useCallback(() => {
    if (!sessionId || !transmissionWindowRef.current) return;

    console.log('🔄 STREAM SYNC: Starting aggressive synchronization...');

    // Get current active streams
    const activeStreams = Object.keys(participantStreams).filter(id => {
      const stream = participantStreams[id];
      return stream && stream.getTracks().length > 0 && 
             stream.getTracks().some(track => track.readyState === 'live');
    });

    // Get selected participants with video
    const selectedWithVideo = participantList.filter(p => p.selected && p.hasVideo);

    // Check shared streams status
    const sharedStreamsCount = window.sharedParticipantStreams ? 
      Object.keys(window.sharedParticipantStreams).length : 0;

    console.log('📊 STREAM SYNC STATUS:', {
      activeStreams: activeStreams.length,
      selectedWithVideo: selectedWithVideo.length,
      sharedStreams: sharedStreamsCount,
      participantStreamsKeys: Object.keys(participantStreams),
      selectedParticipantIds: selectedWithVideo.map(p => p.id)
    });

    // CRITICAL: If there are active streams but no shared streams, force sync
    if (activeStreams.length > 0 && sharedStreamsCount === 0) {
      console.log('🚨 CRITICAL SYNC: Active streams detected but none shared - forcing sync!');
      
      // Initialize shared streams if not exists
      if (!window.sharedParticipantStreams) {
        window.sharedParticipantStreams = {};
      }

      // Force all active streams to be shared
      activeStreams.forEach(participantId => {
        const stream = participantStreams[participantId];
        if (stream) {
          console.log(`🔥 FORCE SYNC: Adding stream for ${participantId} to shared streams`);
          
          // Add to global shared streams
          window.sharedParticipantStreams[participantId] = stream;
          
          // Ensure participant is marked as selected and has video
          const participant = participantList.find(p => p.id === participantId);
          if (participant && (!participant.selected || !participant.hasVideo)) {
            console.log(`🔥 FORCE SYNC: Auto-selecting participant ${participantId}`);
            
            // Update participant state to force selection
            const updateEvent = new CustomEvent('forceParticipantSelection', {
              detail: { participantId, hasVideo: true, selected: true }
            });
            window.dispatchEvent(updateEvent);
          }

          // Send stream directly to transmission window
          try {
            if (!transmissionWindowRef.current.sharedParticipantStreams) {
              transmissionWindowRef.current.sharedParticipantStreams = {};
            }
            transmissionWindowRef.current.sharedParticipantStreams[participantId] = stream;

            // Send notification to transmission window
            transmissionWindowRef.current.postMessage({
              type: 'force-stream-sync',
              participantId,
              streamId: stream.id,
              hasStream: true,
              trackCount: stream.getTracks().length,
              videoTracks: stream.getVideoTracks().length,
              forceUpdate: true,
              timestamp: Date.now()
            }, '*');

            console.log(`✅ FORCE SYNC: Stream for ${participantId} sent to transmission window`);
          } catch (error) {
            console.error(`❌ FORCE SYNC: Failed to send stream for ${participantId}:`, error);
          }
        }
      });

      // Send bulk update to transmission window
      transmissionWindowRef.current.postMessage({
        type: 'bulk-stream-force-sync',
        participants: activeStreams.map(id => ({
          id,
          streamId: participantStreams[id]?.id,
          hasStream: true,
          forceUpdate: true
        })),
        totalActiveStreams: activeStreams.length,
        totalSharedStreams: activeStreams.length, // Should match after sync
        timestamp: Date.now()
      }, '*');

      console.log(`🔥 BULK SYNC: Sent ${activeStreams.length} streams to transmission`);
    }

    // CRITICAL: If selected participants don't have streams in transmission, force them
    selectedWithVideo.forEach(participant => {
      const stream = participantStreams[participant.id];
      const isShared = window.sharedParticipantStreams?.[participant.id];
      
      if (stream && !isShared) {
        console.log(`🔥 PARTICIPANT SYNC: Force sharing stream for selected participant ${participant.id}`);
        
        if (!window.sharedParticipantStreams) {
          window.sharedParticipantStreams = {};
        }
        
        window.sharedParticipantStreams[participant.id] = stream;
        
        // Send to transmission window
        try {
          if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
            if (!transmissionWindowRef.current.sharedParticipantStreams) {
              transmissionWindowRef.current.sharedParticipantStreams = {};
            }
            transmissionWindowRef.current.sharedParticipantStreams[participant.id] = stream;
            
            transmissionWindowRef.current.postMessage({
              type: 'participant-stream-force-sync',
              participantId: participant.id,
              streamId: stream.id,
              hasStream: true,
              forceUpdate: true,
              timestamp: Date.now()
            }, '*');
          }
        } catch (error) {
          console.error(`❌ PARTICIPANT SYNC: Failed for ${participant.id}:`, error);
        }
      }
    });

    // Update last sync status
    lastSyncStatusRef.current = {
      activeStreams: activeStreams.length,
      sharedStreams: window.sharedParticipantStreams ? Object.keys(window.sharedParticipantStreams).length : 0
    };

  }, [participantStreams, participantList, transmissionWindowRef, sessionId]);

  // Setup sync interval
  useEffect(() => {
    if (!sessionId) return;

    console.log('🕐 STREAM SYNC: Starting synchronization timer (every 1.5 seconds)');
    
    // Initial sync
    setTimeout(performStreamSync, 500);
    
    // Regular sync every 1.5 seconds
    syncIntervalRef.current = setInterval(performStreamSync, 1500);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [sessionId, performStreamSync]);

  // Listen for force sync events
  useEffect(() => {
    const handleForceSyncEvent = () => {
      console.log('🔥 STREAM SYNC: Received force sync event');
      performStreamSync();
    };

    window.addEventListener('forceStreamSync', handleForceSyncEvent);
    
    return () => {
      window.removeEventListener('forceStreamSync', handleForceSyncEvent);
    };
  }, [performStreamSync]);

  const forceSyncNow = useCallback(() => {
    console.log('🔥 STREAM SYNC: Manual force sync triggered');
    performStreamSync();
  }, [performStreamSync]);

  return {
    forceSyncNow,
    lastSyncStatus: lastSyncStatusRef.current
  };
};