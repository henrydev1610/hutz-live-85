
import { useCallback, useRef, useState } from 'react';

interface MobileStreamBridgeState {
  isRecording: boolean;
  isConnected: boolean;
  error: string | null;
  quality: 'low' | 'medium' | 'high';
}

interface UseMobileStreamBridgeProps {
  sessionId: string;
  participantId: string;
  enabled?: boolean;
}

export const useMobileStreamBridge = ({ sessionId, participantId, enabled = true }: UseMobileStreamBridgeProps) => {
  const [state, setState] = useState<MobileStreamBridgeState>({
    isRecording: false,
    isConnected: false,
    error: null,
    quality: 'medium'
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    if (!enabled) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/stream/${sessionId}/${participantId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log(`🌉 BRIDGE: WebSocket connected for ${participantId}`);
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      };
      
      wsRef.current.onerror = (error) => {
        console.error(`❌ BRIDGE: WebSocket error for ${participantId}:`, error);
        setState(prev => ({ ...prev, error: 'WebSocket connection failed', isConnected: false }));
      };
      
      wsRef.current.onclose = () => {
        console.log(`🔌 BRIDGE: WebSocket closed for ${participantId}`);
        setState(prev => ({ ...prev, isConnected: false }));
      };
      
    } catch (error) {
      console.error(`❌ BRIDGE: Failed to create WebSocket for ${participantId}:`, error);
      setState(prev => ({ ...prev, error: 'Failed to create WebSocket' }));
    }
  }, [sessionId, participantId, enabled]);

  const startStreamBridge = useCallback(async (stream: MediaStream) => {
    if (!enabled || !stream) return;

    try {
      console.log(`🎬 BRIDGE: Starting stream bridge for ${participantId}`);
      
      // Connect WebSocket first
      connectWebSocket();
      
      // Set up MediaRecorder with mobile-optimized settings
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: state.quality === 'low' ? 250000 : state.quality === 'medium' ? 500000 : 1000000
      };

      recorderRef.current = new MediaRecorder(stream, options);
      
      recorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };
      
      recorderRef.current.start(100); // Send data every 100ms
      setState(prev => ({ ...prev, isRecording: true, error: null }));
      
      console.log(`✅ BRIDGE: Recording started for ${participantId}`);
      
    } catch (error) {
      console.error(`❌ BRIDGE: Failed to start recording for ${participantId}:`, error);
      setState(prev => ({ ...prev, error: 'Failed to start recording' }));
    }
  }, [participantId, enabled, state.quality, connectWebSocket]);

  const stopStreamBridge = useCallback(() => {
    console.log(`🛑 BRIDGE: Stopping stream bridge for ${participantId}`);
    
    if (recorderRef.current && state.isRecording) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setState({
      isRecording: false,
      isConnected: false,
      error: null,
      quality: state.quality
    });
  }, [participantId, state.isRecording, state.quality]);

  const setQuality = useCallback((quality: 'low' | 'medium' | 'high') => {
    setState(prev => ({ ...prev, quality }));
  }, []);

  return {
    ...state,
    startStreamBridge,
    stopStreamBridge,
    setQuality
  };
};
