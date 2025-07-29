import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { 
  User, Video, VideoOff, Crown, Shield, 
  Check, Ban, UserX, MoreVertical, X,
  Eye, EyeOff, Share, AlertTriangle, RefreshCcw
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
  isMobile?: boolean;
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
  const [streamStats, setStreamStats] = useState<{[key: string]: any}>({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);
  const videoRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  const videoElements = useRef<{[key: string]: HTMLVideoElement | null}>({});
  const streamRecoveryAttempts = useRef<{[key: string]: number}>({});
  const MAX_RECOVERY_ATTEMPTS = 3;

  // Função para forçar re-render do grid
  const forceGridUpdate = () => {
    setForceUpdateCounter(prev => prev + 1);
  };

  // FORÇAR atualização quando participantes conectam
  useEffect(() => {
    const handleStreamConnected = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log('🎬 PARTICIPANT GRID: Stream conectado - forçando re-render:', participantId);
      forceGridUpdate();
    };

    const handleParticipantJoined = (event: CustomEvent) => {
      const { participantId } = event.detail;
      console.log('👋 PARTICIPANT GRID: Participante entrou - forçando re-render:', participantId);
      forceGridUpdate();
    };

    // Escutar eventos de stream para forçar atualizações
    window.addEventListener('participant-stream-connected', handleStreamConnected as EventListener);
    window.addEventListener('participant-joined', handleParticipantJoined as EventListener);
    
    // Escutar BroadcastChannel para atualizações
    const bc = new BroadcastChannel('participant-updates');
    bc.onmessage = (event) => {
      console.log('📡 PARTICIPANT GRID: BroadcastChannel update recebido:', event.data);
      if (event.data.type === 'stream-connected') {
        forceGridUpdate();
      }
    };
    
    return () => {
      window.removeEventListener('participant-stream-connected', handleStreamConnected as EventListener);
      window.removeEventListener('participant-joined', handleParticipantJoined as EventListener);
      bc.close();
    };
  }, []);

  // 🌉 PONTE STREAM-TO-COMPONENT: Listeners para eventos de stream
  useEffect(() => {
    const handleStreamReceived = (event: CustomEvent) => {
      const { participantId: receivedParticipantId, stream: receivedStream } = event.detail;
      
      console.log(`🌉 PARTICIPANT GRID: Stream event received for ${receivedParticipantId}`, {
        hasStream: !!receivedStream,
        streamId: receivedStream?.id,
        tracks: receivedStream?.getTracks().length
      });
      
      if (receivedParticipantId && receivedStream) {
        const container = videoRefs.current[receivedParticipantId];
        if (container) {
          console.log(`🎯 GRID BRIDGE: Applying stream directly to container for ${receivedParticipantId}`);
          
          // Remover vídeo existente
          const existingVideo = container.querySelector('video');
          if (existingVideo) {
            existingVideo.remove();
          }
          
          // Criar novo elemento de vídeo
          const video = document.createElement('video');
          video.autoplay = true;
          video.playsInline = true;
          video.muted = true;
          video.controls = false;
          video.className = 'w-full h-full object-cover';
          video.style.cssText = `
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          `;
          
          video.srcObject = receivedStream;
          container.appendChild(video);
          
          // Tentar reproduzir
          video.play().then(() => {
            console.log(`✅ GRID BRIDGE: Video playing via event for ${receivedParticipantId}`);
            forceGridUpdate(); // Forçar re-render após sucesso
          }).catch(err => {
            console.log(`⚠️ GRID BRIDGE: Play failed via event for ${receivedParticipantId}:`, err);
          });
        }
      }
    };

    // Escutar eventos de stream para todos os participantes
    participants.forEach(participant => {
      const eventName = `stream-received-${participant.id}`;
      window.addEventListener(eventName, handleStreamReceived as EventListener);
      console.log(`🎧 GRID BRIDGE: Listening for ${eventName}`);
    });
    
    return () => {
      participants.forEach(participant => {
        const eventName = `stream-received-${participant.id}`;
        window.removeEventListener(eventName, handleStreamReceived as EventListener);
        console.log(`🔇 GRID BRIDGE: Cleanup listener for ${eventName}`);
      });
    };
  }, [participants]);

  // Enhanced broadcast channel listener for better stream reception
  useEffect(() => {
    if (!sessionId) return;
    
    console.log(`Setting up stream info channels for session ${sessionId}`);
    console.log(`Current participants: ${participants.length}`, participants);
    
    const channels = [];
    const cleanupFunctions = [];
    
    try {
      // Listen on multiple channels for redundancy
      const primaryChannel = new BroadcastChannel(`live-session-${sessionId}`);
      const secondaryChannel = new BroadcastChannel(`telao-session-${sessionId}`);
      const infoChannel = new BroadcastChannel(`stream-info-${sessionId}`);
      const diagnosticChannel = new BroadcastChannel(`diagnostic-${sessionId}`);
      
      channels.push(primaryChannel, secondaryChannel, infoChannel, diagnosticChannel);
      
      // Also set up localStorage monitoring for Firefox/Opera and fallback mechanisms
      const storageListener = (event: StorageEvent) => {
        if (!event.key) return;
        
        // Check for stream info in storage events
        if (event.key.startsWith(`stream-info-${sessionId}`)) {
          try {
            const data = JSON.parse(event.newValue || "{}");
            if (data.type === 'video-stream-info') {
              console.log(`Received stream info via localStorage key ${event.key}:`, data);
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
        
        // Check for fallback WebRTC signaling
        if (event.key.startsWith(`fallback-${sessionId}`)) {
          try {
            console.log(`Received fallback communication via localStorage: ${event.key}`);
            // Process fallback messages if needed
          } catch (e) {
            console.error("Error processing fallback message:", e);
          }
        }
      };
      
      window.addEventListener('storage', storageListener);
      cleanupFunctions.push(() => window.removeEventListener('storage', storageListener));
      
      // Poll localStorage directly for Firefox/Opera (they handle storage events differently)
      const checkStorageInterval = setInterval(() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            
            if (key.startsWith(`stream-info-${sessionId}`) || 
                key.startsWith(`test-${sessionId}`) ||
                key.startsWith(`diagnostic-${sessionId}`) ||
                key.startsWith(`fallback-${sessionId}`)) {
              try {
                const value = localStorage.getItem(key);
                if (!value) continue;
                
                const data = JSON.parse(value);
                
                // Process various message types
                if (data.type === 'video-stream-info') {
                  console.log(`Found video stream info in localStorage key ${key}:`, data);
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
      cleanupFunctions.push(() => clearInterval(checkStorageInterval));
      
      const handleStreamInfo = (data: any) => {
        if (!data || !data.id) return;
        
        const participantId = data.id;
        console.log(`Received stream info from ${participantId}:`, data);
        
        // Check if this participant is actually in our list
        const existingParticipant = participants.find(p => p.id === participantId);
        if (!existingParticipant) {
          console.log(`Received stream info from unknown participant ${participantId}, might be new or not loaded yet`);
        }
        
        // Update hasVideo state based on the message
        if (data.hasVideo !== undefined) {
          setHasVideoMap(prev => ({
            ...prev,
            [participantId]: data.hasVideo
          }));
          
          // Store stream stats for diagnostics
          if (data.trackIds || data.streamActive !== undefined) {
            setStreamStats(prev => ({
              ...prev,
              [participantId]: {
                ...prev[participantId],
                trackIds: data.trackIds,
                streamActive: data.streamActive,
                timestamp: data.timestamp,
                visibilityState: data.visibilityState,
                deviceInfo: data.deviceInfo,
                lastUpdated: Date.now()
              }
            }));
          }
          
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
            
            console.log(`Updating participant ${participantId} status:`, updates);
            updateParticipantStatus(sessionId, participantId, updates);
          } else {
            console.log(`Cannot find participant ${participantId} in list to update`);
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
            console.log(`Received stream info via broadcast channel for ${event.data.id || 'unknown participant'}:`, event.data);
            handleStreamInfo(event.data);
          } else if (event.data.type === 'connection-diagnostics') {
            console.log(`Received diagnostics via broadcast channel for ${event.data.participantId || 'unknown participant'}:`, event.data);
            
            // Update diagnostics information
            if (event.data.participantId) {
              setStreamStats(prev => ({
                ...prev,
                [event.data.participantId]: {
                  ...prev[event.data.participantId],
                  diagnostics: event.data,
                  lastDiagnosticUpdate: Date.now()
                }
              }));
            }
          }
        };
      });
      
      // Keep signaling the channel is active
      const heartbeatInterval = setInterval(() => {
        try {
          primaryChannel.postMessage({
            type: 'host-heartbeat',
            timestamp: Date.now()
          });
        } catch (e) {
          console.error("Error sending heartbeat:", e);
        }
      }, 5000);
      cleanupFunctions.push(() => clearInterval(heartbeatInterval));
      
      // Cleanup function to close all channels and intervals
      return () => {
        channels.forEach(channel => {
          try { channel.close(); } catch (e) { console.error("Error closing channel:", e); }
        });
        cleanupFunctions.forEach(fn => fn());
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
      
      // Periodically write host heartbeat to localStorage
      const heartbeatInterval = setInterval(() => {
        try {
          localStorage.setItem(`live-heartbeat-${sessionId}`, Date.now().toString());
        } catch (e) {
          console.error("Error setting heartbeat in localStorage:", e);
        }
      }, 5000);
      
      return () => {
        window.removeEventListener('storage', storageListener);
        clearInterval(heartbeatInterval);
      };
    }
  }, [sessionId, participants]);
  
  // Collect WebRTC stats for stream diagnostics
  const collectStreamStats = async (participantId: string, videoElement: HTMLVideoElement) => {
    try {
      const stream = videoElement.srcObject as MediaStream;
      if (!stream) return;
      
      const tracks = stream.getTracks();
      
      setStreamStats(prev => ({
        ...prev,
        [participantId]: {
          ...prev[participantId],
          tracks: tracks.map(t => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })),
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          videoReadyState: videoElement.readyState,
          lastStatsUpdate: Date.now()
        }
      }));
    } catch (e) {
      console.error(`Error collecting stats for ${participantId}:`, e);
    }
  };
  
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
      
      // Create container references for any new participants
      if (!videoRefs.current[participant.id]) {
        console.log(`Creating reference placeholder for new participant: ${participant.id}`);
      }
      
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
          console.log(`Updating video for ${participant.id} with container`, container);
          updateVideoElement(container, stream, participant.id);
        } else {
          console.log(`Container for participant ${participant.id} not found yet.`);
        }
      }
    });
  }, [participantStreams, participants]);
  
  // Schedule periodic stats collection
  useEffect(() => {
    const statsInterval = setInterval(() => {
      Object.entries(videoElements.current).forEach(([participantId, videoElement]) => {
        if (videoElement && videoElement.srcObject) {
          collectStreamStats(participantId, videoElement);
        }
      });
    }, 5000);
    
    return () => clearInterval(statsInterval);
  }, []);
  
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
        videoElement.setAttribute('data-created-at', Date.now().toString());
        
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
          if (videoElement) {
            videoElement.play().catch(err => {
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
                  
                  // After failed retry, try to recreate the element with different playback settings
                  if ((streamRecoveryAttempts.current[participantId] || 0) < MAX_RECOVERY_ATTEMPTS) {
                    streamRecoveryAttempts.current[participantId] = (streamRecoveryAttempts.current[participantId] || 0) + 1;
                    console.log(`Recovery attempt ${streamRecoveryAttempts.current[participantId]} for ${participantId}`);
                    
                    // Try a different approach after multiple failures
                    if (streamRecoveryAttempts.current[participantId] >= 2) {
                      recreateVideoElement(container, stream, participantId);
                    }
                  }
                });
              }, 1000);
            });
          }
        };
        
        // Add more event listeners for debugging
        videoElement.oncanplay = () => {
          console.log(`Video can play for ${participantId}`);
          // Clear errors when video can play
          setStreamErrors(prev => ({
            ...prev,
            [participantId]: ''
          }));
          
          // Reset recovery attempts counter on success
          streamRecoveryAttempts.current[participantId] = 0;
          
          // Collect initial stats
          collectStreamStats(participantId, videoElement);
        };
        
        videoElement.onerror = (event) => {
          const errorMessage = videoElement?.error?.message || "Unknown video error";
          console.error(`Video element error for ${participantId}:`, errorMessage);
          setStreamErrors(prev => ({
            ...prev,
            [participantId]: errorMessage
          }));
          
          // Attempt recovery for video element errors
          if ((streamRecoveryAttempts.current[participantId] || 0) < MAX_RECOVERY_ATTEMPTS) {
            streamRecoveryAttempts.current[participantId] = (streamRecoveryAttempts.current[participantId] || 0) + 1;
            console.log(`Attempting video error recovery for ${participantId} (attempt ${streamRecoveryAttempts.current[participantId]})`);
            
            setTimeout(() => {
              recreateVideoElement(container, stream, participantId);
            }, 1000);
          }
        };
      }
      
      if (videoElement.srcObject !== stream) {
        console.log(`Attaching stream to video element for ${participantId}`);
        console.log(`Stream info: active=${stream.active}, tracks=${stream.getTracks().length}`);
        
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
            
            // Reset recovery attempts counter on success
            streamRecoveryAttempts.current[participantId] = 0;
            
            // Mark participant as having video
            updateParticipantStatus(sessionId, participantId, {
              hasVideo: true,
              active: true,
              lastActive: Date.now()
            });
          })
          .catch(err => {
            console.error(`Error playing video for ${participantId}:`, err);
            setStreamErrors(prev => ({
              ...prev,
              [participantId]: `Play error: ${err.message}`
            }));
            
            // Enhanced retry logic with multiple strategies
            setTimeout(() => {
              if (videoElement) {
                // Try with muted first (browsers often allow muted autoplay)
                videoElement.muted = true;
                
                videoElement.play()
                  .then(() => console.log(`Successfully played video on retry for ${participantId}`))
                  .catch(retryErr => {
                    console.error(`Error on retry for ${participantId}:`, retryErr);
                    
                    // If still failing, try recreating the element
                    if ((streamRecoveryAttempts.current[participantId] || 0) < MAX_RECOVERY_ATTEMPTS) {
                      streamRecoveryAttempts.current[participantId] = (streamRecoveryAttempts.current[participantId] || 0) + 1;
                      console.log(`Trying video element recreation for ${participantId} (attempt ${streamRecoveryAttempts.current[participantId]})`);
                      
                      recreateVideoElement(container, stream, participantId);
                    }
                  });
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
      
      // Attempt recovery after general errors
      setTimeout(() => {
        if ((streamRecoveryAttempts.current[participantId] || 0) < MAX_RECOVERY_ATTEMPTS) {
          streamRecoveryAttempts.current[participantId] = (streamRecoveryAttempts.current[participantId] || 0) + 1;
          console.log(`Attempting general error recovery for ${participantId} (attempt ${streamRecoveryAttempts.current[participantId]})`);
          recreateVideoElement(container, stream, participantId);
        }
      }, 1000);
    }
  };

  // Function to recreate a video element from scratch with different settings
  const recreateVideoElement = (container: HTMLDivElement, stream: MediaStream, participantId: string) => {
    try {
      console.log(`Recreating video element for ${participantId} from scratch`);
      
      // Remove existing element
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Delete reference to old element
      delete videoElements.current[participantId];
      
      // Create new element with different settings
      const newVideo = document.createElement('video');
      newVideo.autoplay = true;
      newVideo.playsInline = true;
      newVideo.muted = true;
      newVideo.className = 'w-full h-full object-cover';
      newVideo.setAttribute('data-participant-id', participantId);
      newVideo.setAttribute('data-created-at', Date.now().toString());
      newVideo.setAttribute('data-recovery', 'true');
      
      // Try with low latency and different video rendering modes
      newVideo.style.objectFit = 'contain'; // Try different object-fit mode
      
      // Store new reference
      videoElements.current[participantId] = newVideo;
      
      // Add to container
      container.appendChild(newVideo);
      
      // Set stream
      newVideo.srcObject = stream;
      
      // Try to play with minimal settings
      newVideo.onloadedmetadata = () => {
        console.log(`Recovered video metadata loaded for ${participantId}`);
        newVideo.play()
          .then(() => console.log(`Recovered video playing for ${participantId}`))
          .catch(e => console.error(`Recovered video playback error for ${participantId}:`, e));
      };
      
      newVideo.oncanplay = () => {
        console.log(`Recovered video can play for ${participantId}`);
        setStreamErrors(prev => ({ ...prev, [participantId]: '' }));
      };
      
      newVideo.onerror = (e) => {
        console.error(`Recovered video error for ${participantId}:`, newVideo.error);
      };
      
      // Try playing immediately
      newVideo.play().catch(e => {
        console.log(`Initial play for recovered video failed for ${participantId}:`, e);
      });
    } catch (e) {
      console.error(`Error during video element recreation for ${participantId}:`, e);
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

  // Function to manually refresh a participant's video
  const handleRefreshVideo = (participantId: string) => {
    console.log(`Manually refreshing video for ${participantId}`);
    
    const container = videoRefs.current[participantId];
    const stream = participantStreams[participantId];
    
    if (container && stream) {
      toast({
        title: "Atualizando vídeo",
        description: "Tentando atualizar o vídeo do participante"
      });
      
      // Force recreation of video element
      recreateVideoElement(container, stream, participantId);
    } else {
      toast({
        title: "Não foi possível atualizar",
        description: "Stream ou container de vídeo não disponível",
        variant: "destructive"
      });
    }
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
    const diagnosticInfo = streamStats[participant.id] || {};
    
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
                  console.log(`Setting up video element for ${participant.id} with existing stream`);
                  updateVideoElement(el, participantStreams[participant.id], participant.id);
                } else if (el) {
                  console.log(`Video container ready for ${participant.id}, but no stream available yet`);
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
            
            {/* Stream error indicator with refresh option */}
            {streamError && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 p-2 rounded-md">
                <div className="flex flex-col items-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                  <p className="text-xs text-center text-white mb-2">
                    {streamError.substring(0, 40)}{streamError.length > 40 ? '...' : ''}
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshVideo(participant.id);
                    }}
                  >
                    <RefreshCcw className="h-3 w-3 mr-1" />
                    Atualizar
                  </Button>
                </div>
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
              
              <Button
                size="icon"
                variant="outline" 
                className="h-8 w-8"
                onClick={() => handleRefreshVideo(participant.id)}
                title="Atualizar vídeo"
              >
                <RefreshCcw className="h-4 w-4" />
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
          
          {/* Advanced diagnostic info (hidden by default) */}
          {showDiagnostics && diagnosticInfo && (
            <div className="mt-2 p-2 bg-secondary/30 rounded text-xs overflow-hidden">
              <p className="font-mono truncate">
                {diagnosticInfo.videoWidth}x{diagnosticInfo.videoHeight} {diagnosticInfo.tracks?.length || 0} tracks
              </p>
              {diagnosticInfo.lastStatsUpdate && (
                <p className="text-muted-foreground">
                  Updated {formatTimeSince(diagnosticInfo.lastStatsUpdate)} ago
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">
          {participants.length} Participantes
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowDiagnostics(!showDiagnostics)}
        >
          {showDiagnostics ? 'Ocultar' : 'Mostrar'} diagnósticos
        </Button>
      </div>
      
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
