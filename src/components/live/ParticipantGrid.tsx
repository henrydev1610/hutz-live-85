import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  User, Video, VideoOff, Crown, Shield, 
  Check, Ban, UserX, MoreVertical, X,
  Eye, EyeOff, Share
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
  const videoRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Set up ping response channel for host to acknowledge participants
  useEffect(() => {
    if (!sessionId) return;
    
    try {
      const pingChannel = new BroadcastChannel(`ping-${sessionId}`);
      
      pingChannel.onmessage = (event) => {
        if (event.data.type === 'participant-ping') {
          const participantId = event.data.id;
          
          // Send back acknowledgment
          pingChannel.postMessage({
            type: 'host-pong',
            targetId: participantId,
            timestamp: Date.now()
          });
          
          // Update the participant's status if they exist
          const participant = participants.find(p => p.id === participantId);
          if (participant) {
            updateParticipantStatus(sessionId, participantId, {
              active: true,
              lastActive: Date.now()
            });
          }
        }
      };
      
      return () => {
        pingChannel.close();
      };
    } catch (e) {
      console.error("Error setting up ping channel:", e);
    }
  }, [sessionId, participants]);
  
  // Listen for diagnostic information
  useEffect(() => {
    if (!sessionId) return;
    
    try {
      const diagnosticChannel = new BroadcastChannel(`diagnostic-${sessionId}`);
      
      diagnosticChannel.onmessage = (event) => {
        if (event.data.type === 'participant-diagnostics') {
          console.log(`Received diagnostics from ${event.data.participantId}:`, event.data);
        }
      };
      
      return () => {
        diagnosticChannel.close();
      };
    } catch (e) {
      console.error("Error setting up diagnostic channel:", e);
    }
  }, [sessionId]);
  
  // Enhanced effect to update video elements when stream references change
  useEffect(() => {
    if (!participantStreams) return;
    
    // Log the available participant streams
    console.log("Participant streams available:", Object.keys(participantStreams));
    console.log("Total number of participants:", participants.length);
    console.log("Participants with selected=true:", participants.filter(p => p.selected).length);
    
    // Check all participants that should have video
    participants.forEach(participant => {
      const stream = participantStreams[participant.id];
      const hasStreamData = stream !== undefined;
      
      console.log(`Checking participant ${participant.id} (${participant.name}):`, {
        hasStreamInProps: hasStreamData,
        streamTracks: stream ? stream.getTracks().length : 0,
        selected: participant.selected,
        active: participant.active,
        hasVideoInState: hasVideoMap[participant.id],
        hasVideoInData: participant.hasVideo
      });
      
      // If we have a stream for this participant but it's not in hasVideoMap
      if (hasStreamData && stream && stream.getTracks().length > 0) {
        const hasVideoTracks = stream.getVideoTracks().length > 0;
        
        // Log more details about the stream for debugging
        if (hasVideoTracks) {
          const videoTrack = stream.getVideoTracks()[0];
          console.log(`Video track details for ${participant.id}:`, {
            enabled: videoTrack.enabled,
            readyState: videoTrack.readyState,
            id: videoTrack.id,
            settings: videoTrack.getSettings(),
            constraints: videoTrack.getConstraints()
          });
        }
        
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
        
        // Find the container for this participant's video
        const container = videoRefs.current[participant.id];
        if (container) {
          console.log(`Attempting to update video for ${participant.id}`);
          updateVideoElement(container, stream);
        } else {
          console.log(`Container for participant ${participant.id} not found. Will try again in the next render.`);
        }
      } 
      // If participant should have video but we don't have a stream
      else if (participant.hasVideo && !hasStreamData) {
        console.log(`Participant ${participant.id} should have video but no stream available`);
      }
    });
  }, [participantStreams, participants]);
  
  // Effect to poll for media element readiness
  useEffect(() => {
    // Check every second if video elements are playing correctly
    const videoCheckInterval = setInterval(() => {
      participants.forEach(participant => {
        const videoElement = videoElements.current[participant.id];
        const stream = participantStreams[participant.id];
        
        // If we have a video element and a stream but the video isn't playing
        if (videoElement && stream && stream.getVideoTracks().length > 0) {
          const isPlaying = !videoElement.paused && 
                           videoElement.readyState >= 3 && 
                           videoElement.videoWidth > 0;
                           
          if (!isPlaying) {
            console.log(`Video for ${participant.id} not playing correctly, retrying attachment`);
            videoElement.srcObject = null;
            videoElement.srcObject = stream;
            videoElement.play().catch(err => {
              console.error(`Error playing video for ${participant.id}:`, err);
            });
          }
        }
      });
    }, 5000);
    
    return () => {
      clearInterval(videoCheckInterval);
    };
  }, [participants, participantStreams]);

  // Function to add or update video element in container with improved error handling
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream) => {
    const participantId = container.id.replace('participant-video-', '');
    let videoElement = videoElements.current[participantId];
    
    try {
      if (!videoElement) {
        console.log(`Creating new video element for ${participantId}`);
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.className = 'w-full h-full object-cover';
        
        // Add a data attribute for debugging
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
          videoElement?.play().catch(err => {
            console.error(`Error playing video on metadata load for ${participantId}:`, err);
            
            // Try again with a delay
            setTimeout(() => {
              console.log(`Retrying play for ${participantId} after metadata load`);
              videoElement?.play().catch(e => {
                console.error(`Retry failed for ${participantId}:`, e);
              });
            }, 1000);
          });
        };
        
        // Add more event listeners for debugging
        videoElement.oncanplay = () => {
          console.log(`Video can play for ${participantId}`);
        };
        
        videoElement.onerror = (event) => {
          console.error(`Video element error for ${participantId}:`, videoElement?.error);
        };
      }
      
      if (videoElement.srcObject !== stream) {
        console.log(`Attaching stream to video element for ${participantId}`);
        
        // Check if stream has active video tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          console.warn(`Stream for ${participantId} has no video tracks`);
        } else {
          const videoTrack = videoTracks[0];
          if (!videoTrack.enabled) {
            console.warn(`Video track for ${participantId} is not enabled`);
          }
          
          if (videoTrack.readyState !== 'live') {
            console.warn(`Video track for ${participantId} is not live (state: ${videoTrack.readyState})`);
          }
        }
        
        // Set the stream as source
        videoElement.srcObject = stream;
        
        // Try to play video with retries
        videoElement.play().catch(err => {
          console.error(`Error playing video for ${participantId}:`, err);
          
          // Implementation of retry logic with increasing delays
          const retryPlay = (attempt = 1, maxAttempts = 3) => {
            if (attempt > maxAttempts) {
              console.error(`Max play attempts reached for ${participantId}`);
              return;
            }
            
            const delay = attempt * 1000;
            console.log(`Retry ${attempt}/${maxAttempts} playing video for ${participantId} in ${delay}ms`);
            
            setTimeout(() => {
              if (videoElement) {
                videoElement.play()
                  .then(() => console.log(`Successfully played video on retry ${attempt} for ${participantId}`))
                  .catch(retryErr => {
                    console.error(`Error on retry ${attempt} for ${participantId}:`, retryErr);
                    retryPlay(attempt + 1, maxAttempts);
                  });
              }
            }, delay);
          };
          
          retryPlay();
        });
      }
    } catch (error) {
      console.error(`Error updating video element for ${participantId}:`, error);
      
      // Try to recover by creating a new video element
      try {
        if (videoElement) {
          videoElement.srcObject = null;
          container.removeChild(videoElement);
          videoElements.current[participantId] = null;
        }
        
        // Try again with a new element
        setTimeout(() => {
          updateVideoElement(container, stream);
        }, 1000);
      } catch (recoveryError) {
        console.error(`Recovery failed for ${participantId}:`, recoveryError);
      }
    }
  };

  const formatTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    return `${Math.floor(diffSec / 3600)}h`;
  };

  const handleToggleSelect = (id: string) => {
    onSelectParticipant(id);
  };

  // Enhanced rendering with connection diagnostics
  const renderParticipantCard = (participant: Participant) => {
    const isActive = participant.active;
    const isSelected = participant.selected;
    const hasVideo = hasVideoMap[participant.id] || participant.hasVideo || false;
    const lastActiveDuration = formatTimeSince(participant.lastActive);
    const connectionCount = streamConnectionCount[participant.id] || 0;
    
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
                  updateVideoElement(el, participantStreams[participant.id]);
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
            
            {/* Participant status indicators */}
            <div className="absolute top-2 right-2 flex gap-1">
              {/* Add connection indicator */}
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
          
          {/* Participant info and controls */}
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
                    <DropdownMenuItem onClick={() => onToggleAdminStatus(participant.id)}>
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
