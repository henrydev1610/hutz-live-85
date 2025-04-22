
import { User, Check, Video, VideoOff } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from 'react';

interface Participant {
  id: string;
  name: string;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  connectedAt?: number;
}

interface ParticipantGridProps {
  participants: Participant[];
  onSelectParticipant: (id: string) => void;
  onRemoveParticipant: (id: string) => void;
  participantStreams?: {[id: string]: MediaStream};
}

const ParticipantGrid = ({ 
  participants, 
  onSelectParticipant, 
  onRemoveParticipant,
  participantStreams = {}
}: ParticipantGridProps) => {
  const videoRefs = useRef<{[id: string]: HTMLDivElement | null}>({});
  const [streamStatus, setStreamStatus] = useState<{[id: string]: boolean}>({});
  
  const activeParticipants = participants.filter(p => p.active);
  const inactiveParticipants = participants.filter(p => !p.active);
  
  // Sort participants by connection time (most recent first)
  const sortedActiveParticipants = [...activeParticipants].sort((a, b) => 
    (b.connectedAt || 0) - (a.connectedAt || 0)
  );
  
  // Remove duplicates in the display
  const displayParticipants = sortedActiveParticipants.filter((participant, index, self) =>
    index === self.findIndex((p) => p.id === participant.id)
  );

  // Effect to update transmission window when participant selection changes
  useEffect(() => {
    const transmissionWindow = window.opener;
    if (transmissionWindow && !transmissionWindow.closed) {
      transmissionWindow.postMessage({
        type: 'update-participants',
        participants
      }, '*');
    }
  }, [participants]);
  
  // Effect to update video elements when streams change
  useEffect(() => {
    console.log("ParticipantGrid: participantStreams updated:", Object.keys(participantStreams));
    
    // Track which participants have streams
    const participantsWithStreams = new Set<string>();
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      participantsWithStreams.add(participantId);
      
      const container = videoRefs.current[participantId];
      if (container) {
        updateVideoElement(container, stream);
        
        // Check if stream has video tracks
        const hasVideoTracks = stream.getVideoTracks().some(track => track.enabled);
        setStreamStatus(prev => ({
          ...prev,
          [participantId]: hasVideoTracks
        }));
      }
    });
    
    // Check for participants with refs but no streams
    Object.keys(videoRefs.current).forEach(participantId => {
      if (!participantsWithStreams.has(participantId) && videoRefs.current[participantId]) {
        const container = videoRefs.current[participantId];
        const videoElement = container?.querySelector('video');
        if (videoElement) {
          videoElement.srcObject = null;
          setStreamStatus(prev => ({
            ...prev,
            [participantId]: false
          }));
        }
      }
    });
  }, [participantStreams, displayParticipants]);
  
  // Function to add or update video element in container
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream) => {
    let videoElement = container.querySelector('video');
    
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = 'w-full h-full object-cover';
      container.appendChild(videoElement);
      
      // Add event listeners for video
      videoElement.onloadedmetadata = () => {
        videoElement?.play().catch(err => console.error('Error playing video:', err));
      };
      
      videoElement.onplay = () => {
        console.log('Video is playing');
      };
      
      videoElement.onerror = (e) => {
        console.error('Video error:', e);
      };
    }
    
    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(err => console.error('Error playing video:', err));
    }
  };
  
  const getShortName = (participant: Participant) => {
    if (participant.name) return participant.name;
    return `Participante ${participant.id.substring(participant.id.lastIndexOf('-') + 1)}`;
  };
  
  // Update transmission window when streams change
  useEffect(() => {
    const transmissionWindow = window.opener;
    if (transmissionWindow && !transmissionWindow.closed) {
      const selectedParticipants = participants.filter(p => p.selected);
      
      selectedParticipants.forEach(participant => {
        if (participantStreams[participant.id]) {
          // Notify transmission window about participant stream status
          const channel = new BroadcastChannel(`live-session-${window.sessionStorage.getItem('currentSessionId')}`);
          channel.postMessage({
            type: 'video-stream',
            participantId: participant.id,
            stream: { hasStream: true }
          });
          
          setTimeout(() => channel.close(), 100);
        }
      });
    }
  }, [participantStreams, participants]);
  
  return (
    <div className="space-y-4 w-full max-w-[1200px]">
      {displayParticipants.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-white/70 mb-2">Participantes Ativos ({displayParticipants.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {displayParticipants.map((participant) => (
              <Card key={participant.id} className={`bg-secondary/60 border ${participant.selected ? 'border-accent' : 'border-white/10'}`}>
                <CardContent className="p-4 text-center">
                  <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2 relative">
                    {!streamStatus[participant.id] && <User className="h-8 w-8 text-white/30" />}
                    <div className="absolute top-2 right-2 bg-green-500/20 p-1 rounded-full">
                      {streamStatus[participant.id] ? (
                        <Video className="h-3 w-3 text-green-500" />
                      ) : (
                        <VideoOff className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                    {participant.selected && (
                      <div className="absolute inset-0 bg-accent/10 flex items-center justify-center">
                        <span className="text-xs bg-accent text-white px-2 py-1 rounded-full">Na tela</span>
                      </div>
                    )}
                    <div 
                      id={`participant-video-${participant.id}`}
                      className="absolute inset-0 overflow-hidden"
                      ref={el => videoRefs.current[participant.id] = el}
                    >
                      {/* Video element will be inserted here dynamically */}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium truncate">
                      {getShortName(participant)}
                    </p>
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-400/20 text-xs">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                      Online
                    </Badge>
                  </div>
                  <div className="flex justify-center gap-2 mt-2">
                    <Button 
                      variant={participant.selected ? "default" : "outline"} 
                      size="sm" 
                      className={`h-8 ${participant.selected ? 'bg-accent text-white' : 'border-white/20'}`}
                      onClick={() => onSelectParticipant(participant.id)}
                    >
                      {participant.selected ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Selecionado
                        </>
                      ) : 'Selecionar'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-white/60 hover:text-white"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {inactiveParticipants.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-white/70 mb-2">Participantes Inativos ({inactiveParticipants.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {inactiveParticipants.map((participant) => (
              <Card key={participant.id} className="bg-secondary/60 border border-white/10 opacity-60">
                <CardContent className="p-4 text-center">
                  <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                    <User className="h-8 w-8 text-white/30" />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium truncate">
                      {getShortName(participant)}
                    </p>
                    <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-400/20 text-xs">
                      <span className="w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
                      Offline
                    </Badge>
                  </div>
                  <div className="flex justify-center gap-2 mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-white/60 hover:text-white"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {activeParticipants.length === 0 && inactiveParticipants.length === 0 && (
        <div className="bg-secondary/30 border border-white/10 rounded-lg p-8 text-center">
          <User className="h-12 w-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/70 mb-2">Sem participantes</h3>
          <p className="text-sm text-white/50 max-w-sm mx-auto">
            Compartilhe o QR Code para que os participantes possam entrar na sessão.
          </p>
        </div>
      )}
      
      <p className="text-sm text-white/60 mt-4">
        Participantes são adicionados automaticamente quando acessam o link do QR Code.
      </p>
    </div>
  );
};

export default ParticipantGrid;
