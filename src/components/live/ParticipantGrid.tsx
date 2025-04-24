
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
  const videoRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Enhanced broadcast channel listener for better stream reception
  useEffect(() => {
    if (!sessionId) return;
    
    try {
      // Listen on multiple channels for redundancy
      const channels = [
        new BroadcastChannel(`live-session-${sessionId}`),
        new BroadcastChannel(`telao-session-${sessionId}`),
        new BroadcastChannel(`stream-info-${sessionId}`)
      ];
      
      // Also set up localStorage monitoring for Firefox/Opera
      const storageListener = (event: StorageEvent) => {
        if (!event.key) return;
        
        // Check for stream info in storage events
        if (event.key.startsWith(`stream-info-${sessionId}`)) {
          try {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'video-stream-info') {
              handleStreamInfo(data);
            }
          } catch (e) {
            console.error("Error parsing storage event stream info:", e);
          }
        }
        
        // Check for diagnostic data
        if (event.key.startsWith(`diagnostic-${sessionId}`)) {
          try {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'connection-diagnostics') {
              console.log("Received diagnostic data via storage:", data);
              // Update participant browser info if available
              if (data.participantId && data.browserType) {
                updateParticipantStatus(sessionId, data.participantId, {
                  browserType: data.browserType,
                  lastActive: Date.now()
                });
              }
            }
          } catch (e) {
            console.error("Error parsing diagnostic data:", e);
          }
        }
      };
      
      window.addEventListener('storage', storageListener);
      
      // Poll localStorage directly for Firefox/Opera (they handle storage events differently)
      const checkStorageInterval = setInterval(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            if (key.startsWith(`stream-info-${sessionId}`) || 
                key.startsWith(`test-${sessionId}`) ||
                key.startsWith(`diagnostic-${sessionId}`)) {
              try {
                const value = localStorage.getItem(key);
                if (!value) continue;
                
                const data = JSON.parse(value);
                
                // Process various message types
                if (data.type === 'video-stream-info') {
                  handleStreamInfo(data);
                  // Remove after processing to avoid duplicates
                  localStorage.removeItem(key);
                }
                else if (data.type === 'connection-test') {
                  // Send ack response
                  const responseKey = `response-${sessionId}-${data.id}-${Date.now()}`;
                  localStorage.setItem(responseKey, JSON.stringify({
                    type: 'host-ack',
                    targetId: data.id,
                    testId: data.testId,
                    timestamp: Date.now()
                  }));
                  
                  // Remove test message
                  localStorage.removeItem(key);
                }
              } catch (e) {
                console.warn("Error processing localStorage item:", e);
              }
            }
          }
        } catch (e) {
          console.error("Error checking localStorage:", e);
        }
      }, 1000);
      
      const handleStreamInfo = (data: any) => {
        if (!data || !data.id) return;
        
        const participantId = data.id;
        console.log(`Received stream info from ${participantId}:`, data);
        
        // Update hasVideo state based on the message
        if (data.hasVideo !== undefined) {
          setHasVideoMap(prev => ({
            ...prev,
            [participantId]: data.hasVideo
          }));
          
          // Ensure participant is shown as active
          const participant = participants.find(p => p.id === participantId);
          if (participant) {
            const updates: any = {
              active: true,
              lastActive: Date.now(),
              hasVideo: data.hasVideo
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
            
            updateParticipantStatus(sessionId, participantId, updates);
          }
          
          // Send acknowledgment back to participant (try both broadcast and storage)
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
          
          // Also store ack in localStorage for Firefox/Opera
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
        }
      };
      
      // Set up listeners for all channels
      channels.forEach(channel => {
        channel.onmessage = (event) => {
          if (event.data.type === 'video-stream-info') {
            handleStreamInfo(event.data);
          }
        };
      });
      
      // Cleanup function to close all channels and intervals
      return () => {
        channels.forEach(channel => channel.close());
        window.removeEventListener('storage', storageListener);
        clearInterval(checkStorageInterval);
      };
    } catch (e) {
      console.error("Error setting up stream info channels:", e);
      
      // Fallback to pure localStorage approach for Firefox/Opera
      const storageListener = (event: StorageEvent) => {
        // We need this for browsers that don't support BroadcastChannel
        if (event.key && event.key.includes(`stream-info-${sessionId}`)) {
          try {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'video-stream-info' && data.id) {
              console.log("Received stream info via localStorage:", data);
              
              setHasVideoMap(prev => ({
                ...prev,
                [data.id]: data.hasVideo
              }));
              
              // Update participant status
              updateParticipantStatus(sessionId, data.id, {
                active: true,
                lastActive: Date.now(),
                hasVideo: data.hasVideo
              });
            }
          } catch (error) {
            console.error("Error handling storage event:", error);
          }
        }
      };
      
      window.addEventListener('storage', storageListener);
      
      return () => {
        window.removeEventListener('storage', storageListener);
      };
    }
  }, [sessionId, participants]);
  
  // Enhanced effect to update video elements when stream references change
  useEffect(() => {
    if (!participantStreams) return;
    
    // Log the available participant streams for debugging
    console.log("Available participant streams:", Object.keys(participantStreams));
    console.log("Participants with streams:", participants.filter(p => participantStreams[p.id]).length);
    
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
          videoElement?.play().catch(err => {
            console.error(`Error playing video on metadata load for ${participantId}:`, err);
            
            // Track the error
            setStreamErrors(prev => ({
              ...prev,
              [participantId]: `Play error: ${err.message}`
            }));
            
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
        };
      }
      
      if (videoElement.srcObject !== stream) {
        console.log(`Attaching stream to video element for ${participantId}`);
        
        // Set the stream as source
        videoElement.srcObject = stream;
        
        // Try to play video
        videoElement.play()
          .then(() => {
            console.log(`Video playing for ${participantId}`);
            // Clear errors when video plays successfully
            setStreamErrors(prev => ({
              ...prev,
              [participantId]: ''
            }));
          })
          .catch(err => {
            console.error(`Error playing video for ${participantId}:`, err);
            setStreamErrors(prev => ({
              ...prev,
              [participantId]: `Play error: ${err.message}`
            }));
            
            // Retry logic
            setTimeout(() => {
              if (videoElement) {
                videoElement.play()
                  .then(() => console.log(`Successfully played video on retry for ${participantId}`))
                  .catch(retryErr => console.error(`Error on retry for ${participantId}:`, retryErr));
              }
            }, 1000);
          });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error updating video element for ${participantId}:`, errorMessage);
      setStreamErrors(prev => ({
        ...prev,
        [participantId]: errorMessage
      }));
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

  // This is the critical function to handle manual selection - modified to be explicit
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
