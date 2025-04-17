import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { initParticipantWebRTC, setLocalStream } from '@/utils/webrtc';

const ParticipantPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { toast } = useToast();
  const participantIdRef = useRef<string>(Math.random().toString(36).substr(2, 9));
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const connectionRetryCountRef = useRef<number>(0);
  const maxConnectionRetries = 15;
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const joinIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const joinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localStorageChannelRef = useRef<BroadcastChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pageVisibilityRef = useRef<boolean>(true);
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      pageVisibilityRef.current = isVisible;
      
      console.log(`Page visibility changed to ${isVisible ? 'visible' : 'hidden'}`);
      
      if (isVisible && connected && !transmitting && cameraActive) {
        console.log("Page became visible again, restarting transmission");
        if (streamRef.current && sessionId) {
          initWebRTC(streamRef.current);
        }
      }
      
      if (!isVisible && connected) {
        console.log("Page hidden, sending keep-alive heartbeat");
        sendHeartbeat();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connected, transmitting, cameraActive, sessionId]);

  useEffect(() => {
    if (cameraActive && streamRef.current) {
      const cameraCheckInterval = setInterval(() => {
        if (streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks();
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            
            if (!track.enabled || track.readyState !== 'live') {
              console.log("Camera track is not in optimal state, attempting recovery", track.readyState);
              
              track.enabled = true;
              
              setTimeout(() => {
                if (!track.enabled || track.readyState !== 'live') {
                  console.log("Failed to recover camera track, restarting camera");
                  stopCamera();
                  setTimeout(() => startCamera(), 500);
                }
              }, 1000);
            }
          } else {
            console.log("No video tracks found, restarting camera");
            stopCamera();
            setTimeout(() => startCamera(), 500);
          }
        }
      }, 5000);
      
      return () => clearInterval(cameraCheckInterval);
    }
  }, [cameraActive]);

  useEffect(() => {
    if (isMobileDevice) {
      const checkInterval = setInterval(() => {
        if (cameraActive && streamRef.current) {
          const videoTracks = streamRef.current.getVideoTracks();
          if (videoTracks.length > 0) {
            const track = videoTracks[0];
            if (!track.enabled || track.readyState !== 'live') {
              console.log("Video track is disabled or not live, attempting to restart camera");
              stopCamera();
              setTimeout(() => startCamera(), 500);
            }
          }
        }
      }, 5000);
      
      return () => clearInterval(checkInterval);
    }
  }, [cameraActive, isMobileDevice]);

  useEffect(() => {
    console.log(`Session ID: ${sessionId}, Participant ID: ${participantIdRef.current}`);
    
    setupLocalStorageChannel();
    
    const getVideoDevices = async () => {
      try {
        await ensureMediaPermissions();
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        
        if (isMobileDevice) {
          const backCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('traseira') ||
            device.label.toLowerCase().includes('rear')
          );
          
          const frontCamera = videoDevices.find(device => 
            device.label.toLowerCase().includes('front') || 
            device.label.toLowerCase().includes('frente')
          );
          
          if (backCamera) {
            setDeviceId(backCamera.deviceId);
          } else if (frontCamera) {
            setDeviceId(frontCamera.deviceId);
          } else if (videoDevices.length > 0) {
            setDeviceId(videoDevices[0].deviceId);
          }
        } else {
          if (videoDevices.length > 0) {
            setDeviceId(videoDevices[0].deviceId);
          }
        }
      } catch (error) {
        console.error('Error getting video devices:', error);
        toast({
          title: "Erro ao acessar câmeras",
          description: "Não foi possível listar as câmeras disponíveis. Verifique as permissões.",
          variant: "destructive"
        });
      }
    };

    getVideoDevices();
    
    if (sessionId) {
      connectToSession();
      
      const fallbackTimer = setTimeout(() => {
        if (!connected) {
          console.log("Connection not established, retrying...");
          connectToSession();
        }
      }, 2000) as unknown as NodeJS.Timeout;
      
      joinTimeoutRef.current = fallbackTimer;
    }
    
    if (isMobileDevice) {
      const timer = setTimeout(() => {
        startCamera();
      }, 1000) as unknown as NodeJS.Timeout;
      
      return () => clearTimeout(timer);
    }
    
    return () => {
      if (connected && sessionId) {
        sendDisconnectMessage();
      }
      
      if (cameraActive) {
        stopCamera();
      }
      
      disconnectFromSession();
      
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      
      if (joinIntervalRef.current) {
        clearInterval(joinIntervalRef.current);
        joinIntervalRef.current = null;
      }
      
      if (connectionTimerRef.current) {
        clearTimeout(connectionTimerRef.current);
        connectionTimerRef.current = null;
      }
      
      if (localStorageChannelRef.current) {
        localStorageChannelRef.current.close();
      }
      
      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.unsubscribe();
      }
    };
  }, [sessionId, toast, isMobileDevice]);

  const ensureMediaPermissions = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      tempStream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error("Error requesting media permissions:", error);
      return false;
    }
  };

  const setupLocalStorageChannel = () => {
    try {
      const localChannel = new BroadcastChannel(`telao-local-${sessionId}`);
      localStorageChannelRef.current = localChannel;
      
      localChannel.onmessage = (event) => {
        const data = event.data;
        handleChannelMessage(data);
      };
      
      console.log("Local storage channel set up successfully");
    } catch (error) {
      console.error("Error creating local storage channel:", error);
    }
  };

  const handleChannelMessage = (data: any) => {
    if (data.type === 'host-acknowledge' && data.participantId === participantIdRef.current) {
      console.log("Connection acknowledged by host");
      setConnected(true);
      setConnecting(false);
      setConnectionError(null);
      connectionRetryCountRef.current = 0;
      
      startHeartbeat();
      
      if (!cameraActive) {
        startCamera();
      } else if (streamRef.current && sessionId) {
        initWebRTC(streamRef.current);
      }
      
      toast({
        title: "Conectado à sessão",
        description: `Você está conectado à sessão ${sessionId}.`,
      });
    }
  };

  const initWebRTC = async (stream: MediaStream) => {
    if (!sessionId) return;
    
    console.log("Initializing WebRTC connection with H.264 codec preference");
    setLocalStream(stream);
    
    try {
      await initParticipantWebRTC(
        sessionId,
        participantIdRef.current,
        stream
      );
      console.log("WebRTC initialized successfully");
      setTransmitting(true);
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      toast({
        title: "Erro na conexão de vídeo",
        description: "Não foi possível estabelecer a conexão de vídeo. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const connectToSession = () => {
    if (!sessionId) return;
    
    setConnecting(true);
    setConnectionError(null);
    
    console.log(`Connecting to session: ${sessionId}, attempt ${connectionRetryCountRef.current + 1}`);
    
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
    }
    
    if (joinIntervalRef.current) {
      clearInterval(joinIntervalRef.current);
      joinIntervalRef.current = null;
    }
    
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
    
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.unsubscribe();
    }
    
    try {
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      broadcastChannelRef.current = channel;
      
      channel.onmessage = (event) => {
        handleChannelMessage(event.data);
      };
      
      sendJoinMessage();
      
      const joinInterval = setInterval(() => {
        if (!connected) {
          console.log("Sending join message...");
          sendJoinMessage();
          
          try {
            const timestamp = Date.now();
            window.localStorage.setItem(`telao-join-${sessionId}`, JSON.stringify({
              type: 'participant-join',
              id: participantIdRef.current,
              timestamp: timestamp
            }));
            
            setTimeout(() => {
              try {
                window.localStorage.removeItem(`telao-join-${sessionId}`);
              } catch (e) {
                // Ignore errors
              }
            }, 5000);
          } catch (e) {
            console.warn("Could not use localStorage for fallback communication", e);
          }
        } else {
          clearInterval(joinInterval);
          joinIntervalRef.current = null;
        }
      }, 1000);
      
      joinIntervalRef.current = joinInterval as unknown as NodeJS.Timeout;
      
      setTimeout(() => {
        if (joinIntervalRef.current) {
          clearInterval(joinIntervalRef.current);
          joinIntervalRef.current = null;
        }
      }, 30000);
    } catch (error) {
      console.error("Error creating broadcast channel:", error);
    }
    
    try {
      const channel = supabase.channel(`session-${sessionId}`)
        .on('broadcast', { event: 'message' }, (payload) => {
          if (payload.payload.type === 'host-acknowledge' && 
              payload.payload.participantId === participantIdRef.current) {
            console.log("Connection acknowledged via Supabase Realtime");
            setConnected(true);
            setConnecting(false);
            setConnectionError(null);
            startHeartbeat();
            
            if (!cameraActive) {
              startCamera();
            } else if (streamRef.current && sessionId) {
              initWebRTC(streamRef.current);
            }
            
            toast({
              title: "Conectado à sessão",
              description: `Você está conectado à sessão ${sessionId} (via Supabase).`,
            });
          }
        })
        .subscribe((status) => {
          console.log("Supabase channel status:", status);
          if (status === 'SUBSCRIBED') {
            sendJoinMessage();
            
            const supabaseJoinInterval = setInterval(() => {
              if (!connected) {
                channel.send({
                  type: 'broadcast',
                  event: 'message',
                  payload: {
                    type: 'participant-join',
                    id: participantIdRef.current,
                    timestamp: Date.now()
                  }
                });
              } else {
                clearInterval(supabaseJoinInterval);
              }
            }, 2000);
            
            setTimeout(() => clearInterval(supabaseJoinInterval), 30000);
          }
        });
      
      supabaseChannelRef.current = channel;
    } catch (e) {
      console.warn("Supabase Realtime connection failed", e);
    }
    
    try {
      const checkLocalStorage = setInterval(() => {
        if (!connected) {
          try {
            const ackKey = `telao-ack-${sessionId}-${participantIdRef.current}`;
            const response = window.localStorage.getItem(ackKey);
            if (response) {
              console.log("Got acknowledgment via localStorage");
              window.localStorage.removeItem(ackKey);
              clearInterval(checkLocalStorage);
              
              setConnected(true);
              setConnecting(false);
              setConnectionError(null);
              startHeartbeat();
              
              if (!cameraActive) {
                startCamera();
              } else if (streamRef.current && sessionId) {
                initWebRTC(streamRef.current);
              }
              
              toast({
                title: "Conectado à sessão",
                description: `Você está conectado à sessão ${sessionId} (modo alternativo).`,
              });
            }
          } catch (e) {
            // Ignore errors
          }
        } else {
          clearInterval(checkLocalStorage);
        }
      }, 1000);
      
      setTimeout(() => {
        clearInterval(checkLocalStorage);
      }, 30000);
    } catch (e) {
      console.warn("LocalStorage checking failed", e);
    }
    
    connectionTimerRef.current = setTimeout(() => {
      if (!connected) {
        console.log(`Connection attempt ${connectionRetryCountRef.current + 1} timed out`);
        
        if (connectionRetryCountRef.current < maxConnectionRetries) {
          connectionRetryCountRef.current++;
          setConnecting(false);
          setConnectionError(`Tentativa ${connectionRetryCountRef.current} falhou. Tentando novamente...`);
          
          setTimeout(() => {
            connectToSession();
          }, 1000);
        } else {
          setConnecting(false);
          setConnectionError("Não foi possível conectar após várias tentativas. Verifique sua conexão ou tente gerar um novo QR Code.");
          
          toast({
            title: "Erro de conexão",
            description: "Não foi possível conectar à sessão. Por favor, tente novamente ou gere um novo QR Code.",
            variant: "destructive"
          });
        }
      }
    }, 5000) as unknown as NodeJS.Timeout;
  };

  const sendJoinMessage = () => {
    if (broadcastChannelRef.current) {
      try {
        console.log("Sending join message via BroadcastChannel");
        broadcastChannelRef.current.postMessage({
          type: 'participant-join',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending via BroadcastChannel:", e);
      }
    }
    
    if (localStorageChannelRef.current) {
      try {
        console.log("Sending join message via LocalStorageChannel");
        localStorageChannelRef.current.postMessage({
          type: 'participant-join',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending via LocalStorageChannel:", e);
      }
    }
    
    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            type: 'participant-join',
            id: participantIdRef.current,
            timestamp: Date.now()
          }
        });
      } catch (e) {
        console.warn("Error sending via Supabase Realtime:", e);
      }
    }
    
    try {
      window.localStorage.setItem(`telao-join-${sessionId}-${Date.now()}`, JSON.stringify({
        type: 'participant-join',
        id: participantIdRef.current,
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        try {
          window.localStorage.removeItem(`telao-join-${sessionId}-${Date.now()}`);
        } catch (e) {
          // Ignore errors
        }
      }, 5000);
    } catch (e) {
      console.warn("Error using localStorage directly:", e);
    }
  };

  const sendDisconnectMessage = () => {
    console.log(`Sending explicit disconnect message for ${participantIdRef.current}`);
    
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'participant-leave',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending disconnect via BroadcastChannel:", e);
      }
    }
    
    if (localStorageChannelRef.current) {
      try {
        localStorageChannelRef.current.postMessage({
          type: 'participant-leave',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending disconnect via LocalStorageChannel:", e);
      }
    }
    
    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            type: 'participant-leave',
            id: participantIdRef.current,
            timestamp: Date.now()
          }
        });
      } catch (e) {
        console.warn("Error sending disconnect via Supabase Realtime:", e);
      }
    }
    
    try {
      window.localStorage.setItem(`telao-leave-${sessionId}-${participantIdRef.current}`, JSON.stringify({
        type: 'participant-leave',
        id: participantIdRef.current,
        timestamp: Date.now()
      }));
      
      setTimeout(() => {
        try {
          window.localStorage.removeItem(`telao-leave-${sessionId}-${participantIdRef.current}`);
        } catch (e) {
          // Ignore errors
        }
      }, 10000);
    } catch (e) {
      console.warn("Error using localStorage for disconnect:", e);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (!connected) {
        return;
      }
      
      sendHeartbeat();
    }, 2000);
  };
  
  const sendHeartbeat = () => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'participant-heartbeat',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending heartbeat via BroadcastChannel:", e);
      }
    }
    
    if (localStorageChannelRef.current) {
      try {
        localStorageChannelRef.current.postMessage({
          type: 'participant-heartbeat',
          id: participantIdRef.current,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Error sending heartbeat via LocalStorageChannel:", e);
      }
    }
    
    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'message',
          payload: {
            type: 'participant-heartbeat',
            id: participantIdRef.current,
            timestamp: Date.now()
          }
        });
      } catch (e) {
        console.warn("Error sending heartbeat via Supabase Realtime:", e);
      }
    }
    
    try {
      window.localStorage.setItem(`telao-heartbeat-${sessionId}-${participantIdRef.current}`, Date.now().toString());
      
      setTimeout(() => {
        try {
          window.localStorage.removeItem(`telao-heartbeat-${sessionId}-${participantIdRef.current}`);
        } catch (e) {
          // Ignore errors
        }
      }, 5000);
    } catch (e) {
      // Ignore errors
    }
  };

  const disconnectFromSession = () => {
    if (connected) {
      console.log(`Disconnecting from session: ${sessionId}`);
      sendDisconnectMessage();
      
      setConnected(false);
      setTransmitting(false);
      
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via BroadcastChannel:", e);
        }
      }
      
      if (localStorageChannelRef.current) {
        try {
          localStorageChannelRef.current.close();
          localStorageChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via LocalStorageChannel:", e);
        }
      }
      
      if (supabaseChannelRef.current) {
        try {
          supabaseChannelRef.current.unsubscribe();
          supabaseChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via Supabase Realtime:", e);
        }
      }
      
      try {
        window.localStorage.setItem(`telao-leave-${sessionId}-${participantIdRef.current}`, JSON.stringify({
          type: 'participant-leave',
          id: participantIdRef.current,
          timestamp: Date.now()
        }));
        
        window.localStorage.removeItem(`telao-heartbeat-${sessionId}-${participantIdRef.current}`);
      } catch (e) {
        // Ignore errors
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      if (joinIntervalRef.current) {
        clearInterval(joinIntervalRef.current);
        joinIntervalRef.current = null;
      }
    }
  };

  const startTransmitting = () => {
    if (!connected || !cameraActive) return;
    setTransmitting(true);
    console.log(`Started transmitting video to session: ${sessionId}`);

    toast({
      title: "Transmissão iniciada",
      description: "Sua imagem está sendo transmitida para a sessão com melhor qualidade (H.264).",
    });
  };

  const stopTransmitting = () => {
    if (!transmitting) return;
    setTransmitting(false);
    console.log(`Stopped transmitting video to session: ${sessionId}`);
    
    toast({
      title: "Transmissão interrompida",
      description: "Sua imagem não está mais sendo transmitida para a sessão.",
    });
  };

  const startCamera = async () => {
    try {
      if (!videoRef.current) return;
      
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: isMobileDevice ? "environment" : "user"
        },
        audio: false
      };
      
      console.log("Requesting camera with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      stream.getTracks().forEach(track => {
        if (track.kind === 'video') {
          const videoTrack = track as MediaStreamTrack;
          if (videoTrack.getConstraints) {
            try {
              videoTrack.applyConstraints({
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { min: 24, ideal: 30 },
              }).catch(e => console.warn('Could not apply additional constraints:', e));
            } catch (e) {
              console.warn('Error applying additional constraints:', e);
            }
          }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.WebkitBackfaceVisibility = 'hidden';
        videoRef.current.style.WebkitTransform = 'translateZ(0)';
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transformStyle = 'preserve-3d';
        
        videoRef.current.oncanplay = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .catch(err => console.warn('Error playing video:', err));
          }
        };
        
        const videoRefreshInterval = setInterval(() => {
          if (videoRef.current && streamRef.current && streamRef.current.active) {
            const videoTracks = streamRef.current.getVideoTracks();
            if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
              const currentTime = videoRef.current.currentTime;
              videoRef.current.currentTime = currentTime + 0.00001;
            }
          }
        }, 2000);
        
        return () => clearInterval(videoRefreshInterval);
      }
      
      streamRef.current = stream;
      setCameraActive(true);
      
      toast({
        title: "Câmera ativada",
        description: "Sua imagem está sendo transmitida para a sessão com melhor qualidade (H.264).",
      });
      
      if (connected && sessionId) {
        await initWebRTC(stream);
      }
      
      setTimeout(() => {
        if (connected) {
          startTransmitting();
        }
        
        if (!connected && sessionId) {
          sendJoinMessage();
        }
      }, 500);
      
      const videoInfoInterval = setInterval(() => {
        if (stream && sessionId && connected) {
          sendVideoStreamInfo(stream);
        }
      }, 2000);
      
      try {
        if (isMobileDevice && 'wakeLock' in navigator) {
          const wakeLock = await navigator.wakeLock.request('screen');
          console.log("Wake Lock acquired to keep screen on");
          
          const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              navigator.wakeLock.request('screen')
                .then(() => console.log("Wake Lock re-acquired"))
                .catch(err => console.warn("Failed to re-acquire Wake Lock:", err));
            }
          };
          
          document.addEventListener('visibilitychange', handleVisibilityChange);
          
          return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(videoInfoInterval);
            wakeLock.release()
              .then(() => console.log("Wake Lock released"))
              .catch(err => console.warn("Failed to release Wake Lock:", err));
          };
        }
        
        return () => {
          clearInterval(videoInfoInterval);
        };
      } catch (err) {
        console.warn("Wake Lock API not supported or failed:", err);
        return () => {
          clearInterval(videoInfoInterval);
        };
      }
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique se você concedeu permissão para acessar a câmera.",
        variant: "destructive"
      });
    }
  };

  const sendVideoStreamInfo = (stream: MediaStream) => {
    if (!stream || !sessionId) return;
    
    const videoTracks = stream.getVideoTracks();
    const videoTrackInfo = videoTracks.map(track => ({
      id: track.id,
      enabled: track.enabled,
      readyState: track.readyState,
      kind: track.kind,
      label: track.label
    }));
    
    const streamInfo = {
      type: 'video-stream-info',
      id: participantIdRef.current,
      name: `Participante ${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      hasStream: true,
      videoTracks: videoTrackInfo,
      audioTrackCount: stream.getAudioTracks().length
    };
    
    console.log('Sending video stream info:', streamInfo);
    
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(streamInfo);
      } catch (e) {
        console.warn("Error sending stream info via BroadcastChannel:", e);
      }
    }
    
    if (localStorageChannelRef.current) {
      try {
        localStorageChannelRef.current.postMessage(streamInfo);
      } catch (e) {
        console.warn("Error sending stream info via LocalStorageChannel:", e);
      }
    }
    
    try {
      localStorage.setItem(`telao-stream-info-${sessionId}-${participantIdRef.current}`, JSON.stringify(streamInfo));
      
      setTimeout(() => {
        try {
          localStorage.removeItem(`telao-stream-info-${sessionId}-${participantIdRef.current}`);
        } catch (e) {
          // Ignore errors
        }
      }, 10000);
    } catch (e) {
      console.warn("Error using localStorage for stream info:", e);
    }
  };

  const stopCamera = () => {
    if (!cameraActive) return;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
    setTransmitting(false);
    
    console.log('Camera stopped');
  };

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const switchCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.log("MediaDevices API not supported");
      return;
    }
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length <= 1) {
        toast({
          title: "Só há uma câmera disponível",
          description: "Não foram encontradas outras câmeras para alternar.",
        });
        return;
      }
      
      const currentIndex = videoDevices.findIndex(device => device.deviceId === deviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDeviceId = videoDevices[nextIndex].deviceId;
      
      stopCamera();
      
      setDeviceId(nextDeviceId);
      
      setTimeout(() => {
        startCamera();
      }, 300);
      
      console.log(`Switched camera to device ${nextIndex + 1} of ${videoDevices.length}`);
      
      toast({
        title: `Câmera alterada (${nextIndex + 1}/${videoDevices.length})`,
        description: `${videoDevices[nextIndex].label || 'Câmera desconhecida'}`,
      });
    } catch (error) {
      console.error('Error switching camera:', error);
      toast({
        title: "Erro ao alternar câmera",
        description: "Não foi possível alternar entre as câmeras.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      {!connected && !connecting && (
        <div className="text-white text-center mb-4">
          <h1 className="text-2xl font-bold mb-2">Conecte-se a uma Sessão</h1>
          <p>Escaneie o QR code na tela principal para se conectar.</p>
          {connectionError && <p className="text-red-400 mt-2">{connectionError}</p>}
          <Button 
            className="mt-4"
            onClick={() => connectToSession()}
          >
            Tentar Conectar
          </Button>
        </div>
      )}
      
      {connecting && !connected && (
        <div className="text-white text-center mb-4">
          <h1 className="text-2xl font-bold mb-2">Conectando...</h1>
          <p>Aguarde enquanto nos conectamos à sessão {sessionId}.</p>
          {connectionError && <p className="text-red-400 mt-2">{connectionError}</p>}
          <div className="mt-4 w-8 h-8 border-t-2 border-accent animate-spin rounded-full mx-auto"></div>
        </div>
      )}
      
      {connected && (
        <div className="text-white text-center mb-4">
          <h1 className="text-2xl font-bold mb-2">Conectado à Sessão</h1>
          <p className="mb-4">Sua imagem está sendo transmitida em tempo real!</p>
        </div>
      )}
      
      <div className="relative w-full max-w-md aspect-[9/16] mb-6 rounded-xl overflow-hidden bg-gray-900">
        <video 
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
          autoPlay 
          playsInline
          muted
        />
        
        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
            <p className="text-white text-lg">Clique para ativar a câmera</p>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap gap-4 justify-center">
        <Button
          size="lg"
          variant={cameraActive ? "destructive" : "default"}
          className="flex items-center gap-2"
          onClick={toggleCamera}
        >
          {cameraActive ? <VideoOff size={20} /> : <Video size={20} />}
          {cameraActive ? "Desativar Câmera" : "Ativar Câmera"}
        </Button>
        
        {cameraActive && (
          <Button
            size="lg"
            variant="secondary"
            className="flex items-center gap-2"
            onClick={switchCamera}
          >
            <Camera size={20} />
            Mudar Câmera
          </Button>
        )}
      </div>
    </div>
  );
};

export default ParticipantPage;
