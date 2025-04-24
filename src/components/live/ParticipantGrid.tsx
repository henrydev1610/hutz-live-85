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
import { createLogger } from '@/utils/loggingUtils';
import { analyzeStreamIssues, attachStreamToVideo } from '@/utils/streamUtils';

const logger = createLogger('participant-grid');

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
  
  useEffect(() => {
    if (!sessionId) return;
    
    logger.info(`ParticipantGrid initializing for session ${sessionId} with ${participants.length} participants`);
    
    const channels = [];
    
    try {
      const streamInfoChannel = new BroadcastChannel(`stream-info-${sessionId}`);
      const liveSessionChannel = new BroadcastChannel(`live-session-${sessionId}`);
      const telaoSessionChannel = new BroadcastChannel(`telao-session-${sessionId}`);
      
      channels.push(streamInfoChannel, liveSessionChannel, telaoSessionChannel);
      
      const handleStreamInfoMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || !data.type) return;
        
        if (data.type === 'video-stream-info' && data.id) {
          logger.debug(`Received stream info for ${data.id}:`, data);
          processStreamInfo(data);
        }
        
        if (data.type === 'connection-diagnostics' && data.participantId) {
          logger.debug(`Received diagnostic data for ${data.participantId}:`, data);
          updateParticipantBrowserInfo(data);
        }
        
        if (data.type === 'participant-heartbeat' && data.participantId) {
          updateParticipantActivity(data.participantId);
        }
      };
      
      streamInfoChannel.onmessage = handleStreamInfoMessage;
      liveSessionChannel.onmessage = handleStreamInfoMessage;
      telaoSessionChannel.onmessage = handleStreamInfoMessage;
      
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
                  localStorage.removeItem(key);
                }
                else if (data.type === 'connection-diagnostics' && data.participantId) {
                  updateParticipantBrowserInfo(data);
                  localStorage.removeItem(key);
                }
              } catch (e) {
                logger.warn("Error processing localStorage stream info:", e);
              }
            }
          }
        } catch (e) {
          logger.error("Error checking localStorage:", e);
        }
      }, 1000);
      
      const requestUpdatesInterval = setInterval(() => {
        try {
          streamInfoChannel.postMessage({
            type: 'request-stream-info',
            timestamp: Date.now()
          });
          
          const requestKey = `stream-request-${sessionId}-${Date.now()}`;
          localStorage.setItem(requestKey, JSON.stringify({
            type: 'request-stream-info',
            timestamp: Date.now()
          }));
          
          setTimeout(() => localStorage.removeItem(requestKey), 5000);
          
          const now = Date.now();
          Object.entries(lastStreamUpdate).forEach(([participantId, lastUpdate]) => {
            if (now - lastUpdate > 10000) {
              logger.info(`Stream for participant ${participantId} may be stale (last updated ${now - lastUpdate}ms ago)`);
              
              streamInfoChannel.postMessage({
                type: 'request-stream-info',
                targetId: participantId,
                timestamp: now
              });
            }
          });
        } catch (e) {
          logger.error("Error requesting stream updates:", e);
        }
      }, 5000);
      
      try {
        streamInfoChannel.postMessage({
          type: 'request-stream-info',
          immediate: true,
          timestamp: Date.now()
        });
      } catch (e) {
        logger.error("Error sending initial stream request:", e);
      }
      
      return () => {
        channels.forEach(channel => channel.close());
        clearInterval(checkStorageInterval);
        clearInterval(requestUpdatesInterval);
        
        Object.values(streamUpdateTimers.current).forEach(
          timerId => window.clearTimeout(timerId)
        );
      };
    } catch (e) {
      logger.error("Error setting up stream communication channels:", e);
      
      const storageListener = (event: StorageEvent) => {
        if (!event.key) return;
        
        try {
          if (event.key.startsWith(`stream-info-${sessionId}`)) {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'video-stream-info' && data.id) {
              logger.debug("Received stream info via localStorage:", data);
              processStreamInfo(data);
            }
          }
        } catch (e) {
          logger.error("Error handling storage event:", e);
        }
      };
      
      window.addEventListener('storage', storageListener);
      
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
              logger.warn("Error processing localStorage item:", e);
            }
          }
        } catch (e) {
          logger.error("Error in localStorage fallback check:", e);
        }
      }, 1000);
      
      return () => {
        window.removeEventListener('storage', storageListener);
        clearInterval(checkStorageInterval);
      };
    }
  }, [sessionId, participants]);
  
  const processStreamInfo = (data: any) => {
    if (!data || !data.id) return;
    
    const participantId = data.id;
    
    if (data.hasVideo !== undefined) {
      setHasVideoMap(prev => ({
        ...prev,
        [participantId]: data.hasVideo
      }));
      
      setLastStreamUpdate(prev => ({
        ...prev,
        [participantId]: Date.now()
      }));
      
      updateParticipantActivity(participantId, data);
      
      sendStreamAcknowledgment(participantId);
    }
  };
  
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
  
  const updateParticipantBrowserInfo = (data: any) => {
    if (!data.participantId) return;
    
    const updates: any = {
      active: true,
      lastActive: Date.now()
    };
    
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
  
  const sendStreamAcknowledgment = (participantId: string) => {
    try {
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
        logger.error("Error sending broadcast acknowledgment:", e);
      }
      
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
        logger.error("Error storing localStorage acknowledgment:", e);
      }
    } catch (e) {
      logger.error("Error sending stream acknowledgment:", e);
    }
  };
  
  useEffect(() => {
    if (!participantStreams) return;
    
    logger.info(`Processing ${Object.keys(participantStreams).length} participant streams`);
    
    participants.forEach(participant => {
      const stream = participantStreams[participant.id];
      const hasStreamData = stream !== undefined;
      
      logger.debug(`Checking participant ${participant.id} (${participant.name || 'Unnamed'}):`, {
        hasStreamInProps: hasStreamData,
        streamTracks: stream ? stream.getTracks().length : 0,
        videoTracks: stream ? stream.getVideoTracks().length : 0
      });
      
      if (hasStreamData && stream) {
        analyzeStreamIssues(stream).then(analysis => {
          if (analysis.issues.length > 0) {
            logger.warn(`Stream issues for ${participant.id}:`, analysis.issues);
            
            if (analysis.fixAttempted) {
              logger.info(`Attempted to fix stream issues for ${participant.id}`);
            }
            
            if (!analysis.isActive) {
              setStreamErrors(prev => ({
                ...prev,
                [participant.id]: 'Stream is inactive or has issues'
              }));
            }
          }
          
          setHasVideoMap(prev => ({
            ...prev,
            [participant.id]: analysis.hasVideoTracks && analysis.isActive
          }));
          
          if (analysis.hasVideoTracks && analysis.isActive) {
            setStreamConnectionCount(prev => ({
              ...prev,
              [participant.id]: (prev[participant.id] || 0) + 1
            }));
            
            setLastStreamUpdate(prev => ({
              ...prev,
              [participant.id]: Date.now()
            }));
            
            if (streamErrors[participant.id]) {
              setStreamErrors(prev => ({
                ...prev,
                [participant.id]: ''
              }));
            }
            
            updateVideoForParticipant(participant.id, stream);
          }
        });
      }
    });
  }, [participantStreams, participants]);
  
  const updateVideoForParticipant = (participantId: string, stream: MediaStream) => {
    const container = videoRefs.current[participantId];
    if (container) {
      logger.debug(`Updating video for ${participantId}`);
      updateVideoElement(container, stream, participantId);
    } else {
      logger.debug(`Container for participant ${participantId} not found yet`);
      
      const timerId = window.setTimeout(() => {
        const container = videoRefs.current[participantId];
        if (container) {
          logger.debug(`Retry: Updating video for ${participantId}`);
          updateVideoElement(container, stream, participantId);
        }
      }, 500);
      
      streamUpdateTimers.current[participantId] = timerId;
    }
  };
  
  const updateVideoElement = (container: HTMLDivElement, stream: MediaStream, participantId: string) => {
    let videoElement = videoElements.current[participantId];
    
    try {
      if (!videoElement) {
        logger.info(`Creating new video element for ${participantId}`);
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.className = 'w-full h-full object-cover';
        
        videoElement.setAttribute('data-participant-id', participantId);
        
        videoElements.current[participantId] = videoElement;
        
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        
        container.appendChild(videoElement);
        
        videoElement.onloadedmetadata = () => {
          logger.debug(`Video metadata loaded for ${participantId}, dimensions: ${videoElement?.videoWidth}x${videoElement?.videoHeight}`);
          videoElement?.play()
            .then(() => logger.debug(`Video playing after metadata load for ${participantId}`))
            .catch(err => {
              logger.error(`Error playing video on metadata load for ${participantId}:`, err);
              
              setStreamErrors(prev => ({
                ...prev,
                [participantId]: `Play error: ${err.message}`
              }));
              
              setTimeout(() => {
                if (videoElement) {
                  videoElement.muted = true;
                  videoElement.play().then(() => {
                    setTimeout(() => {
                      videoElement.muted = false;
                    }, 1000);
                  }).catch(finalErr => {
                    logger.error(`All play attempts failed for ${participantId}:`, finalErr);
                  });
                }
              }, 1000);
            });
        };
        
        videoElement.oncanplay = () => {
          logger.debug(`Video can play for ${participantId}`);
          setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
        };
        
        videoElement.onerror = () => {
          const errorMessage = videoElement?.error?.message || "Unknown video error";
          logger.error(`Video element error for ${participantId}:`, errorMessage);
          setStreamErrors(prev => ({
            ...prev,
            [participantId]: errorMessage
          }));
          
          setTimeout(() => {
            if (videoElement && container.contains(videoElement)) {
              logger.info(`Attempting to recover from video error for ${participantId}`);
              
              const newVideo = document.createElement('video');
              newVideo.autoplay = true;
              newVideo.playsInline = true;
              newVideo.muted = true;
              newVideo.className = 'w-full h-full object-cover';
              newVideo.setAttribute('data-participant-id', participantId);
              
              setupVideoEventListeners(newVideo, participantId);
              
              container.replaceChild(newVideo, videoElement);
              videoElements.current[participantId] = newVideo;
              
              if (stream) {
                attachStreamToVideo(newVideo, stream, true);
              }
            }
          }, 2000);
        };
      }
      
      if (videoElement.srcObject !== stream) {
        logger.info(`Attaching stream to video element for ${participantId}`);
        
        attachStreamToVideo(videoElement, stream, true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error updating video element for ${participantId}:`, errorMessage);
      setStreamErrors(prev => ({
        ...prev,
        [participantId]: errorMessage
      }));
      
      setTimeout(() => {
        try {
          if (container) {
            while (container.firstChild) {
              container.removeChild(container.firstChild);
            }
            
            const newVideo = document.createElement('video');
            newVideo.autoplay = true;
            newVideo.playsInline = true;
            newVideo.muted = true;
            newVideo.className = 'w-full h-full object-cover';
            
            setupVideoEventListeners(newVideo, participantId);
            
            container.appendChild(newVideo);
            
            videoElements.current[participantId] = newVideo;
            
            if (stream) {
              attachStreamToVideo(newVideo, stream, true);
            }
          }
        } catch (recoveryError) {
          logger.error(`Failed to recover video element for ${participantId}:`, recoveryError);
        }
      }, 2000);
    }
  };
  
  const setupVideoEventListeners = (videoElement: HTMLVideoElement, participantId: string) => {
    videoElement.onloadedmetadata = () => {
      logger.debug(`Video metadata loaded for ${participantId}`);
      videoElement.play().catch(err => {
        logger.error(`Error playing video on metadata load:`, err);
        playVideoWithFallbacks(videoElement, participantId);
      });
    };
    
    videoElement.oncanplay = () => {
      logger.debug(`Video can play for ${participantId}`);
      setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
    };
    
    videoElement.onerror = () => {
      const errorMessage = videoElement.error?.message || "Unknown video error";
      logger.error(`Video error for ${participantId}:`, errorMessage);
      setStreamErrors(prev => ({ ...prev, [participantId]: errorMessage }));
    };
  };
  
  const playVideoWithFallbacks = (videoElement: HTMLVideoElement, participantId: string) => {
    logger.info(`Attempting to play video for ${participantId} with fallbacks`);
    
    videoElement.play()
      .then(() => {
        logger.debug(`Video playing for ${participantId}`);
        setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
      })
      .catch(err => {
        logger.error(`Initial play failed for ${participantId}:`, err);
        
        videoElement.muted = true;
        
        setTimeout(() => {
          videoElement.play()
            .then(() => {
              logger.debug(`Video playing (muted) for ${participantId}`);
            })
            .catch(err2 => {
              logger.error(`Muted play failed for ${participantId}:`, err2);
              
              videoElement.volume = 0.01;
              setTimeout(() => {
                videoElement.play()
                  .then(() => logger.debug(`Video playing (low volume) for ${participantId}`))
                  .catch(err3 => logger.error(`All play attempts failed for ${participantId}:`, err3));
              }, 1000);
            });
        }, 1000);
      });
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
    console.log(`Manually toggling selection for participant: ${id}`);
    onSelectParticipant(id);
  };

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
          <div className="relative aspect-video bg-secondary/60 rounded-md mb-3 overflow-hidden">
            <div 
              id={`participant-video-${participant.id}`}
              className="absolute inset-0 overflow-hidden"
              ref={el => {
                videoRefs.current[participant.id] = el;
                if (el && participantStreams[participant.id]) {
                  updateVideoElement(el, participantStreams[participant.id], participant.id);
                }
              }}
            >
              {!hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <User className="w-12 h-12 text-muted-foreground/50" />
                </div>
              )}
              
              {streamError && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 p-2 rounded-md">
                  <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xs text-center text-white">{streamError.substring(0, 40)}{streamError.length > 40 ? '...' : ''}</p>
                </div>
              )}
              
              <div className="absolute top-2 right-2 flex gap-1">
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
