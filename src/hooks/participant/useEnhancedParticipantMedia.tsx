// Enhanced participant media hook with FASE 1-4 integration
import { useCallback, useRef } from 'react';
import { useMediaState } from './useMediaState';
import { useMediaControls } from './useMediaControls';
import { useStreamMutex } from './useStreamMutex';
import { useTrackHealthMonitor } from './useTrackHealthMonitor';
import { detectMobileAggressively } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';
import { streamLogger } from '@/utils/debug/StreamLogger';
import { toast } from 'sonner';

// FASE 1-4 Imports
import { MutedTrackHandler } from '@/utils/media/MutedTrackHandler';
import { EnhancedStreamValidation } from '@/utils/media/EnhancedStreamValidation';
import { MobileBrowserCompatibility } from '@/utils/media/MobileBrowserCompatibility';
import { IntelligentTrackManager } from '@/utils/webrtc/IntelligentTrackManager';

interface EnhancedMediaInitializationResult {
  success: boolean;
  stream: MediaStream | null;
  hadMutedTracks: boolean;
  browserCompatibility: any;
  validationResult: any;
  trackManagementResults: any[];
}

export const useEnhancedParticipantMedia = (participantId: string) => {
  const mediaState = useMediaState();
  const controls = useMediaControls({
    localStreamRef: mediaState.localStreamRef,
    screenStreamRef: mediaState.screenStreamRef,
    localVideoRef: mediaState.localVideoRef,
    isVideoEnabled: mediaState.isVideoEnabled,
    isAudioEnabled: mediaState.isAudioEnabled,
    hasScreenShare: mediaState.hasScreenShare,
    setIsVideoEnabled: mediaState.setIsVideoEnabled,
    setIsAudioEnabled: mediaState.setIsAudioEnabled,
    setHasScreenShare: mediaState.setHasScreenShare
  });

    const mutex = useStreamMutex(participantId);
  
  // FASE 1-4: Enhanced refs
  const mutedTrackHandlerRef = useRef<MutedTrackHandler | null>(null);
  const trackManagerRef = useRef<IntelligentTrackManager | null>(null);
  const browserCompatibilityRef = useRef<any>(null);

  const healthMonitor = useTrackHealthMonitor(
  participantId,
  mediaState.localStreamRef.current,
  (status) => {
    console.log(`📊 FASE 1-4: Track health changed for ${participantId}:`, status);
  },
  async (track) => {
    console.warn(`🔇 FASE 1-4: Track muted detected: ${track.id}`);
    if (mutedTrackHandlerRef.current) {
      await mutedTrackHandlerRef.current.handleMutedTrack(track, participantId);
    }
  },
  (track) => {
    console.error(`🔚 FASE 1-4: Track ended: ${track.id}`);
    toast.error(`📹 ${track.kind === 'video' ? 'Vídeo' : 'Áudio'} foi interrompido`);
  }
);


  // FASE 1-4: Enhanced media initialization
  const initializeEnhancedMedia = useCallback(async (): Promise<EnhancedMediaInitializationResult> => {
    if (!mutex.isOperationAllowed('initialize-enhanced-media')) {
      console.warn(`🚫 FASE 1-4: Cannot initialize - blocked by ${mutex.currentOperation}`);
      toast.warning('Media initialization blocked');
      return {
        success: false,
        stream: null,
        hadMutedTracks: false,
        browserCompatibility: null,
        validationResult: null,
        trackManagementResults: []
      };
    }

    return await mutex.withMutexLock('initialize-enhanced-media', async () => {
      const isMobile = detectMobileAggressively();
      const deviceType = isMobile ? 'mobile' : 'desktop';

      try {
        console.log(`🚀 FASE 1-4: Starting enhanced ${deviceType} camera initialization`);

        // FASE 3: Browser compatibility detection and workarounds
        const browserInfo = MobileBrowserCompatibility.detectBrowser();
        browserCompatibilityRef.current = browserInfo;
        
        console.log(`🌐 FASE 3: Detected browser:`, browserInfo);
        
        // Apply pre-stream workarounds
        const preWorkaroundsSuccess = await MobileBrowserCompatibility.applyPreStreamWorkarounds(browserInfo, participantId);
        if (!preWorkaroundsSuccess) {
          console.warn('⚠️ FASE 3: Pre-stream workarounds failed, continuing anyway');
        }

        // Check media support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          const error = new Error('getUserMedia not supported');
          streamLogger.logStreamError(participantId, isMobile, deviceType, error, 0);
          throw error;
        }

        // FASE 1: Initialize muted track handler
        mutedTrackHandlerRef.current = new MutedTrackHandler();
        
        // FASE 4: Initialize intelligent track manager
        trackManagerRef.current = new IntelligentTrackManager();

        // Get user media with enhanced constraints
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: isMobile ? { ideal: 'environment' } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        };

        console.log(`📹 FASE 1-4: Requesting getUserMedia with constraints:`, constraints);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!stream) {
          throw new Error('No stream obtained from getUserMedia');
        }

        console.log(`✅ FASE 1-4: Raw stream obtained:`, {
          streamId: stream.id,
          tracks: stream.getTracks().length,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length
        });

        // FASE 3: Apply post-stream workarounds
        const compatibleStream = await MobileBrowserCompatibility.applyPostStreamWorkarounds(stream, browserInfo, participantId);

        // FASE 1: Handle muted tracks
        const trackManagementResults = [];
        let hadMutedTracks = false;

        for (const track of compatibleStream.getTracks()) {
          if (track.muted) {
            hadMutedTracks = true;
            console.log(`🔇 FASE 1: Handling muted ${track.kind} track: ${track.id}`);
          }
          
          const result = await mutedTrackHandlerRef.current!.handleMutedTrack(track, participantId);
          trackManagementResults.push({
            trackId: track.id,
            kind: track.kind,
            wasMuted: result.wasMuted,
            success: result.success
          });
        }

        // FASE 2: Enhanced stream validation
        const validationResult = EnhancedStreamValidation.validateStreamForWebRTC(compatibleStream, participantId);
        
        console.log(`🔍 FASE 2: Enhanced validation result:`, {
          isValid: validationResult.isValid,
          canProceedToWebRTC: validationResult.canProceedToWebRTC,
          summary: validationResult.summary
        });

        if (!EnhancedStreamValidation.canProceedWithWebRTC(validationResult)) {
          throw new Error('Stream validation failed - cannot proceed to WebRTC');
        }

        // Create WebRTC-compatible stream if needed
        let finalStream = compatibleStream;
        if (validationResult.mutedButValidTracks.length > 0 || validationResult.invalidTracks.length > 0) {
          const webrtcStream = EnhancedStreamValidation.createWebRTCCompatibleStream(compatibleStream, validationResult);
          if (webrtcStream) {
            finalStream = webrtcStream;
            console.log(`🔄 FASE 2: Created WebRTC-compatible stream: ${finalStream.id}`);
          }
        }

        // Update media state
        mediaState.localStreamRef.current = finalStream;
        mediaState.setHasVideo(finalStream.getVideoTracks().length > 0);
        mediaState.setHasAudio(finalStream.getAudioTracks().length > 0);

        // Setup video element if available
        if (mediaState.localVideoRef.current && finalStream.getVideoTracks().length > 0) {
          mediaState.localVideoRef.current.srcObject = finalStream;
          try {
            await mediaState.localVideoRef.current.play();
            console.log(`✅ FASE 1-4: Video element playing successfully`);
          } catch (playError) {
            console.warn(`⚠️ FASE 1-4: Video play failed:`, playError);
          }
        }

        // Start health monitoring
        healthMonitor.startMonitoring(3000);

        // Make stream globally available
        (window as any).__participantSharedStream = finalStream;

        // Log successful initialization
        streamLogger.logStreamSuccess(participantId, isMobile, deviceType, finalStream, 0);
        
        const successMessage = hadMutedTracks 
          ? `📱 Câmera iniciada (${validationResult.summary.mutedButValid} tracks recuperados)`
          : '📱 Câmera iniciada com sucesso';
        
        toast.success(successMessage);

        console.log(`✅ FASE 1-4: Enhanced media initialization completed successfully`);

        return {
          success: true,
          stream: finalStream,
          hadMutedTracks,
          browserCompatibility: browserInfo,
          validationResult,
          trackManagementResults
        };

      } catch (error) {
        console.error(`❌ FASE 1-4: Enhanced media initialization failed:`, error);
        streamLogger.logStreamError(participantId, isMobile, deviceType, error as Error, 0);
        
        // Cleanup on failure
        if (mutedTrackHandlerRef.current) {
          mutedTrackHandlerRef.current.destroy();
          mutedTrackHandlerRef.current = null;
        }
        
        if (trackManagerRef.current) {
          trackManagerRef.current.cleanup();
          trackManagerRef.current = null;
        }

        toast.error('❌ Falha ao inicializar câmera');

        return {
          success: false,
          stream: null,
          hadMutedTracks: false,
          browserCompatibility: browserCompatibilityRef.current,
          validationResult: null,
          trackManagementResults: []
        };
      }
    });
  }, [participantId, mutex, mediaState, healthMonitor]);

  // Cleanup enhanced resources
  const cleanupEnhanced = useCallback(() => {
    console.log('🧹 FASE 1-4: Cleaning up enhanced media resources');
    
    if (mutedTrackHandlerRef.current) {
      mutedTrackHandlerRef.current.destroy();
      mutedTrackHandlerRef.current = null;
    }
    
    if (trackManagerRef.current) {
      trackManagerRef.current.cleanup();
      trackManagerRef.current = null;
    }
    
    healthMonitor.stopMonitoring();
    controls.cleanup();
  }, [healthMonitor, controls]);

  return {
    // Media state
    ...mediaState,
    
    // Enhanced initialization
    initializeEnhancedMedia,
    
    // Controls
    ...controls,
    
    // Health monitoring
    ...healthMonitor,
    
    // Mutex operations
    isStreamOperationAllowed: mutex.isOperationAllowed,
    currentStreamOperation: mutex.currentOperation,
    
    // Enhanced status
    mutedTrackHandler: mutedTrackHandlerRef.current,
    trackManager: trackManagerRef.current,
    browserCompatibility: browserCompatibilityRef.current,
    
    // Cleanup
    cleanupEnhanced
  };
};