
/**
 * Helper utilities for handling media streams in both the host and participant sides
 */

import { updateParticipantStatus } from './sessionUtils';

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
    console.log(`Broadcasting stream info for ${participantId} in session ${sessionId}`);
    
    // Try to use BroadcastChannel first (most modern browsers)
    try {
      const channels = [
        new BroadcastChannel(`stream-info-${sessionId}`),
        new BroadcastChannel(`live-session-${sessionId}`), 
        new BroadcastChannel(`telao-session-${sessionId}`)
      ];
      
      channels.forEach(channel => {
        channel.postMessage({
          type: 'video-stream-info',
          id: participantId,
          hasVideo,
          deviceInfo,
          timestamp: Date.now()
        });
        
        // Close channel after short delay
        setTimeout(() => channel.close(), 500);
      });
    } catch (e) {
      console.warn("BroadcastChannel not supported, using localStorage fallback");
    }
    
    // Always use localStorage as a fallback for browsers that don't support BroadcastChannel
    const key = `stream-info-${sessionId}-${participantId}-${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify({
        type: 'video-stream-info',
        id: participantId,
        hasVideo,
        deviceInfo,
        timestamp: Date.now()
      }));
      
      // Clean up old keys after a delay
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error("Error removing localStorage key:", e);
        }
      }, 10000); // Keep for 10 seconds to ensure it's received
    } catch (e) {
      console.error("Error storing stream info in localStorage:", e);
    }
    
    // Also update participant status
    updateParticipantStatus(sessionId, participantId, {
      hasVideo,
      active: true,
      lastActive: Date.now()
    });
    
    return true;
  } catch (error) {
    console.error("Error broadcasting stream info:", error);
    return false;
  }
};

// Helper function to check for stream acknowledgments from the host
export const checkStreamAcknowledgment = async (
  sessionId: string,
  participantId: string,
  timeoutMs: number = 10000
): Promise<boolean> => {
  console.log(`Checking for stream acknowledgment for participant ${participantId}`);
  
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
          console.log("Received stream acknowledgment from host");
          acknowledged = true;
          
          if (timeoutId) clearTimeout(timeoutId);
          if (channel) channel.close();
          
          resolve(true);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported, using localStorage fallback");
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
                console.log("Found stream acknowledgment in localStorage");
                localStorage.removeItem(key);
                
                acknowledged = true;
                
                if (timeoutId) clearTimeout(timeoutId);
                if (channel) channel.close();
                
                resolve(true);
                return;
              }
            } catch (e) {
              console.error("Error parsing localStorage item:", e);
            }
          }
        }
        
        // Continue checking if not found and timeout hasn't occurred
        if (!acknowledged) {
          setTimeout(checkStorage, 500);
        }
      } catch (e) {
        console.error("Error checking localStorage for acknowledgment:", e);
      }
    };
    
    // Start the localStorage polling
    checkStorage();
    
    // Set timeout to resolve with false if no acknowledgment received
    timeoutId = setTimeout(() => {
      console.log("Stream acknowledgment timeout reached");
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
          console.log("Attempting to restart video track:", track.id);
          
          try {
            // Toggle the track to try to wake it up
            const wasEnabled = track.enabled;
            track.enabled = false;
            setTimeout(() => {
              track.enabled = wasEnabled;
            }, 100);
            
            fixAttempted = true;
          } catch (e) {
            console.error("Error trying to fix video track:", e);
          }
        }
      });
    } catch (e) {
      console.error("Error analyzing stream:", e);
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

// Helper to update video element with stream safely
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
      
      // Set stream as source
      videoElement.srcObject = stream;
      
      // Try to play with fallbacks
      videoElement.play()
        .then(() => {
          console.log("Video playing successfully");
          resolve(true);
        })
        .catch(err => {
          console.error("Error playing video:", err);
          
          // Try with muted flag if not already muted
          if (!muted) {
            console.log("Retrying with muted=true");
            videoElement.muted = true;
            
            videoElement.play()
              .then(() => {
                console.log("Video playing successfully (muted)");
                resolve(true);
              })
              .catch(err2 => {
                console.error("Error playing muted video:", err2);
                
                // One more retry with low volume and delayed
                setTimeout(() => {
                  videoElement.volume = 0.01;
                  videoElement.play()
                    .then(() => {
                      console.log("Video playing on final retry");
                      resolve(true);
                    })
                    .catch(finalErr => {
                      console.error("All play attempts failed:", finalErr);
                      resolve(false);
                    });
                }, 1000);
              });
          } else {
            // Already muted, try with delay
            setTimeout(() => {
              videoElement.play()
                .then(() => {
                  console.log("Video playing on delayed retry");
                  resolve(true);
                })
                .catch(finalErr => {
                  console.error("All play attempts failed:", finalErr);
                  resolve(false);
                });
            }, 1000);
          }
        });
    } catch (e) {
      console.error("Error attaching stream to video:", e);
      resolve(false);
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
}> => {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenSize: { width: window.screen.width, height: window.screen.height },
    hasWebRTC: 'RTCPeerConnection' in window,
    hasBroadcastChannel: 'BroadcastChannel' in window,
    hasMediaDevices: 'mediaDevices' in navigator,
    hasGetUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    hasCameraPermission: false
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
