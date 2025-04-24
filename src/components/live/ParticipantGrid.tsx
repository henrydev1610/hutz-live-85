
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  User, Video, VideoOff, Crown, Shield, 
  Check, Ban, UserX, MoreVertical, X,
  Eye, EyeOff, Share, AlertTriangle
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateParticipantStatus } from '@/utils/sessionUtils';

export interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  lastActive: number;
  active: boolean;
  selected: boolean;
  connectedAt?: number;
  hasVideo?: boolean;
  isAdmin?: boolean;
  browserType?: string;
}

interface ParticipantGridProps {
  sessionId: string;
  participants: Participant[];
  participantStreams?: { [key: string]: MediaStream };
  onSelectParticipant: (participantId: string) => void;
  onRemoveParticipant: (participantId: string) => void;
  onToggleAdminStatus?: (participantId: string) => void;
  onToggleGrantAdminVisibility?: (participantId: string) => void;
  showAdminControls?: boolean;
}

const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  sessionId,
  participants,
  participantStreams = {},
  onSelectParticipant,
  onRemoveParticipant,
  onToggleAdminStatus,
  onToggleGrantAdminVisibility,
  showAdminControls = false,
}) => {
  const { toast } = useToast();
  const [hasVideoMap, setHasVideoMap] = useState<{[key: string]: boolean}>({});
  const [streamConnectionCount, setStreamConnectionCount] = useState<{[key: string]: number}>({});
  const [streamErrors, setStreamErrors] = useState<{[key: string]: string}>({});
  const [lastStreamUpdate, setLastStreamUpdate] = useState<{[key: string]: number}>({});
  const videoRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[key: string]: HTMLVideoElement | null}>({});
  const streamUpdateTimers = useRef<{[key: string]: number}>({});
  
  // Enhanced broadcast channel listener with heartbeat system
  useEffect(() => {
    if (!sessionId) return;
    
    console.log(`ParticipantGrid initializing for session ${sessionId} with ${participants.length} participants`);
    
    const channels = [];
    
    try {
      // Set up multiple communication channels for redundancy
      const streamInfoChannel = new BroadcastChannel(`stream-info-${sessionId}`);
      const liveSessionChannel = new BroadcastChannel(`live-session-${sessionId}`);
      const telaoSessionChannel = new BroadcastChannel(`telao-session-${sessionId}`);
      
      channels.push(streamInfoChannel, liveSessionChannel, telaoSessionChannel);
      
      // Handle stream information through BroadcastChannel
      const handleStreamInfoMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || !data.type) return;
        
        // Process video stream info messages
        if (data.type === 'video-stream-info' && data.id) {
          console.log(`Received stream info for ${data.id}:`, data);
          processStreamInfo(data);
        }
        
        // Process diagnostic messages
        if (data.type === 'connection-diagnostics' && data.participantId) {
          console.log(`Received diagnostic data for ${data.participantId}:`, data);
          updateParticipantBrowserInfo(data);
        }
        
        // Process real-time heartbeats
        if (data.type === 'participant-heartbeat' && data.participantId) {
          updateParticipantActivity(data.participantId);
        }
      };
      
      // Set up listeners for all channels
      streamInfoChannel.onmessage = handleStreamInfoMessage;
      liveSessionChannel.onmessage = handleStreamInfoMessage;
      telaoSessionChannel.onmessage = handleStreamInfoMessage;
      
      // Set up localStorage polling fallback (for Firefox/Safari compatibility)
      const checkStorageInterval = setInterval(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            if (key.startsWith(`stream-info-${sessionId}`) || 
                key.startsWith(`diagnostic-${sessionId}`)) {
              try {
                const value = localStorage.getItem(key);
                if (!value) continue;
                
                const data = JSON.parse(value);
                
                if (data.type === 'video-stream-info' && data.id) {
                  processStreamInfo(data);
                  // Remove after processing to avoid duplicates
                  localStorage.removeItem(key);
                }
                else if (data.type === 'connection-diagnostics' && data.participantId) {
                  updateParticipantBrowserInfo(data);
                  localStorage.removeItem(key);
                }
              } catch (e) {
                console.warn("Error processing localStorage stream info:", e);
              }
            }
          }
        } catch (e) {
          console.error("Error checking localStorage:", e);
        }
      }, 1000);
      
      // Periodically request stream updates from participants
      const requestUpdatesInterval = setInterval(() => {
        try {
          // Broadcast request for stream info updates
          streamInfoChannel.postMessage({
            type: 'request-stream-info',
            timestamp: Date.now()
          });
          
          // Also store request in localStorage for browsers that don't support BroadcastChannel
          const requestKey = `stream-request-${sessionId}-${Date.now()}`;
          localStorage.setItem(requestKey, JSON.stringify({
            type: 'request-stream-info',
            timestamp: Date.now()
          }));
          
          // Clean up old request keys
          setTimeout(() => localStorage.removeItem(requestKey), 5000);
          
          // Check for stale streams (no updates for over 10 seconds)
          const now = Date.now();
          Object.entries(lastStreamUpdate).forEach(([participantId, lastUpdate]) => {
            if (now - lastUpdate > 10000) {
              console.log(`Stream for participant ${participantId} may be stale (last updated ${now - lastUpdate}ms ago)`);
              
              // Try to recover by sending another request specifically for this participant
              streamInfoChannel.postMessage({
                type: 'request-stream-info',
                targetId: participantId,
                timestamp: now
              });
            }
          });
        } catch (e) {
          console.error("Error requesting stream updates:", e);
        }
      }, 5000);
      
      // Return cleanup function
      return () => {
        channels.forEach(channel => channel.close());
        clearInterval(checkStorageInterval);
        clearInterval(requestUpdatesInterval);
        
        // Clear any pending stream update timers
        Object.values(streamUpdateTimers.current).forEach(
          timerId => window.clearTimeout(timerId)
        );
      };
    } catch (e) {
      console.error("Error setting up stream communication channels:", e);
      
      // If BroadcastChannel setup fails, fall back to pure localStorage approach
      const storageListener = (event: StorageEvent) => {
        if (!event.key) return;
        
        try {
          if (event.key.startsWith(`stream-info-${sessionId}`)) {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'video-stream-info' && data.id) {
              console.log("Received stream info via localStorage:", data);
              processStreamInfo(data);
            }
          }
        } catch (e) {
          console.error("Error handling storage event:", e);
        }
      };
      
      window.addEventListener('storage', storageListener);
      
      // Set up periodic localStorage check as a backup
      const checkStorageInterval = setInterval(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(`stream-info-${sessionId}`)) continue;
            
            try {
              const value = localStorage.getItem(key);
              if (!value) continue;
              
              const data = JSON.parse(value);
              if (data.type === 'video-stream-info' && data.id) {
                processStreamInfo(data);
                localStorage.removeItem(key);
              }
            } catch (e) {
              console.warn("Error processing localStorage item:", e);
            }
          }
        } catch (e) {
          console.error("Error in localStorage fallback check:", e);
        }
      }, 1000);
      
      return () => {
        window.removeEventListener('storage', storageListener);
        clearInterval(checkStorageInterval);
      };
    }
  }, [sessionId, participants]);
  
  // Process stream info from participants
  const processStreamInfo = (data: any) => {
    if (!data || !data.id) return;
    
    const participantId = data.id;
    
    // Update hasVideo state based on the message
    if (data.hasVideo !== undefined) {
      setHasVideoMap(prev => ({
        ...prev,
        [participantId]: data.hasVideo
      }));
      
      // Record the last time we got an update for this stream
      setLastStreamUpdate(prev => ({
        ...prev,
        [participantId]: Date.now()
      }));
      
      // Ensure participant is shown as active
      updateParticipantActivity(participantId, data);
      
      // Send acknowledgment back to participant
      sendStreamAcknowledgment(participantId);
    }
  };
  
  // Update participant activity status
  const updateParticipantActivity = (participantId: string, data?: any) => {
    const participant = participants.find(p => p.id === participantId);
    if (participant) {
      const updates: any = {
        active: true,
        lastActive: Date.now()
      };
      
      if (data?.hasVideo !== undefined) {
        updates.hasVideo = data.hasVideo;
      }
      
      updateParticipantStatus(sessionId, participantId, updates);
    }
  };
  
  // Update participant browser information from diagnostic data
  const updateParticipantBrowserInfo = (data: any) => {
    if (!data.participantId) return;
    
    const updates: any = {
      active: true,
      lastActive: Date.now()
    };
    
    // Update browser type if available
    if (data.deviceInfo?.userAgent) {
      const ua = data.deviceInfo.userAgent.toLowerCase();
      if (ua.indexOf('firefox') > -1) {
        updates.browserType = 'firefox';
      } else if (ua.indexOf('opr') > -1 || ua.indexOf('opera') > -1) {
        updates.browserType = 'opera';
      } else if (ua.indexOf('edge') > -1 || ua.indexOf('edg') > -1) {
        updates.browserType = 'edge';
      } else if (ua.indexOf('chrome') > -1) {
        updates.browserType = 'chrome';
      } else if (ua.indexOf('safari') > -1) {
        updates.browserType = 'safari';
      }
    }
    
    if (Object.keys(updates).length > 1) {
      updateParticipantStatus(sessionId, data.participantId, updates);
    }
  };
  
  // Send stream acknowledgment to participant
  const sendStreamAcknowledgment = (participantId: string) => {
    try {
      // Try both broadcast and storage mechanisms for maximum compatibility
      try {
        const responseChannel = new BroadcastChannel(`response-${sessionId}`);
        responseChannel.postMessage({
          type: 'host-ack',
          targetId: participantId,
          received: true,
          timestamp: Date.now()
        });
        setTimeout(() => responseChannel.close(), 500);
      } catch (e) {
        console.error("Error sending broadcast acknowledgment:", e);
      }
      
      // Also store ack in localStorage for Firefox/Safari compatibility
      try {
        const responseKey = `response-${sessionId}-${participantId}-${Date.now()}`;
        localStorage.setItem(responseKey, JSON.stringify({
          type: 'host-ack',
          targetId: participantId,
          received: true,
          timestamp: Date.now()
        }));
        setTimeout(() => localStorage.removeItem(responseKey), 10000);
      } catch (e) {
        console.error("Error storing localStorage acknowledgment:", e);
      }
    } catch (e) {
      console.error("Error sending stream acknowledgment:", e);
    }
  };
  
  // Enhanced effect to update video elements when stream references change
  useEffect(() => {
    if (!participantStreams) return;
    
    // Log the available participant streams for debugging
    console.log(`ParticipantGrid: Processing ${Object.keys(participantStreams).length} participant streams`);
    
    // Check for each participant that should have video
    participants.forEach(participant => {
      const stream = participantStreams[participant.id];
      const hasStreamData = stream !== undefined;
      
      console.log(`Checking participant ${participant.id} (${participant.name}):`, {
        hasStreamInProps: hasStreamData,
        streamTracks: stream ? stream.getTracks().length : 0,
        videoTracks: stream ? stream.getVideoTracks().length : 0,
        selected: participant.selected,
        active: participant.active,
        browserType: participant.browserType
      });
      
      // If we have a stream for this participant
      if (hasStreamData && stream && stream.getTracks().length > 0) {
        const hasVideoTracks = stream.getVideoTracks().length > 0;
        
        // Update hasVideo state for this participant
        setHasVideoMap(prev => ({
          ...prev,
          [participant.id]: hasVideoTracks
        }));
        
        // Increment connection count for this participant
        setStreamConnectionCount(prev => ({
          ...prev,
          [participant.id]: (prev[participant.id] || 0) + 1
        }));
        
        // Record the last time we got an update for this stream
        setLastStreamUpdate(prev => ({
          ...prev,
          [participant.id]: Date.now()
        }));
        
        // Clear any previous errors
        setStreamErrors(prev => ({
          ...prev,
          [participant.id]: ''
        }));
        
        // Find the container for this participant's video
        const container = videoRefs.current[participant.id];
        if (container) {
          console.log(`Updating video for ${participant.id}`);
          updateVideoElement(container, stream, participant.id);
        } else {
          console.log(`Container for participant ${participant.id} not found yet.`);
          
          // Schedule a retry in case the container wasn't ready yet
          const timerId = window.setTimeout(() => {
            const container = videoRefs.current[participant.id];
            if (container) {
              console.log(`Retry: Updating video for ${participant.id}`);
              updateVideoElement(container, stream, participant.id);
            }
          }, 500);
          
          streamUpdateTimers.current[participant.id] = timerId;
        }
      }
    });
  }, [participantStreams, participants]);
  
  // Function to add or update video element in container with improved error handling
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream, participantId: string) => {
    let videoElement = videoElements.current[participantId];
    
    try {
      if (!videoElement) {
        console.log(`Creating new video element for ${participantId}`);
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.className = 'w-full h-full object-cover';
        
        // Add data attributes for debugging
        videoElement.setAttribute('data-participant-id', participantId);
        
        // Store reference to video element
        videoElements.current[participantId] = videoElement;
        
        // Clear container before adding
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        
        container.appendChild(videoElement);
        
        // Add event listeners for video with detailed logging
        videoElement.onloadedmetadata = () => {
          console.log(`Video metadata loaded for ${participantId}, dimensions: ${videoElement?.videoWidth}x${videoElement?.videoHeight}`);
          videoElement?.play()
            .then(() => console.log(`Video playing after metadata load for ${participantId}`))
            .catch(err => {
              console.error(`Error playing video on metadata load for ${participantId}:`, err);
              
              // Track the error
              setStreamErrors(prev => ({
                ...prev,
                [participantId]: `Play error: ${err.message}`
              }));
              
              // Try again with a delay and different play approach
              setTimeout(() => {
                if (videoElement) {
                  // Try with user gesture simulation (works in some browsers)
                  const playPromise = videoElement.play();
                  if (playPromise) {
                    playPromise.catch(e => {
                      console.error(`Retry failed for ${participantId}:`, e);
                      // Try with muted first, then unmute (Safari workaround)
                      videoElement.muted = true;
                      videoElement.play().then(() => {
                        // Try to unmute after a short delay
                        setTimeout(() => {
                          videoElement.muted = false;
                        }, 1000);
                      }).catch(finalErr => {
                        console.error(`All play attempts failed for ${participantId}:`, finalErr);
                      });
                    });
                  }
                }
              }, 1000);
            });
        };
        
        // Add more event listeners for debugging
        videoElement.oncanplay = () => {
          console.log(`Video can play for ${participantId}`);
          // Clear errors when video can play
          setStreamErrors(prev => ({
            ...prev,
            [participantId]: ''
          }));
        };
        
        videoElement.onerror = (event) => {
          const errorMessage = videoElement?.error?.message || "Unknown video error";
          console.error(`Video element error for ${participantId}:`, errorMessage);
          setStreamErrors(prev => ({
            ...prev,
            [participantId]: errorMessage
          }));
          
          // Try to recover automatically
          setTimeout(() => {
            if (videoElement && container.contains(videoElement)) {
              console.log(`Attempting to recover from video error for ${participantId}`);
              
              // Re-create video element
              const newVideo = document.createElement('video');
              newVideo.autoplay = true;
              newVideo.playsInline = true;
              newVideo.muted = true;
              newVideo.className = 'w-full h-full object-cover';
              newVideo.setAttribute('data-participant-id', participantId);
              
              // Setup event listeners
              setupVideoEventListeners(newVideo, participantId);
              
              // Replace old video element
              container.replaceChild(newVideo, videoElement);
              videoElements.current[participantId] = newVideo;
              
              // Set stream
              if (stream) {
                newVideo.srcObject = stream;
                newVideo.play().catch(err => console.error(`Recovery play failed for ${participantId}:`, err));
              }
            }
          }, 2000);
        };
      }
      
      if (videoElement.srcObject !== stream) {
        console.log(`Attaching stream to video element for ${participantId}`);
        
        // Set the stream as source
        videoElement.srcObject = stream;
        
        // Try to play video with enhanced error handling
        playVideoWithFallbacks(videoElement, participantId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error updating video element for ${participantId}:`, errorMessage);
      setStreamErrors(prev => ({
        ...prev,
        [participantId]: errorMessage
      }));
      
      // Try to recover after a delay
      setTimeout(() => {
        try {
          // Reset the video element completely
          if (container) {
            // Remove old video
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
            
            // Create new video element
            const newVideo = document.createElement('video');
            newVideo.autoplay = true;
            newVideo.playsInline = true;
            newVideo.muted = true;
            newVideo.className = 'w-full h-full object-cover';
            
            // Set up all event listeners
            setupVideoEventListeners(newVideo, participantId);
            
            // Append to container
            container.appendChild(newVideo);
            
            // Store reference
            videoElements.current[participantId] = newVideo;
            
            // Set stream source
            if (stream) {
              newVideo.srcObject = stream;
              newVideo.play().catch(err => console.error(`Recovery play failed for ${participantId}:`, err));
            }
          }
        } catch (recoveryError) {
          console.error(`Failed to recover video element for ${participantId}:`, recoveryError);
        }
      }, 2000);
    }
  };
  
  // Setup all video event listeners
  const setupVideoEventListeners = (videoElement: HTMLVideoElement, participantId: string) => {
    videoElement.onloadedmetadata = () => {
      console.log(`Video metadata loaded for ${participantId}`);
      videoElement.play().catch(err => {
        console.error(`Error playing video on metadata load:`, err);
        // Try different play approaches
        playVideoWithFallbacks(videoElement, participantId);
      });
    };
    
    videoElement.oncanplay = () => {
      console.log(`Video can play for ${participantId}`);
      setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
    };
    
    videoElement.onerror = () => {
      const errorMessage = videoElement.error?.message || "Unknown video error";
      console.error(`Video error for ${participantId}:`, errorMessage);
      setStreamErrors(prev => ({ ...prev, [participantId]: errorMessage }));
    };
  };
  
  // Enhanced video playback with multiple fallbacks for different browsers
  const playVideoWithFallbacks = (videoElement: HTMLVideoElement, participantId: string) => {
    console.log(`Attempting to play video for ${participantId} with fallbacks`);
    
    // First attempt - standard play
    videoElement.play()
      .then(() => {
        console.log(`Video playing for ${participantId}`);
        setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
      })
      .catch(err => {
        console.error(`Initial play failed for ${participantId}:`, err);
        
        // Second attempt - ensure muted (required by some browsers for autoplay)
        videoElement.muted = true;
        
        setTimeout(() => {
          videoElement.play()
            .then(() => {
              console.log(`Video playing (muted) for ${participantId}`);
              
              // Try to unmute after user interaction (won't work without interaction)
              const tryUnmute = () => {
                videoElement.muted = false;
                document.removeEventListener('click', tryUnmute);
              };
              document.addEventListener('click', tryUnmute);
            })
            .catch(err2 => {
              console.error(`Muted play failed for ${participantId}:`, err2);
              
              // Third attempt - try with low volume
              videoElement.volume = 0.01;
              setTimeout(() => {
                videoElement.play()
                  .then(() => console.log(`Video playing (low volume) for ${participantId}`))
                  .catch(err3 => console.error(`All play attempts failed for ${participantId}:`, err3));
              }, 1000);
            });
        }, 1000);
      });
  };

  // Format time since for display
  const formatTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    return `${Math.floor(diffSec / 3600)}h`;
  };

  // Handle manual selection of participants
  const handleToggleSelect = (id: string) => {
    console.log(`Manually toggling selection for participant: ${id}`);
    onSelectParticipant(id);
  };

  // Enhanced rendering with improved visual feedback
  const renderParticipantCard = (participant: Participant) => {
    const isActive = participant.active;
    const isSelected = participant.selected;
    const hasVideo = hasVideoMap[participant.id] || participant.hasVideo || false;
    const lastActiveDuration = formatTimeSince(participant.lastActive);
    const connectionCount = streamConnectionCount[participant.id] || 0;
    const streamError = streamErrors[participant.id];
    const browserType = participant.browserType || 'unknown';
    
    return (
      <Card 
        key={participant.id}
        className={`transition-all duration-200 h-full ${
          !isActive ? 'opacity-50' : ''
        } ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
      >
        <CardContent className="p-3 h-full flex flex-col">
          {/* Participant video container with improved diagnostics */}
          <div className="relative aspect-video bg-secondary/60 rounded-md mb-3 overflow-hidden">
            <div 
              id={`participant-video-${participant.id}`}
              className="absolute inset-0 overflow-hidden"
              ref={el => {
                videoRefs.current[participant.id] = el;
                // If we already have a stream for this participant, update the video element
                if (el && participantStreams[participant.id]) {
                  updateVideoElement(el, participantStreams[participant.id], participant.id);
                }
              }}
            >
              {/* Video element will be inserted here dynamically */}
            </div>
            
            {/* Placeholder if no video */}
            {!hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-12 h-12 text-muted-foreground/50" />
              </div>
            )}
            
            {/* Stream error indicator */}
            {streamError && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 p-2 rounded-md">
                <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                <p className="text-xs text-center text-white">{streamError.substring(0, 40)}{streamError.length > 40 ? '...' : ''}</p>
              </div>
            )}
            
            {/* Participant status indicators */}
            <div className="absolute top-2 right-2 flex gap-1">
              {/* Browser type indicator */}
              {browserType !== 'unknown' && (
                <div className="bg-black/70 text-white px-1.5 py-0.5 text-[10px] rounded">
                  {browserType}
                </div>
              )}
              
              {connectionCount > 0 && (
                <div className={`${connectionCount > 1 ? 'bg-green-500/90' : 'bg-yellow-500/90'} text-white p-1 rounded-full`}>
                  <Share className="w-3 h-3" />
                </div>
              )}
              
              {participant.isAdmin && (
                <div className="bg-yellow-500/90 text-white p-1 rounded-full">
                  <Crown className="w-3 h-3" />
                </div>
              )}
              
              {isSelected && (
                <div className="bg-primary/90 text-white p-1 rounded-full">
                  <Check className="w-3 h-3" />
                </div>
              )}
              
              {!isActive && (
                <div className="bg-destructive/90 text-white p-1 rounded-full">
                  <X className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
          
          {/* Participant info and controls - explicitly show selection is manual */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{participant.name || 'Participante'}</p>
              <p className="text-xs text-muted-foreground">
                {isActive ? 'Ativo' : `Inativo (${lastActiveDuration})`}
              </p>
            </div>
            
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={isSelected ? "default" : "outline"}
                className="h-8 w-8"
                onClick={() => handleToggleSelect(participant.id)}
                title="Selecionar manualmente"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              {showAdminControls && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onToggleAdminStatus && onToggleAdminStatus(participant.id)}>
                      {participant.isAdmin ? (
                        <>
                          <Shield className="mr-2 h-4 w-4 text-destructive" />
                          <span>Remover admin</span>
                        </>
                      ) : (
                        <>
                          <Crown className="mr-2 h-4 w-4 text-yellow-500" />
                          <span>Tornar admin</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    
                    {onToggleGrantAdminVisibility && (
                      <DropdownMenuItem onClick={() => onToggleGrantAdminVisibility(participant.id)}>
                        {participant.selected ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            <span>Ocultar para admin</span>
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Mostrar para admin</span>
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      <span>Remover participante</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {participants.length > 0 ? (
          participants.map(renderParticipantCard)
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-8 bg-secondary/20 rounded-lg border border-dashed border-muted">
            <UserX className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-1">Nenhum participante</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Compartilhe o link ou QR code para que os participantes possam se conectar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantGrid;
