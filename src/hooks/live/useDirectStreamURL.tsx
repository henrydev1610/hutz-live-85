
import { useState, useEffect, useCallback } from 'react';

interface StreamURLState {
  streamURL: string | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

interface UseDirectStreamURLProps {
  participantId: string;
  sessionId: string;
  enabled?: boolean;
}

export const useDirectStreamURL = ({ participantId, sessionId, enabled = true }: UseDirectStreamURLProps) => {
  const [state, setState] = useState<StreamURLState>({
    streamURL: null,
    isLoading: false,
    error: null,
    isConnected: false
  });

  const generateStreamURL = useCallback(() => {
    const baseURL = window.location.origin;
    return `${baseURL}/api/stream/${sessionId}/${participantId}`;
  }, [sessionId, participantId]);

  const checkStreamAvailability = useCallback(async () => {
    if (!enabled || !participantId || !sessionId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const streamURL = generateStreamURL();
      
      // Test if stream endpoint is available
      const response = await fetch(`${streamURL}/status`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        setState({
          streamURL,
          isLoading: false,
          error: null,
          isConnected: true
        });
      } else {
        throw new Error('Stream not available');
      }
    } catch (error) {
      setState({
        streamURL: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Stream unavailable',
        isConnected: false
      });
    }
  }, [enabled, participantId, sessionId, generateStreamURL]);

  const refreshStream = useCallback(() => {
    checkStreamAvailability();
  }, [checkStreamAvailability]);

  useEffect(() => {
    if (enabled) {
      checkStreamAvailability();
      
      // Check periodically
      const interval = setInterval(checkStreamAvailability, 5000);
      return () => clearInterval(interval);
    }
  }, [enabled, checkStreamAvailability]);

  return {
    ...state,
    refreshStream
  };
};
