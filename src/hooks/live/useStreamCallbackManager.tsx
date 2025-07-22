
import { useEffect, useCallback, useRef } from 'react';
import { setStreamCallback, setParticipantJoinCallback } from '@/utils/webrtc';
import { streamTracker } from '@/utils/debug/streamTracker';

interface UseStreamCallbackManagerProps {
  onParticipantStream: (participantId: string, stream: MediaStream) => Promise<void>;
  onParticipantJoin: (participantId: string) => void;
  sessionId: string | null;
}

export const useStreamCallbackManager = ({
  onParticipantStream,
  onParticipantJoin,
  sessionId
}: UseStreamCallbackManagerProps) => {
  const callbacksSetRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Enhanced stream callback with tracking
  const enhancedStreamCallback = useCallback(async (participantId: string, stream: MediaStream) => {
    streamTracker.logEvent({
      type: 'received',
      participantId,
      streamId: stream.id,
      details: {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active,
        sessionId
      }
    });

    console.log('🔄 ENHANCED CALLBACK: Stream received for:', participantId, {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    try {
      await onParticipantStream(participantId, stream);
      
      streamTracker.logEvent({
        type: 'displayed',
        participantId,
        streamId: stream.id,
        details: { success: true }
      });
    } catch (error) {
      console.error('❌ ENHANCED CALLBACK: Error processing stream:', error);
      streamTracker.logEvent({
        type: 'displayed',
        participantId,
        streamId: stream.id,
        details: { success: false, error: error.message }
      });
    }
  }, [onParticipantStream, sessionId]);

  // Enhanced join callback with tracking
  const enhancedJoinCallback = useCallback((participantId: string) => {
    console.log('👤 ENHANCED CALLBACK: Participant joined:', participantId);
    onParticipantJoin(participantId);
  }, [onParticipantJoin]);

  // Setup callbacks with validation
  const setupCallbacks = useCallback(() => {
    console.log('🔧 CALLBACK MANAGER: Setting up callbacks for session:', sessionId);
    
    try {
      setStreamCallback(enhancedStreamCallback);
      setParticipantJoinCallback(enhancedJoinCallback);
      
      callbacksSetRef.current = true;
      
      streamTracker.logEvent({
        type: 'callback_set',
        participantId: 'system',
        streamId: 'system',
        details: { sessionId, success: true }
      });
      
      console.log('✅ CALLBACK MANAGER: Callbacks configured successfully');
      return true;
    } catch (error) {
      console.error('❌ CALLBACK MANAGER: Failed to setup callbacks:', error);
      callbacksSetRef.current = false;
      return false;
    }
  }, [enhancedStreamCallback, enhancedJoinCallback, sessionId]);

  // Validate callbacks are working
  const validateCallbacks = useCallback(() => {
    // Test if callbacks are actually set
    const testResult = typeof (window as any).__streamCallback === 'function';
    
    if (!testResult && callbacksSetRef.current) {
      console.error('🚨 CALLBACK MANAGER: Callbacks appear to be lost! Retrying setup...');
      callbacksSetRef.current = false;
      setupCallbacks();
    }
    
    return testResult;
  }, [setupCallbacks]);

  // Setup effect
  useEffect(() => {
    if (!sessionId) return;

    console.log('🎯 CALLBACK MANAGER: Initializing for session:', sessionId);
    
    // Clear any existing retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    // Setup callbacks immediately
    const success = setupCallbacks();
    
    if (!success) {
      console.warn('⚠️ CALLBACK MANAGER: Initial setup failed, scheduling retry...');
      retryTimeoutRef.current = setTimeout(() => {
        setupCallbacks();
      }, 1000);
    }

    // Validation interval
    const validationInterval = setInterval(() => {
      validateCallbacks();
    }, 5000);

    return () => {
      clearInterval(validationInterval);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [sessionId, setupCallbacks, validateCallbacks]);

  return {
    areCallbacksSet: callbacksSetRef.current,
    setupCallbacks,
    validateCallbacks
  };
};
