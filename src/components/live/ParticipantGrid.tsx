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
  const videoRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Effect to update video elements when stream references change
  useEffect(() => {
    if (!participantStreams) return;
    
    // Log the available participant streams
    console.log("Participant streams available:", Object.keys(participantStreams));
    
    // Update all video elements with their streams
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      // Skip if no stream or it has no tracks
      if (!stream || stream.getTracks().length === 0) {
        console.log(`Stream for ${participantId} has no tracks`);
        return;
      }
      
      const hasVideoTracks = stream.getVideoTracks().length > 0;
      console.log(`Participant ${participantId} has video tracks: ${hasVideoTracks}`);
      
      // Update hasVideo state for this participant
      setHasVideoMap(prev => ({
        ...prev,
        [participantId]: hasVideoTracks
      }));
      
      // Find the container for this participant's video
      const container = videoRefs.current[participantId];
      if (container) {
        updateVideoElement(container, stream);
      } else {
        console.log(`Container for participant ${participantId} not found. Will try again in the next render.`);
      }
    });
    
    // Also check for video containers that might need streams
    participants.forEach(participant => {
      if (participant.hasVideo && !hasVideoMap[participant.id] && videoRefs.current[participant.id]) {
        // This participant should have video but doesn't have it in our state
        // Check if we have a stream for them
        const stream = participantStreams[participant.id];
        if (stream && stream.getVideoTracks().length > 0) {
          updateVideoElement(videoRefs.current[participant.id]!, stream);
          setHasVideoMap(prev => ({
            ...prev,
            [participant.id]: true
          }));
        }
      }
    });
  }, [participantStreams, participants]);
  
  // Effect to update video element visibility when hasVideo changes
  useEffect(() => {
    participants.forEach(participant => {
      // If we have a record of whether this participant has video
      if (hasVideoMap[participant.id] !== undefined) {
        const hasVideo = hasVideoMap[participant.id];
        
        // Update participant status if our local state differs from participant data
        if (participant.hasVideo !== hasVideo) {
          updateParticipantStatus(sessionId, participant.id, { hasVideo });
        }
      }
    });
  }, [hasVideoMap, participants, sessionId]);

  // Function to add or update video element in container
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream) => {
    const participantId = container.id.replace('participant-video-', '');
    let videoElement = videoElements.current[participantId];
    
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = 'w-full h-full object-cover';
      
      // Store reference to video element
      videoElements.current[participantId] = videoElement;
      
      // Clear container before adding
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      container.appendChild(videoElement);
      
      // Add event listeners for video
      videoElement.onloadedmetadata = () => {
        videoElement?.play().catch(err => console.error('Error playing video:', err));
      };
    }
    
    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
      
      // Try to play video
      videoElement.play().catch(err => {
        console.error('Error playing video:', err);
        
        // Try again after a delay
        setTimeout(() => {
          videoElement?.play().catch(e => console.error('Error playing video on retry:', e));
        }, 1000);
      });
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

  // Render participant card
  const renderParticipantCard = (participant: Participant) => {
    const isActive = participant.active;
    const isSelected = participant.selected;
    const hasVideo = hasVideoMap[participant.id] || participant.hasVideo || false;
    const lastActiveDuration = formatTimeSince(participant.lastActive);
    
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
          {/* Participant video container */}
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
