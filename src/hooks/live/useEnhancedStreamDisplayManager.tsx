// ENHANCED STREAM DISPLAY MANAGER WITH COMPLETE PIPELINE IMPLEMENTATION
import { useCallback, useEffect, useRef } from 'react';
import { videoRenderingCentralizer } from '@/utils/webrtc/VideoRenderingCentralizer';

// FASE 1: ENHANCED DEBUGGING AND INSTRUMENTATION
interface StreamDisplayJob {
  participantId: string;
  stream: MediaStream;
  attemptCount: number;
  timestamp: number;
  correlationId: string;
}

interface QueueMetrics {
  activeJobs: number;
  queuedJobs: number;
  processingJobs: number;
  totalProcessed: number;
  lastProcessingTime: number;
}

const RETRY_DELAYS = [200, 400, 800, 1600, 3200]; // ms
const MAX_RETRY_ATTEMPTS = 5;

// UNIFIED CONTAINER RESOLVER - SINGLE SOURCE OF TRUTH
function getParticipantContainer(participantId: string): HTMLElement | null {
  const containerId = `unified-video-container-${CSS.escape(participantId)}`;
  const element = document.getElementById(containerId);
  
  if (element) {
    console.log(`✅ UNIFIED-RESOLVER: Found container for ${participantId}`);
    return element;
  }
  
  console.warn(`❌ UNIFIED-RESOLVER: No container found for ${participantId}`);
  return null;
}

export const useEnhancedStreamDisplayManager = () => {
  const activeStreamCreations = useRef(new Set<string>());
  const pendingRequests = useRef(new Map<string, MediaStream>());
  const processingQueue = useRef<Map<string, StreamDisplayJob>>(new Map());
  const queueMetrics = useRef<QueueMetrics>({
    activeJobs: 0,
    queuedJobs: 0,
    processingJobs: 0,
    totalProcessed: 0,
    lastProcessingTime: 0
  });
  const retryTimeouts = useRef(new Map<string, NodeJS.Timeout>());

  useEffect(() => {
    // Register as authorized renderer
    videoRenderingCentralizer.registerRenderingSource('StreamDisplayManager');
    
    return () => {
      videoRenderingCentralizer.unregisterRenderingSource('StreamDisplayManager');
    };
  }, []);

  // FASE 1: ENHANCED EVENT HANDLING WITH DETAILED LOGGING
  useEffect(() => {
    console.log('🔧 ENHANCED-STREAM-DISPLAY-MANAGER: Initializing with complete pipeline');
    
    const handleParticipantStreamConnected = (event: CustomEvent) => {
      const { participantId, stream, correlationId, source, timestamp } = event.detail;
      const finalCorrelationId = correlationId || `connected-${participantId}-${Date.now()}`;
      
      console.log(`🔗 [${finalCorrelationId}] ENHANCED: participant-stream-connected event:`, {
        participantId,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length,
        source: source || 'unknown',
        timestamp: timestamp || Date.now()
      });
      
      if (stream && stream.getVideoTracks().length > 0) {
        enqueueStreamJob(participantId, stream, finalCorrelationId);
      }
    };

    const handleEnhancedStreamReady = (event: CustomEvent) => {
      const { participantId, stream, correlationId, source, timestamp } = event.detail;
      
      console.log(`🌊 [${correlationId}] ENHANCED: enhanced-stream-ready event:`, {
        participantId,
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length,
        source,
        timestamp
      });
      
      if (stream && stream.getVideoTracks().length > 0) {
        enqueueStreamJob(participantId, stream, correlationId);
      }
    };

    const handleTransmissionReady = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log(`📡 ENHANCED: transmission-ready for ${participantId}, processing queue`);
      processQueue();
    };

    // Listen for all relevant stream events
    window.addEventListener('participant-stream-connected', handleParticipantStreamConnected as EventListener);
    window.addEventListener('enhanced-stream-ready', handleEnhancedStreamReady as EventListener);
    window.addEventListener('transmission-ready', handleTransmissionReady as EventListener);

    // Enhanced heartbeat with metrics
    const heartbeatInterval = setInterval(() => {
      const metrics = queueMetrics.current;
      console.log('💓 ENHANCED-STREAM-DISPLAY-MANAGER: Heartbeat', {
        metrics,
        queue: Array.from(processingQueue.current.entries()).map(([id, job]) => ({
          participantId: id,
          attempts: job.attemptCount,
          age: Date.now() - job.timestamp,
          correlationId: job.correlationId
        })),
        activeCreations: Array.from(activeStreamCreations.current),
        pendingRequests: Array.from(pendingRequests.current.keys())
      });
    }, 15000);

    // Enhanced global debug functions
    (window as any).__enhancedStreamDisplayDebug = {
      getState: () => ({
        metrics: queueMetrics.current,
        pendingRequests: Array.from(pendingRequests.current.entries()).map(([id, stream]) => ({
          participantId: id,
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length
        })),
        activeCreations: Array.from(activeStreamCreations.current),
        processingQueue: Array.from(processingQueue.current.entries()).map(([id, job]) => ({
          participantId: id,
          attempts: job.attemptCount,
          correlationId: job.correlationId,
          age: Date.now() - job.timestamp
        }))
      }),
      getMetrics: () => queueMetrics.current,
      forceProcess: (participantId?: string) => {
        if (participantId) {
          console.log('🔧 ENHANCED: Manually triggering process for:', participantId);
          const job = processingQueue.current.get(participantId);
          if (job) {
            processStreamJob(job);
          } else {
            console.warn('🔧 ENHANCED: No job found for:', participantId);
          }
        } else {
          console.log('🔧 ENHANCED: Processing entire queue');
          processQueue();
        }
      },
      clearQueue: () => {
        console.log('🧹 ENHANCED: Clearing all queues and metrics');
        pendingRequests.current.clear();
        activeStreamCreations.current.clear();
        processingQueue.current.clear();
        retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
        retryTimeouts.current.clear();
        queueMetrics.current = {
          activeJobs: 0,
          queuedJobs: 0,
          processingJobs: 0,
          totalProcessed: 0,
          lastProcessingTime: 0
        };
      },
      testContainerAvailability: (participantId: string) => {
        const container = getParticipantContainer(participantId);
        console.log(`🧪 ENHANCED: Container test participant-${participantId}`, {
          exists: !!container,
          containerId: container?.id,
          className: container?.className,
          childCount: container?.children.length
        });
        return !!container;
      }
    };

    return () => {
      window.removeEventListener('participant-stream-connected', handleParticipantStreamConnected as EventListener);
      window.removeEventListener('enhanced-stream-ready', handleEnhancedStreamReady as EventListener);
      window.removeEventListener('transmission-ready', handleTransmissionReady as EventListener);
      clearInterval(heartbeatInterval);
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
      delete (window as any).__enhancedStreamDisplayDebug;
    };
  }, []);

  // FASE 1: ENHANCED QUEUE OPERATIONS WITH CORRELATION IDS
  const enqueueStreamJob = useCallback((participantId: string, stream: MediaStream, correlationId: string) => {
    console.log(`📥 [${correlationId}] ENHANCED-ENQUEUE: Adding stream job for ${participantId}`);
    
    // Cancel existing retry if any
    const existingTimeout = retryTimeouts.current.get(participantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      retryTimeouts.current.delete(participantId);
    }
    
    const job: StreamDisplayJob = {
      participantId,
      stream,
      attemptCount: 0,
      timestamp: Date.now(),
      correlationId
    };
    
    processingQueue.current.set(participantId, job);
    queueMetrics.current.queuedJobs = processingQueue.current.size;
    
    console.log(`📥 [${correlationId}] ENHANCED-ENQUEUE: Job added`, {
      participantId,
      queueSize: processingQueue.current.size,
      streamId: stream.id,
      videoTracks: stream.getVideoTracks().length
    });
    
    // Immediate processing attempt
    processQueue();
  }, []);

  // FASE 1: ENHANCED QUEUE PROCESSING WITH METRICS
  const processQueue = useCallback(() => {
    const startTime = Date.now();
    console.log('🔄 ENHANCED-QUEUE: Starting enhanced queue processing', {
      queueSize: processingQueue.current.size,
      activeCreations: activeStreamCreations.current.size
    });
    
    if (processingQueue.current.size === 0) {
      console.log('🔄 ENHANCED-QUEUE: Queue is empty');
      return;
    }
    
    // Find next job that's not already being processed
    const availableJob = Array.from(processingQueue.current.values())
      .find(job => !activeStreamCreations.current.has(job.participantId));
    
    if (!availableJob) {
      console.log('🔄 ENHANCED-QUEUE: All jobs currently being processed');
      return;
    }
    
    console.log(`🔄 [${availableJob.correlationId}] ENHANCED-QUEUE: Processing job for ${availableJob.participantId}`);
    
    // Update metrics
    queueMetrics.current.processingJobs++;
    queueMetrics.current.lastProcessingTime = Date.now();
    
    processStreamJob(availableJob);
    
    const duration = Date.now() - startTime;
    console.log(`🔄 ENHANCED-QUEUE: Completed in ${duration}ms`);
  }, []);

  // FASE 1: INDIVIDUAL JOB PROCESSING WITH RETRY LOGIC
  const processStreamJob = useCallback(async (job: StreamDisplayJob) => {
    const { participantId, stream, attemptCount, correlationId } = job;
    
    console.log(`🎯 [${correlationId}] ENHANCED-JOB: Attempt ${attemptCount + 1}/${MAX_RETRY_ATTEMPTS} for ${participantId}`);
    
    // Check container availability with tolerant resolver
    const container = getParticipantContainer(participantId);
    
    console.log(`📦 [${correlationId}] ENHANCED-CONTAINER: participant-${participantId}`, {
      exists: !!container,
      ready: container?.offsetParent !== null,
      containerId: container?.id,
      className: container?.className,
      childCount: container?.children.length,
      attempt: attemptCount + 1
    });
    
    if (!container) {
      if (attemptCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[attemptCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`⏰ [${correlationId}] ENHANCED-RETRY: Container not found, retrying in ${delay}ms (attempt ${attemptCount + 1})`);
        
        const updatedJob = { ...job, attemptCount: attemptCount + 1 };
        processingQueue.current.set(participantId, updatedJob);
        
        const timeout = setTimeout(() => {
          retryTimeouts.current.delete(participantId);
          processStreamJob(updatedJob);
        }, delay);
        
        retryTimeouts.current.set(participantId, timeout);
        return;
      } else {
        console.error(`❌ [${correlationId}] ENHANCED-FAILED: Container not found after ${MAX_RETRY_ATTEMPTS} attempts`);
        processingQueue.current.delete(participantId);
        queueMetrics.current.processingJobs--;
        return;
      }
    }
    
    // Process video creation
    try {
      activeStreamCreations.current.add(participantId);
      const success = await createVideoForParticipant(participantId, stream, correlationId);
      
      if (success) {
        console.log(`✅ [${correlationId}] ENHANCED-SUCCESS: Video created for ${participantId}`);
        processingQueue.current.delete(participantId);
        queueMetrics.current.totalProcessed++;
        queueMetrics.current.processingJobs--;
      } else {
        throw new Error('Video creation failed');
      }
    } catch (error) {
      console.error(`❌ [${correlationId}] ENHANCED-ERROR: Video creation failed for ${participantId}:`, error);
      
      if (attemptCount < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAYS[attemptCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        console.log(`⏰ [${correlationId}] ENHANCED-RETRY: Retrying video creation in ${delay}ms`);
        
        const updatedJob = { ...job, attemptCount: attemptCount + 1 };
        processingQueue.current.set(participantId, updatedJob);
        
        const timeout = setTimeout(() => {
          retryTimeouts.current.delete(participantId);
          processStreamJob(updatedJob);
        }, delay);
        
        retryTimeouts.current.set(participantId, timeout);
      } else {
        console.error(`❌ [${correlationId}] ENHANCED-FAILED: Video creation failed after ${MAX_RETRY_ATTEMPTS} attempts`);
        processingQueue.current.delete(participantId);
        queueMetrics.current.processingJobs--;
      }
    } finally {
      activeStreamCreations.current.delete(participantId);
    }
  }, []);

  // FASE 2: ENHANCED VIDEO CREATION WITH STANDARDIZED IDS AND DETAILED LOGGING
  const createVideoForParticipant = useCallback(async (participantId: string, stream: MediaStream, correlationId?: string): Promise<boolean> => {
    if (!videoRenderingCentralizer.isAuthorizedToRender('StreamDisplayManager')) {
      console.error('❌ ENHANCED: Unauthorized video rendering attempt');
      videoRenderingCentralizer.reportUnauthorizedRender('StreamDisplayManager', participantId);
      return false;
    }

    const logPrefix = correlationId ? `[${correlationId}]` : '';
    
    console.log(`🎥 ${logPrefix} ENHANCED-VIDEO: Starting video creation for ${participantId}`, {
      streamId: stream.id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      correlationId
    });

    try {
      // FASE 2: TOLERANT CONTAINER DISCOVERY  
      const container = getParticipantContainer(participantId);
      const unifiedVideoId = `unified-video-${participantId}`;
      
      if (!container) {
        console.error(`❌ ${logPrefix} ENHANCED-VIDEO: Container not found for ${participantId}`);
        return false;
      }

      console.log(`📦 ${logPrefix} ENHANCED-VIDEO: Container found for ${participantId}`, {
        id: container.id,
        className: container.className,
        childCount: container.children.length,
        offsetParent: !!container.offsetParent,
        isVisible: container.offsetWidth > 0 && container.offsetHeight > 0
      });

      // UNIFIED SYSTEM: Video is already created by VideoContainer component
      // Just verify the video element exists and is properly configured
      const videoElement = container.querySelector('video') as HTMLVideoElement;
      
      if (!videoElement) {
        console.error(`❌ ${logPrefix} UNIFIED-VIDEO: No video element found in container for ${participantId}`);
        return false;
      }

      console.log(`✅ ${logPrefix} UNIFIED-VIDEO: Using existing video element for ${participantId}`, {
        videoId: videoElement.id,
        hasStream: !!videoElement.srcObject,
        streamMatches: videoElement.srcObject === stream
      });

      // 🚨 FASE 1: FORCE UNMUTE ALL TRACKS BEFORE RENDERING
      console.log(`🔍 FASE1 ${logPrefix} ENHANCED-VIDEO: Validating stream tracks`, {
        videoTracks: stream.getVideoTracks().map(t => ({
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        }))
      });

      let unmutedTracks = 0;
      stream.getVideoTracks().forEach((track, index) => {
        if (!track.enabled || track.muted) {
          console.log(`🔧 FASE1 ${logPrefix} Force unmute track ${index}`, {
            trackId: track.id,
            wasEnabled: track.enabled,
            wasMuted: track.muted
          });
          track.enabled = true;
          unmutedTracks++;
        }
        
        // Add protective listeners
        track.onmute = () => {
          console.warn(`⚠️ FASE1 ${logPrefix} Track ${track.id} muted during playback! Re-enabling...`);
          track.enabled = true;
        };
        
        track.onunmute = () => {
          console.log(`✅ FASE1 ${logPrefix} Track ${track.id} unmuted event`);
        };
      });

      if (unmutedTracks > 0) {
        console.log(`✅ FASE1 ${logPrefix} Unmuted ${unmutedTracks} tracks`);
      }

      // If stream is already assigned and playing, no need to do anything
      if (videoElement.srcObject === stream && !videoElement.paused) {
        console.log(`✅ ${logPrefix} UNIFIED-VIDEO: Video already playing for ${participantId}`);
        return true;
      }

      // FASE 2: ENHANCED PLAY ATTEMPT WITH RETRIES
      let playAttempts = 0;
      const maxPlayAttempts = 5;
      
      const attemptPlay = async (): Promise<boolean> => {
        try {
          playAttempts++;
          const playAttemptTime = Date.now();
          
          console.log(`▶️ ${logPrefix} ENHANCED-VIDEO: Play attempt ${playAttempts}/${maxPlayAttempts}`, {
            participantId,
            readyState: videoElement.readyState,
            networkState: videoElement.networkState,
            currentTime: videoElement.currentTime,
            playAttempt: playAttempts
          });
          
          await videoElement.play();
          
          const playSuccessTime = Date.now();
          console.log(`✅ ${logPrefix} ENHANCED-VIDEO: Video playing successfully`, {
            participantId,
            currentTime: videoElement.currentTime,
            readyState: videoElement.readyState,
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            playDuration: playSuccessTime - playAttemptTime
          });

          // FASE 1: DISPATCH SUCCESS EVENT WITH CORRELATION
          window.dispatchEvent(new CustomEvent('video-display-ready', {
            detail: { 
              participantId, 
              success: true,
              videoElement: videoElement,
              container: container,
              stream: stream,
              correlationId,
              metrics: {
                totalAttempts: playAttempts,
                setupDuration: playSuccessTime - playAttemptTime
              }
            }
          }));

          return true;
        } catch (error) {
          console.warn(`⚠️ ${logPrefix} ENHANCED-VIDEO: Play attempt ${playAttempts} failed:`, {
            participantId,
            error: error.message,
            readyState: videoElement.readyState,
            networkState: videoElement.networkState
          });
          
          if (playAttempts < maxPlayAttempts) {
            const delay = 200 * playAttempts; // Progressive delay
            console.log(`⏰ ${logPrefix} ENHANCED-VIDEO: Retrying play in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptPlay();
          } else {
            console.error(`❌ ${logPrefix} ENHANCED-VIDEO: All play attempts exhausted for ${participantId}`);
            
            // FASE 1: DISPATCH FAILURE EVENT WITH CORRELATION
            window.dispatchEvent(new CustomEvent('video-display-error', {
              detail: { 
                participantId, 
                success: false,
                error: error.message,
                videoElement: videoElement,
                container: container,
                stream: stream,
                correlationId,
                metrics: {
                  totalAttempts: playAttempts,
                  finalError: error.message
                }
              }
            }));
            window.dispatchEvent(new CustomEvent('video-display-ready', {
              detail: { 
                participantId, 
                 success: false, 
                 error: `Play failed after ${maxPlayAttempts} attempts: ${error.message}`,
                 videoElement: videoElement,
                container: container,
                correlationId,
                metrics: {
                  totalAttempts: playAttempts,
                  lastError: error.message
                }
              }
            }));
            
            return false;
          }
        }
      };

      const playSuccess = await attemptPlay();
      
      if (playSuccess) {
        console.log(`🎉 ${logPrefix} ENHANCED-VIDEO: Successfully completed video creation pipeline for ${participantId}`);
        pendingRequests.current.set(participantId, stream);
        return true;
      } else {
        console.error(`❌ ${logPrefix} ENHANCED-VIDEO: Video creation pipeline failed for ${participantId}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ ${logPrefix} ENHANCED-VIDEO: Exception in video creation pipeline:`, {
        participantId,
        error: error.message,
        stack: error.stack
      });
      
      // FASE 1: DISPATCH EXCEPTION EVENT
      window.dispatchEvent(new CustomEvent('video-display-ready', {
        detail: { 
          participantId, 
          success: false, 
          error: `Video creation exception: ${error.message}`,
          correlationId
        }
      }));
      
      return false;
    }
  }, []);

  // FASE 1: LEGACY COMPATIBILITY WRAPPER
  const addToQueue = useCallback((participantId: string, stream: MediaStream) => {
    const correlationId = `legacy-${participantId}-${Date.now()}`;
    console.log(`➕ ENHANCED: Legacy addToQueue call for ${participantId} - converting to enhanced job`);
    enqueueStreamJob(participantId, stream, correlationId);
  }, [enqueueStreamJob]);

  return {
    addToQueue,
    processQueue,
    createVideoForParticipant,
    enqueueStreamJob,
    getQueueStatus: () => ({
      pendingRequests: pendingRequests.current.size,
      activeCreations: activeStreamCreations.current.size,
      queueSize: processingQueue.current.size,
      metrics: queueMetrics.current
    }),
    // FASE 1: ENHANCED DEBUG ACCESS
    getEnhancedStatus: () => ({
      metrics: queueMetrics.current,
      activeJobs: Array.from(activeStreamCreations.current),
      queuedJobs: Array.from(processingQueue.current.entries()).map(([id, job]) => ({
        participantId: id,
        attempts: job.attemptCount,
        correlationId: job.correlationId,
        age: Date.now() - job.timestamp
      })),
      pendingStreams: Array.from(pendingRequests.current.entries()).map(([id, stream]) => ({
        participantId: id,
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length
      }))
    })
  };
};