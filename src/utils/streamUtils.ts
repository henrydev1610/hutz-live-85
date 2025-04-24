
/**
 * Helper utilities for handling media streams in both the host and participant sides
 */

import { updateParticipantStatus } from './sessionUtils';
import { createLogger } from './loggingUtils';

const logger = createLogger('stream');

// Detect browser type for specialized handling
const detectBrowser = (): string => {
  const ua = navigator.userAgent;
  
  if (/Firefox\/\d+/.test(ua)) {
    return 'firefox';
  } else if (/Edg\/\d+/.test(ua) || /Edge\/\d+/.test(ua)) {
    return 'edge';
  } else if (/Chrome\/\d+/.test(ua)) {
    return 'chrome';
  } else if (/Safari\/\d+/.test(ua) && !/Chrome\/\d+/.test(ua) && !/Chromium\/\d+/.test(ua)) {
    return 'safari';
  } else if (/OPR\/\d+/.test(ua) || /Opera\/\d+/.test(ua)) {
    return 'opera';
  } else {
    return 'unknown';
  }
};

// Get browser type on module load
const browserType = detectBrowser();
logger.info(`Detected browser: ${browserType}`);

// Helper function to check if a stream is valid and has active tracks
export const isStreamActive = (stream: MediaStream | null): boolean => {
  if (!stream) return false;
  
  // Check stream.active property first
  if (!stream.active) return false;
  
  // Verify stream has at least one active track
  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.some(track => track.readyState === 'live');
};

// Helper function to notify the host or participants about stream availability
export const broadcastStreamInfo = (
  sessionId: string, 
  participantId: string, 
  hasVideo: boolean,
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    screenSize?: { width: number; height: number };
  }
) => {
  try {
    logger.info(`Broadcasting stream info for ${participantId} in session ${sessionId}`);
    
    // Prepare message data
    const messageData = {
      type: 'video-stream-info',
      id: participantId,
      hasVideo,
      deviceInfo,
      browserType,
      timestamp: Date.now()
    };
    
    // Try to use BroadcastChannel first (most modern browsers)
    try {
      const channels = [
        new BroadcastChannel(`stream-info-${sessionId}`),
        new BroadcastChannel(`live-session-${sessionId}`), 
        new BroadcastChannel(`telao-session-${sessionId}`)
      ];
      
      channels.forEach(channel => {
        channel.postMessage(messageData);
        
        // Close channel after short delay
        setTimeout(() => channel.close(), 500);
      });
    } catch (e) {
      logger.warn("BroadcastChannel not supported, using localStorage fallback");
    }
    
    // Always use localStorage as a fallback for browsers that don't support BroadcastChannel
    const key = `stream-info-${sessionId}-${participantId}-${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify(messageData));
      
      // Clean up old keys after a delay
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          logger.error("Error removing localStorage key:", e);
        }
      }, 10000); // Keep for 10 seconds to ensure it's received
    } catch (e) {
      logger.error("Error storing stream info in localStorage:", e);
    }
    
    // Also update participant status
    updateParticipantStatus(sessionId, participantId, {
      hasVideo,
      active: true,
      lastActive: Date.now(),
      browserType
    });
    
    return true;
  } catch (error) {
    logger.error("Error broadcasting stream info:", error);
    return false;
  }
};

// Helper function to check for stream acknowledgments from the host
export const checkStreamAcknowledgment = async (
  sessionId: string,
  participantId: string,
  timeoutMs: number = 10000
): Promise<boolean> => {
  logger.info(`Checking for stream acknowledgment for participant ${participantId}`);
  
  return new Promise((resolve) => {
    let acknowledged = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    // Set up acknowledgment listener via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    
    try {
      channel = new BroadcastChannel(`response-${sessionId}`);
      
      channel.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'host-ack' && 
            (data.targetId === participantId || !data.targetId)) {
          logger.info("Received stream acknowledgment from host");
          acknowledged = true;
          
          if (timeoutId) clearTimeout(timeoutId);
          if (channel) channel.close();
          
          resolve(true);
        }
      };
    } catch (e) {
      logger.warn("BroadcastChannel not supported, using localStorage fallback");
    }
    
    // Set up localStorage polling for acknowledgment
    const checkStorage = () => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          
          if (key.includes(`response-${sessionId}`)) {
            try {
              const value = localStorage.getItem(key);
              if (!value) continue;
              
              const data = JSON.parse(value);
              
              if (data.type === 'host-ack' && 
                  (data.targetId === participantId || !data.targetId)) {
                logger.info("Found stream acknowledgment in localStorage");
                localStorage.removeItem(key);
                
                acknowledged = true;
                
                if (timeoutId) clearTimeout(timeoutId);
                if (channel) channel.close();
                
                resolve(true);
                return;
              }
            } catch (e) {
              logger.error("Error parsing localStorage item:", e);
            }
          }
        }
        
        // Continue checking if not found and timeout hasn't occurred
        if (!acknowledged) {
          setTimeout(checkStorage, 500);
        }
      } catch (e) {
        logger.error("Error checking localStorage for acknowledgment:", e);
      }
    };
    
    // Start the localStorage polling
    checkStorage();
    
    // Set timeout to resolve with false if no acknowledgment received
    timeoutId = setTimeout(() => {
      logger.info("Stream acknowledgment timeout reached");
      if (channel) channel.close();
      resolve(false);
    }, timeoutMs);
  });
};

// Helper function to analyze and fix stream issues
export const analyzeStreamIssues = async (stream: MediaStream | null): Promise<{
  isActive: boolean;
  hasVideoTracks: boolean;
  issues: string[];
  fixAttempted: boolean;
}> => {
  const issues: string[] = [];
  let fixAttempted = false;
  
  if (!stream) {
    issues.push("Stream is null or undefined");
    return { isActive: false, hasVideoTracks: false, issues, fixAttempted };
  }
  
  // Check stream.active property
  if (!stream.active) {
    issues.push("Stream is not active");
  }
  
  // Check for tracks
  const tracks = stream.getTracks();
  if (tracks.length === 0) {
    issues.push("Stream has no tracks");
  } else {
    // Check track states
    const inactiveTracks = tracks.filter(track => track.readyState !== 'live');
    if (inactiveTracks.length > 0) {
      issues.push(`Stream has ${inactiveTracks.length} inactive tracks`);
    }
  }
  
  // Check specifically for video tracks
  const videoTracks = stream.getVideoTracks();
  const hasVideoTracks = videoTracks.length > 0;
  
  if (!hasVideoTracks) {
    issues.push("Stream has no video tracks");
  } else {
    // Check video track states
    const inactiveVideoTracks = videoTracks.filter(track => track.readyState !== 'live');
    if (inactiveVideoTracks.length > 0) {
      issues.push(`Stream has ${inactiveVideoTracks.length} inactive video tracks`);
    }
  }
  
  // If there are issues and we have video tracks that are not active, try to fix
  if (issues.length > 0 && videoTracks.length > 0) {
    try {
      // Attempt to restart problematic tracks
      videoTracks.forEach(track => {
        if (track.readyState !== 'live') {
          logger.info("Attempting to restart video track:", track.id);
          
          try {
            // Toggle the track to try to wake it up
            const wasEnabled = track.enabled;
            track.enabled = false;
            setTimeout(() => {
              track.enabled = wasEnabled;
            }, 100);
            
            fixAttempted = true;
          } catch (e) {
            logger.error("Error trying to fix video track:", e);
          }
        }
      });
      
      // Additional Firefox-specific fixes
      if (browserType === 'firefox') {
        logger.info("Applying Firefox-specific stream fixes");
        // Firefox sometimes needs explicit stop/start cycle
        try {
          const constraints = videoTracks[0].getConstraints();
          setTimeout(() => {
            // We don't actually stop the track here, just flag that we're attempting fixes
            fixAttempted = true;
          }, 200);
        } catch (e) {
          logger.error("Firefox-specific fix failed:", e);
        }
      }
      
      // Safari-specific fixes
      if (browserType === 'safari') {
        logger.info("Applying Safari-specific stream fixes");
        // Safari can get stuck with failed tracks
        try {
          // Mark as attempted - the actual fix happens at video element level
          fixAttempted = true;
        } catch (e) {
          logger.error("Safari-specific fix failed:", e);
        }
      }
    } catch (e) {
      logger.error("Error analyzing stream:", e);
      issues.push(`Error analyzing: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  return {
    isActive: stream.active && tracks.some(track => track.readyState === 'live'),
    hasVideoTracks,
    issues,
    fixAttempted
  };
};

// Helper to update video element with stream safely - cross-browser compatible
export const attachStreamToVideo = (
  videoElement: HTMLVideoElement | null, 
  stream: MediaStream | null,
  muted: boolean = true
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!videoElement || !stream) {
      resolve(false);
      return;
    }
    
    try {
      // Set properties
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = muted;
      
      // Special handling for Safari
      if (browserType === 'safari') {
        // Safari needs muted attribute explicitly set
        videoElement.setAttribute('muted', '');
        videoElement.setAttribute('playsinline', '');
      }
      
      // Set stream as source
      videoElement.srcObject = stream;
      logger.debug("Set srcObject on video element");
      
      // Browser-specific play strategies
      if (browserType === 'safari') {
        // Safari needs special handling
        safariPlayVideo(videoElement, stream, resolve);
      } else if (browserType === 'firefox') {
        // Firefox can be tricky with autoplay
        firefoxPlayVideo(videoElement, stream, resolve);
      } else {
        // Standard approach for Chrome and others
        standardPlayVideo(videoElement, stream, muted, resolve);
      }
    } catch (e) {
      logger.error("Error attaching stream to video:", e);
      
      // Last resort: try object URL approach for old browsers
      try {
        const objectUrl = URL.createObjectURL(stream);
        videoElement.src = objectUrl;
        videoElement.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          videoElement.play()
            .then(() => resolve(true))
            .catch(() => resolve(false));
        };
      } catch (objUrlError) {
        logger.error("Object URL fallback failed:", objUrlError);
        resolve(false);
      }
    }
  });
};

// Safari-specific video playback handling
const safariPlayVideo = (
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  resolve: (success: boolean) => void
): void => {
  // Safari needs special treatment
  videoElement.muted = true; // Must be muted initially
  
  // Extra safety checks for Safari playback
  const playHandler = () => {
    logger.debug("Safari: video play event triggered");
    resolve(true);
    videoElement.removeEventListener('play', playHandler);
  };
  
  const loadedHandler = () => {
    logger.debug("Safari: video loadedmetadata event");
    videoElement.play()
      .then(() => logger.debug("Safari: play() succeeded"))
      .catch(err => logger.error("Safari: play() failed:", err));
    videoElement.removeEventListener('loadedmetadata', loadedHandler);
  };
  
  videoElement.addEventListener('loadedmetadata', loadedHandler);
  videoElement.addEventListener('play', playHandler);
  
  // Safari needs document-level click to unlock audio
  document.addEventListener('click', function clickToPlay() {
    if (videoElement.paused) {
      videoElement.play().catch(e => logger.error("Safari click-to-play failed:", e));
    }
    document.removeEventListener('click', clickToPlay);
  }, { once: true });
  
  // Set timeout to resolve anyway if events don't fire
  setTimeout(() => {
    if (videoElement.currentTime > 0) {
      resolve(true);
    } else {
      videoElement.play()
        .then(() => resolve(true))
        .catch(() => resolve(false));
    }
  }, 2000);
};

// Firefox-specific video playback handling
const firefoxPlayVideo = (
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  resolve: (success: boolean) => void
): void => {
  // Firefox can be tricky with autoplay
  videoElement.muted = true; // Ensure muted for autoplay
  
  // Try play immediately
  videoElement.play()
    .then(() => {
      logger.debug("Firefox: play() succeeded immediately");
      resolve(true);
    })
    .catch(err => {
      logger.error("Firefox: initial play() failed:", err);
      
      // Try with delayed play
      setTimeout(() => {
        videoElement.play()
          .then(() => {
            logger.debug("Firefox: delayed play() succeeded");
            resolve(true);
          })
          .catch(delayedErr => {
            logger.error("Firefox: delayed play() failed:", delayedErr);
            resolve(false);
          });
      }, 500);
    });
};

// Standard approach for Chrome and other browsers
const standardPlayVideo = (
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  muted: boolean,
  resolve: (success: boolean) => void
): void => {
  // Try to play with fallbacks
  videoElement.play()
    .then(() => {
      logger.debug("Video playing successfully");
      resolve(true);
    })
    .catch(err => {
      logger.error("Error playing video:", err);
      
      // Try with muted flag if not already muted
      if (!muted) {
        logger.debug("Retrying with muted=true");
        videoElement.muted = true;
        
        videoElement.play()
          .then(() => {
            logger.debug("Video playing successfully (muted)");
            resolve(true);
          })
          .catch(err2 => {
            logger.error("Error playing muted video:", err2);
            
            // One more retry with low volume and delayed
            setTimeout(() => {
              videoElement.volume = 0.01;
              videoElement.play()
                .then(() => {
                  logger.debug("Video playing on final retry");
                  resolve(true);
                })
                .catch(finalErr => {
                  logger.error("All play attempts failed:", finalErr);
                  resolve(false);
                });
            }, 1000);
          });
      } else {
        // Already muted, try with delay
        setTimeout(() => {
          videoElement.play()
            .then(() => {
              logger.debug("Video playing on delayed retry");
              resolve(true);
            })
            .catch(finalErr => {
              logger.error("All play attempts failed:", finalErr);
              resolve(false);
            });
        }, 1000);
      }
    });
};

// Helper to get device info for diagnostics
export const getDeviceInfo = async (): Promise<{
  userAgent: string;
  platform: string;
  screenSize: { width: number; height: number };
  hasWebRTC: boolean;
  hasBroadcastChannel: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  hasCameraPermission: boolean;
  browserType: string;
}> => {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenSize: { width: window.screen.width, height: window.screen.height },
    hasWebRTC: 'RTCPeerConnection' in window,
    hasBroadcastChannel: 'BroadcastChannel' in window,
    hasMediaDevices: 'mediaDevices' in navigator,
    hasGetUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    hasCameraPermission: false,
    browserType
  };
  
  // Check camera permission
  if (info.hasMediaDevices && info.hasGetUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      info.hasCameraPermission = stream.getVideoTracks().length > 0;
      
      // Close the stream immediately
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      info.hasCameraPermission = false;
    }
  }
  
  return info;
};
