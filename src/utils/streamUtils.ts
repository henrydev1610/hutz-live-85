
import { createLogger } from './loggingUtils';

const logger = createLogger('stream-utils');

/**
 * Analyzes a MediaStream for potential issues
 */
export const analyzeStreamIssues = async (stream: MediaStream): Promise<{
  hasVideoTracks: boolean;
  isActive: boolean;
  issues: string[];
  fixAttempted: boolean;
}> => {
  const result = {
    hasVideoTracks: false,
    isActive: false,
    issues: [] as string[],
    fixAttempted: false
  };

  if (!stream) {
    result.issues.push('Stream is null or undefined');
    return result;
  }

  try {
    // Check if stream has video tracks
    const videoTracks = stream.getVideoTracks();
    result.hasVideoTracks = videoTracks.length > 0;

    if (!result.hasVideoTracks) {
      result.issues.push('No video tracks found in stream');
    }

    // Check if stream is active
    result.isActive = stream.active;
    if (!result.isActive) {
      result.issues.push('Stream is not active');
    }

    // Check video tracks status
    videoTracks.forEach(track => {
      if (track.muted) {
        result.issues.push(`Video track is muted: ${track.id}`);
      }

      if (!track.enabled) {
        result.issues.push(`Video track is not enabled: ${track.id}`);
        // Attempt to fix
        track.enabled = true;
        result.fixAttempted = true;
      }

      if (track.readyState !== 'live') {
        result.issues.push(`Video track is not live: ${track.id} (${track.readyState})`);
      }
    });

    return result;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    result.issues.push(`Error analyzing stream: ${error.message}`);
    logger.error('Error analyzing stream:', error);
    return result;
  }
};

/**
 * Attaches a MediaStream to a video element with proper error handling
 */
export const attachStreamToVideo = async (
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  autoPlay: boolean = true
): Promise<void> => {
  if (!videoElement) {
    throw new Error('Video element is null or undefined');
  }

  if (!stream) {
    throw new Error('Stream is null or undefined');
  }

  try {
    // Modern approach - directly set srcObject
    videoElement.srcObject = stream;
    
    // Set up error handling
    const errorHandler = (error: Event) => {
      logger.error('Video element error:', error);
      // Try to recover
      setTimeout(() => {
        try {
          // Only attempt recovery if the stream is still active
          if (stream.active && videoElement) {
            videoElement.srcObject = stream;
            if (autoPlay) videoElement.play().catch(e => logger.error('Recovery play failed:', e));
          }
        } catch (e) {
          logger.error('Recovery failed:', e);
        }
      }, 2000); // Increased from 1000ms to 2000ms for better recovery chances
    };
    
    // Remove any existing error handlers to prevent duplicates
    videoElement.removeEventListener('error', errorHandler);
    videoElement.addEventListener('error', errorHandler);
    
    if (autoPlay) {
      try {
        // Wait for loadedmetadata before playing - increased timeout to 10000ms (10 seconds)
        if (videoElement.readyState < 2) {
          await new Promise<void>((resolve, reject) => {
            const loadHandler = () => {
              videoElement.removeEventListener('loadedmetadata', loadHandler);
              resolve();
            };
            
            const errorLoadHandler = (err: Event) => {
              videoElement.removeEventListener('error', errorLoadHandler);
              reject(new Error('Video loading error'));
            };
            
            videoElement.addEventListener('loadedmetadata', loadHandler);
            videoElement.addEventListener('error', errorLoadHandler);
            
            // Timeout in case loadedmetadata never fires - increased from 5000ms to 10000ms
            setTimeout(() => {
              videoElement.removeEventListener('loadedmetadata', loadHandler);
              videoElement.removeEventListener('error', errorLoadHandler);
              logger.info('Metadata loading timeout reached, trying to play anyway');
              resolve(); // Resolve anyway to try playing
            }, 10000);
          });
        }
        
        await videoElement.play();
        logger.info('Video playing successfully');
      } catch (playError) {
        logger.error('Error playing video:', playError);
        
        // Try with muted first (browsers often allow autoplay if muted)
        videoElement.muted = true;
        
        try {
          await videoElement.play();
          logger.info('Video playing successfully (muted)');
          
          // Unmute after a longer delay if allowed
          setTimeout(() => {
            try {
              if (videoElement && document.visibilityState === 'visible') {
                videoElement.muted = false;
              }
            } catch (unmuteError) {
              logger.error('Error unmuting video:', unmuteError);
            }
          }, 5000); // Increased from 3000ms to 5000ms
        } catch (mutedPlayError) {
          logger.error('Error playing muted video:', mutedPlayError);
        }
      }
    }
    
    return;
  } catch (error) {
    logger.error('Failed to attach stream to video:', error);
    throw error;
  }
};

/**
 * Keep stream alive by periodically checking and refreshing if needed
 * This helps prevent the black screen issue
 */
export const keepStreamAlive = (
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  intervalMs: number = 5000
): (() => void) => {
  let isRunning = true;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;
  
  // Create a function that checks if the video is still playing properly
  const checkVideoStatus = () => {
    if (!isRunning || !videoElement || !stream) return;
    
    try {
      // Reset error counter on successful checks
      consecutiveErrors = 0;
      
      // Check if video playback is frozen or black screen
      const hasPlaybackIssue = videoElement.readyState < 2 || 
                               videoElement.paused || 
                               !stream.active;
                               
      const hasTrackIssue = stream.getVideoTracks().some(track => 
        !track.enabled || track.muted || track.readyState !== 'live'
      );
      
      if (hasPlaybackIssue || hasTrackIssue) {
        logger.info('Video playback issue detected, attempting recovery');
        
        // Try to get video tracks playing again
        stream.getVideoTracks().forEach(track => {
          if (!track.enabled) {
            track.enabled = true;
            logger.info(`Re-enabled track: ${track.id}`);
          }
        });
        
        // Refresh the connection to the video element only if it's paused
        // or has readyState issues (this avoids unnecessary refreshes)
        if (videoElement.paused || videoElement.readyState < 2) {
          videoElement.play().catch(e => 
            logger.error('Failed to restart playback:', e)
          );
        }
      }
    } catch (e) {
      consecutiveErrors++;
      logger.error(`Error in keepStreamAlive (error ${consecutiveErrors}/${maxConsecutiveErrors}):`, e);
      
      // If we've had multiple consecutive errors, stop checking to avoid crashing
      if (consecutiveErrors >= maxConsecutiveErrors) {
        logger.error('Too many consecutive errors in keepStreamAlive, stopping checks');
        clearInterval(intervalId);
      }
    }
  };

  // Set up periodic check
  const intervalId = window.setInterval(checkVideoStatus, intervalMs);
  
  // Return cleanup function
  return () => {
    isRunning = false;
    window.clearInterval(intervalId);
  };
};
