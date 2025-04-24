
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
          videoElement.srcObject = stream;
          if (autoPlay) videoElement.play().catch(e => logger.error('Recovery play failed:', e));
        } catch (e) {
          logger.error('Recovery failed:', e);
        }
      }, 1000);
    };
    
    videoElement.addEventListener('error', errorHandler);
    
    if (autoPlay) {
      try {
        // Wait for loadedmetadata before playing
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
            
            // Timeout in case loadedmetadata never fires
            setTimeout(() => {
              videoElement.removeEventListener('loadedmetadata', loadHandler);
              videoElement.removeEventListener('error', errorLoadHandler);
              resolve(); // Resolve anyway to try playing
            }, 2000);
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
          
          // Unmute after a short delay if allowed
          setTimeout(() => {
            try {
              videoElement.muted = false;
            } catch (unmuteError) {
              logger.error('Error unmuting video:', unmuteError);
            }
          }, 1000);
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
