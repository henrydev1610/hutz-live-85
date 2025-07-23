
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { forceMobileCamera } from '@/utils/media/mobileMediaDetector';
import { setupVideoElement } from '@/utils/media/videoPlayback';
import { webRTCDebugger } from '@/utils/webrtc/WebRTCDebugger';

interface MobileStableCameraState {
  stream: MediaStream | null;
  isConnected: boolean;
  isStable: boolean;
  connectionAttempts: number;
  lastSuccessTime: number;
  error: string | null;
}

interface MobileStableCameraConfig {
  maxRetries: number;
  retryDelay: number;
  stabilityCheckInterval: number;
  reconnectThreshold: number;
  aggressiveMode: boolean;
}

const DEFAULT_CONFIG: MobileStableCameraConfig = {
  maxRetries: 10,
  retryDelay: 2000,
  stabilityCheckInterval: 2000,
  reconnectThreshold: 5000,
  aggressiveMode: true
};

export const useMobileStableCameraManager = (config: Partial<MobileStableCameraConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const isMobile = detectMobileAggressively();
  
  const [state, setState] = useState<MobileStableCameraState>({
    stream: null,
    isConnected: false,
    isStable: false,
    connectionAttempts: 0,
    lastSuccessTime: 0,
    error: null
  });

  const streamRef = useRef<MediaStream | null>(null);
  const stabilityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Enhanced stream validation for mobile
  const validateStream = useCallback((stream: MediaStream | null): boolean => {
    if (!stream) return false;
    
    const tracks = stream.getTracks();
    const videoTracks = stream.getVideoTracks();
    
    // Check if stream is still active
    const isActive = stream.active && tracks.some(track => 
      track.readyState === 'live' && track.enabled
    );
    
    // Mobile-specific validation
    if (isMobile && videoTracks.length > 0) {
      const videoTrack = videoTracks[0];
      const settings = videoTrack.getSettings();
      
      // Ensure we have valid video dimensions
      const hasValidDimensions = settings.width && settings.height && 
                               settings.width > 0 && settings.height > 0;
      
      // Log validation details
      webRTCDebugger.logEvent(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        'STREAM_VALIDATION',
        {
          isActive,
          hasValidDimensions,
          facingMode: settings.facingMode,
          width: settings.width,
          height: settings.height
        }
      );
      
      return isActive && hasValidDimensions;
    }
    
    return isActive;
  }, [isMobile]);

  // Aggressive mobile camera acquisition with multiple fallbacks
  const acquireMobileCamera = useCallback(async (retryCount = 0): Promise<MediaStream | null> => {
    console.log(`🎯 MOBILE STABLE: Camera acquisition attempt ${retryCount + 1}/${finalConfig.maxRetries}`);
    
    webRTCDebugger.logEvent(
      'stable-camera',
      'mobile-participant',
      false,
      isMobile,
      'STREAM',
      'ACQUISITION_ATTEMPT',
      { retryCount, maxRetries: finalConfig.maxRetries }
    );
    
    if (retryCount >= finalConfig.maxRetries) {
      console.error('❌ MOBILE STABLE: Max acquisition attempts reached');
      webRTCDebugger.logCriticalFailure(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        new Error('Max acquisition attempts reached')
      );
      return null;
    }

    try {
      // Enhanced delay for mobile stability
      if (retryCount > 0) {
        const delay = finalConfig.retryDelay * Math.pow(1.5, retryCount);
        console.log(`⏱️ MOBILE STABLE: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Use forced mobile camera acquisition
      const stream = await forceMobileCamera('user');
      
      if (!validateStream(stream)) {
        console.warn(`⚠️ MOBILE STABLE: Invalid stream on attempt ${retryCount + 1}`);
        throw new Error('Invalid stream acquired');
      }

      console.log(`✅ MOBILE STABLE: Valid camera stream acquired on attempt ${retryCount + 1}`);
      
      webRTCDebugger.logEvent(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        'ACQUISITION_SUCCESS',
        { 
          retryCount,
          streamId: stream?.id,
          videoTracks: stream?.getVideoTracks().length,
          audioTracks: stream?.getAudioTracks().length
        }
      );
      
      return stream;
      
    } catch (error) {
      console.error(`❌ MOBILE STABLE: Attempt ${retryCount + 1} failed:`, error);
      
      webRTCDebugger.logEvent(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        'ACQUISITION_FAILED',
        { 
          retryCount,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      if (retryCount < finalConfig.maxRetries - 1) {
        return acquireMobileCamera(retryCount + 1);
      }
      
      throw error;
    }
  }, [finalConfig.maxRetries, finalConfig.retryDelay, validateStream, isMobile]);

  // Continuous stability monitoring
  const startStabilityMonitoring = useCallback(() => {
    if (stabilityIntervalRef.current) {
      clearInterval(stabilityIntervalRef.current);
    }

    console.log(`🔍 MOBILE STABLE: Starting stability monitoring (${finalConfig.stabilityCheckInterval}ms intervals)`);
    
    stabilityIntervalRef.current = setInterval(() => {
      const currentStream = streamRef.current;
      const isValid = validateStream(currentStream);
      const now = Date.now();
      
      setState(prev => {
        const timeSinceLastSuccess = now - prev.lastSuccessTime;
        const shouldReconnect = !isValid || timeSinceLastSuccess > finalConfig.reconnectThreshold;
        
        if (isValid && !prev.isStable) {
          console.log('✅ MOBILE STABLE: Stream stability confirmed');
          toast.success('📱 Mobile camera stable');
        } else if (!isValid && prev.isStable) {
          console.warn('⚠️ MOBILE STABLE: Stream instability detected');
          toast.warning('📱 Mobile camera unstable - reconnecting...');
        }
        
        if (shouldReconnect && finalConfig.aggressiveMode) {
          console.log('🔄 MOBILE STABLE: Triggering automatic reconnection');
          scheduleReconnect();
        }
        
        return {
          ...prev,
          isStable: isValid,
          isConnected: isValid,
          lastSuccessTime: isValid ? now : prev.lastSuccessTime,
          error: isValid ? null : 'Stream validation failed'
        };
      });
    }, finalConfig.stabilityCheckInterval);
  }, [finalConfig.stabilityCheckInterval, finalConfig.reconnectThreshold, finalConfig.aggressiveMode, validateStream]);

  // Smart reconnection scheduling
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    console.log('⏰ MOBILE STABLE: Scheduling reconnection...');
    
    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('🔄 MOBILE STABLE: Executing scheduled reconnection');
        await initializeStableCamera();
      } catch (error) {
        console.error('❌ MOBILE STABLE: Scheduled reconnection failed:', error);
      }
    }, 1000);
  }, []);

  // Main initialization with comprehensive error handling
  const initializeStableCamera = useCallback(async (): Promise<MediaStream | null> => {
    console.log('🚀 MOBILE STABLE: Initializing stable camera connection');
    
    webRTCDebugger.logEvent(
      'stable-camera',
      'mobile-participant',
      false,
      isMobile,
      'STREAM',
      'INITIALIZATION_START',
      { isMobile }
    );
    
    // Clean up previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 MOBILE STABLE: Stopped ${track.kind} track`);
      });
      streamRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isStable: false,
      connectionAttempts: prev.connectionAttempts + 1,
      error: null
    }));

    try {
      const stream = await acquireMobileCamera();
      
      if (!stream) {
        throw new Error('Failed to acquire stable camera stream');
      }

      streamRef.current = stream;
      
      // Setup video element if provided
      if (videoElementRef.current) {
        await setupVideoElement(videoElementRef.current, stream);
        console.log('📺 MOBILE STABLE: Video element setup completed');
      }

      // Start monitoring
      startStabilityMonitoring();

      const now = Date.now();
      setState(prev => ({
        ...prev,
        stream,
        isConnected: true,
        isStable: true,
        lastSuccessTime: now,
        error: null
      }));

      console.log('✅ MOBILE STABLE: Camera initialization completed successfully');
      toast.success('📱 Mobile camera connected and stable!');
      
      webRTCDebugger.logEvent(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        'INITIALIZATION_SUCCESS',
        { 
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        }
      );
      
      return stream;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ MOBILE STABLE: Initialization failed:', errorMsg);
      
      webRTCDebugger.logCriticalFailure(
        'stable-camera',
        'mobile-participant',
        false,
        isMobile,
        'STREAM',
        error as Error
      );
      
      setState(prev => ({
        ...prev,
        stream: null,
        isConnected: false,
        isStable: false,
        error: errorMsg
      }));

      toast.error(`📱 Mobile camera failed: ${errorMsg}`);
      throw error;
    }
  }, [acquireMobileCamera, startStabilityMonitoring, isMobile]);

  // Force reconnection method
  const forceReconnect = useCallback(async (): Promise<void> => {
    console.log('💪 MOBILE STABLE: Force reconnection requested');
    toast.info('📱 Forcing mobile camera reconnection...');
    
    try {
      await initializeStableCamera();
    } catch (error) {
      console.error('❌ MOBILE STABLE: Force reconnection failed:', error);
      toast.error('📱 Force reconnection failed');
    }
  }, [initializeStableCamera]);

  // Set video element reference
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoElementRef.current = element;
    console.log('📺 MOBILE STABLE: Video element reference set');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 MOBILE STABLE: Cleaning up');
      
      if (stabilityIntervalRef.current) {
        clearInterval(stabilityIntervalRef.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    // State
    stream: state.stream,
    isConnected: state.isConnected,
    isStable: state.isStable,
    connectionAttempts: state.connectionAttempts,
    lastSuccessTime: state.lastSuccessTime,
    error: state.error,
    isMobile,
    
    // Methods
    initializeStableCamera,
    forceReconnect,
    setVideoElement,
    
    // Config
    config: finalConfig
  };
};
