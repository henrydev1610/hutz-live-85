
import { useEffect } from 'react';
import { Participant } from '@/components/live/ParticipantGrid';
import { useVideoElementManagement } from './useVideoElementManagement';
import { useCleanStreamManagement } from './useCleanStreamManagement';
import { useParticipantLifecycle } from './useParticipantLifecycle';
import { useParticipantAutoSelection } from './useParticipantAutoSelection';
import { useStreamCallbackManager } from './useStreamCallbackManager';
import { useRobustWebRTC } from './useRobustWebRTC';
import { useStreamSynchronization } from './useStreamSynchronization';
import { streamTracker } from '@/utils/debug/streamTracker';
import { clearConnectionCache } from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

interface UseParticipantManagementProps {
  participantList: Participant[];
  setParticipantList: React.Dispatch<React.SetStateAction<Participant[]>>;
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
  sessionId: string | null;
  transmissionWindowRef: React.MutableRefObject<Window | null>;
  updateTransmissionParticipants: () => void;
}

export const useParticipantManagement = ({
  participantList,
  setParticipantList,
  participantStreams,
  setParticipantStreams,
  sessionId,
  transmissionWindowRef,
  updateTransmissionParticipants
}: UseParticipantManagementProps) => {
  const { updateVideoElementsImmediately } = useVideoElementManagement();
  
  // FASE 4: Stream synchronization
  const {
    confirmStreamReceived,
    confirmStreamDisplayed,
    getStreamHealth,
    getDebugInfo
  } = useStreamSynchronization();

  // FASE 3: Robust WebRTC
  const {
    transmitStreamWithRetry,
    forceRetransmission,
    validateStreamBeforeTransmit
  } = useRobustWebRTC({ sessionId });

  // Enhanced stream handler with full tracking
  const enhancedHandleParticipantStream = async (participantId: string, stream: MediaStream) => {
    console.log('🎯 ENHANCED MANAGEMENT: Processing stream with full tracking for:', participantId);
    
    try {
      // Step 1: Validate stream
      if (!validateStreamBeforeTransmit(stream)) {
        console.error('❌ ENHANCED MANAGEMENT: Stream validation failed');
        return;
      }

      // Step 2: Confirm stream received
      confirmStreamReceived(participantId, stream.id);

      // Step 3: Process with clean stream management
      await handleParticipantStream(participantId, stream);

      // Step 4: Transmit via WebRTC with retry
      const transmitted = await transmitStreamWithRetry(participantId, stream);
      
      if (transmitted) {
        // Step 5: Update video elements
        await updateVideoElementsImmediately(participantId, stream, transmissionWindowRef);
        
        // Step 6: Confirm displayed
        confirmStreamDisplayed(participantId, stream.id);
        
        // Step 7: Update transmission window
        setTimeout(() => {
          updateTransmissionParticipants();
        }, 100);
        
        console.log('✅ ENHANCED MANAGEMENT: Full stream processing completed for:', participantId);
      } else {
        console.error('❌ ENHANCED MANAGEMENT: Stream transmission failed for:', participantId);
      }
      
    } catch (error) {
      console.error('❌ ENHANCED MANAGEMENT: Error in stream processing:', error);
      
      // Log error for debugging
      streamTracker.logEvent({
        type: 'displayed',
        participantId,
        streamId: stream.id,
        details: { success: false, error: error.message, phase: 'processing' }
      });
    }
  };

  // Clean stream management
  const { handleParticipantStream } = useCleanStreamManagement({
    setParticipantStreams,
    setParticipantList,
    updateVideoElementsImmediately,
    transmissionWindowRef
  });

  const { 
    handleParticipantJoin, 
    handleParticipantSelect, 
    handleParticipantRemove 
  } = useParticipantLifecycle({
    participantList,
    setParticipantList,
    setParticipantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  const { transferStreamToTransmission } = useParticipantAutoSelection({
    participantList,
    setParticipantList,
    participantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  // FASE 2: Stream callback management
  const { areCallbacksSet, setupCallbacks, validateCallbacks } = useStreamCallbackManager({
    onParticipantStream: enhancedHandleParticipantStream,
    onParticipantJoin: handleParticipantJoin,
    sessionId
  });

  // Enhanced connection test with full diagnostics
  const testConnection = () => {
    console.log('🧪 ENHANCED MANAGEMENT: Running comprehensive connection test...');
    
    // Clear cache
    clearConnectionCache();
    clearDeviceCache();
    
    // Validate callbacks are set
    if (!areCallbacksSet) {
      console.error('🚨 TEST: Stream callbacks not set! Setting up...');
      setupCallbacks();
    }
    
    const testParticipant: Participant = {
      id: `test-${Date.now()}`,
      name: 'Test Participant',
      joinedAt: Date.now(),
      lastActive: Date.now(),
      active: true,
      selected: true,
      hasVideo: false,
      isMobile: false
    };
    
    // Track test start
    streamTracker.logEvent({
      type: 'capture',
      participantId: testParticipant.id,
      streamId: 'test-stream',
      details: { testMode: true, sessionId }
    });
    
    setParticipantList(prev => {
      const filtered = prev.filter(p => !p.id.startsWith('test-'));
      return [...filtered, testParticipant];
    });
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        console.log('✅ ENHANCED MANAGEMENT: Test stream obtained');
        enhancedHandleParticipantStream(testParticipant.id, stream);
        
        // Cleanup after 15 seconds
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          setParticipantList(prev => prev.filter(p => p.id !== testParticipant.id));
          setParticipantStreams(prev => {
            const updated = { ...prev };
            delete updated[testParticipant.id];
            return updated;
          });
        }, 15000);
      })
      .catch(err => {
        console.error('❌ ENHANCED MANAGEMENT: Test connection failed:', err);
        streamTracker.logEvent({
          type: 'capture',
          participantId: testParticipant.id,
          streamId: 'test-stream',
          details: { testMode: true, success: false, error: err.message }
        });
      });
  };

  // Force reconnection with full recovery
  const forceReconnectParticipant = async (participantId: string) => {
    console.log('🔥 FORCE RECONNECT: Starting recovery for:', participantId);
    
    try {
      // Get current stream
      const currentStream = participantStreams[participantId];
      if (!currentStream) {
        console.error('🔥 FORCE RECONNECT: No current stream found');
        return;
      }

      // Force retransmission
      const success = await forceRetransmission(participantId, currentStream);
      
      if (success) {
        // Force video update
        await updateVideoElementsImmediately(participantId, currentStream, transmissionWindowRef);
        confirmStreamDisplayed(participantId, currentStream.id);
        
        console.log('✅ FORCE RECONNECT: Recovery successful for:', participantId);
      } else {
        console.error('❌ FORCE RECONNECT: Recovery failed for:', participantId);
      }
    } catch (error) {
      console.error('❌ FORCE RECONNECT: Error during recovery:', error);
    }
  };

  // Setup periodic diagnostics
  useEffect(() => {
    if (!sessionId) return;

    const diagnosticInterval = setInterval(() => {
      const debugInfo = getDebugInfo();
      console.log('📊 DIAGNOSTIC: Stream synchronization status:', debugInfo);
      
      // Check callback health
      const callbacksValid = validateCallbacks();
      if (!callbacksValid) {
        console.warn('⚠️ DIAGNOSTIC: Stream callbacks are not properly set');
      }
      
      // Log participant stream health
      participantList.forEach(participant => {
        const health = getStreamHealth(participant.id);
        if (health !== 'unknown') {
          console.log(`💓 DIAGNOSTIC: ${participant.id} health: ${health}`);
        }
      });
    }, 10000);

    return () => clearInterval(diagnosticInterval);
  }, [sessionId, getDebugInfo, validateCallbacks, getStreamHealth, participantList]);

  return {
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream: enhancedHandleParticipantStream,
    testConnection,
    transferStreamToTransmission,
    forceReconnectParticipant,
    getStreamHealth,
    areCallbacksSet,
    getDebugInfo: () => ({
      ...getDebugInfo(),
      streamTracker: streamTracker.exportDebugReport()
    })
  };
};
