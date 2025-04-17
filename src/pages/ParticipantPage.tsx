
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionRetryCountRef = useRef<number>(0);
  const maxConnectionRetries = 15;
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStorageChannelRef = useRef<BroadcastChannel | null>(null);
  const joinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.log(`Session ID: ${sessionId}, Participant ID: ${participantIdRef.current}`);
    
    setupLocalStorageChannel();
    
    const getVideoDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') || 
          device.label.toLowerCase().includes('frente')
        );
        
        if (frontCamera) {
          setDeviceId(frontCamera.deviceId);
        } else if (videoDevices.length > 0) {
          setDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting video devices:', error);
        toast({
          title: "Erro ao acessar câmeras",
          description: "Não foi possível listar as câmeras disponíveis.",
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
      }, 2000);
      
      joinTimeoutRef.current = fallbackTimer;
    }
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const timer = setTimeout(() => {
        startCamera();
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    return () => {
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
  }, [sessionId, toast]);

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
      }
      
      toast({
        title: "Conectado à sessão",
        description: `Você está conectado à sessão ${sessionId}.`,
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
      
      joinIntervalRef.current = joinInterval;
      
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
    }, 5000);
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
        }
      }, 5000);
    } catch (e) {
      console.warn("Error using localStorage directly:", e);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (!connected) {
        return;
      }
      
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
          }
        }, 5000);
      } catch (e) {
      }
    }, 2000);
  };

  const disconnectFromSession = () => {
    if (connected) {
      console.log(`Disconnecting from session: ${sessionId}`);
      setConnected(false);
      setTransmitting(false);
      
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'participant-leave',
            id: participantIdRef.current,
            timestamp: Date.now()
          });
          broadcastChannelRef.current.close();
          broadcastChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via BroadcastChannel:", e);
        }
      }
      
      if (localStorageChannelRef.current) {
        try {
          localStorageChannelRef.current.postMessage({
            type: 'participant-leave',
            id: participantIdRef.current,
            timestamp: Date.now()
          });
          localStorageChannelRef.current.close();
          localStorageChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via LocalStorageChannel:", e);
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
          supabaseChannelRef.current.unsubscribe();
          supabaseChannelRef.current = null;
        } catch (e) {
          console.warn("Error disconnecting via Supabase Realtime:", e);
        }
      }
      
      try {
        window.localStorage.setItem(`telao-leave-${sessionId}-${participantIdRef.current}`, Date.now().toString());
      } catch (e) {
      }
      
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
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
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    setTransmitting(true);
    console.log(`Started transmitting video to session: ${sessionId}`);
    
    const sendVideoFrame = () => {
      if (!connected) return;
      
      if (videoRef.current && videoRef.current.srcObject && broadcastChannelRef.current) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            
            broadcastChannelRef.current.postMessage({
              type: 'video-frame',
              id: participantIdRef.current,
              frame: dataUrl,
              timestamp: Date.now()
            });
          }
        } catch (e) {
          console.error('Error creating data URL:', e);
        }
      }
    };
    
    frameIntervalRef.current = setInterval(sendVideoFrame, 500);
    sendVideoFrame();
  };

  const stopTransmitting = () => {
    if (!transmitting) return;
    
    setTransmitting(false);
    console.log(`Stopped transmitting video to session: ${sessionId}`);
    
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      if (!videoRef.current) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      });
      
      videoRef.current.srcObject = stream;
      setCameraActive(true);
      
      toast({
        title: "Câmera ativada",
        description: "Sua imagem está sendo transmitida para a sessão.",
      });
      
      setTimeout(() => {
        startTransmitting();
        
        if (!connected && sessionId) {
          sendJoinMessage();
        }
      }, 500);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique se você concedeu permissão para acessar a câmera.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (!videoRef.current) return;
    
    stopTransmitting();
    
    const stream = videoRef.current.srcObject as MediaStream;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      
      toast({
        title: "Câmera desativada",
        description: "A transmissão da sua imagem foi interrompida.",
      });
    }
  };

  const switchCamera = async () => {
    if (availableDevices.length <= 1) return;
    
    stopCamera();
    
    const currentIndex = availableDevices.findIndex(device => device.deviceId === deviceId);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    const nextDeviceId = availableDevices[nextIndex].deviceId;
    
    setDeviceId(nextDeviceId);
    
    setTimeout(() => {
      startCamera();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <h1 className="text-xl font-semibold mb-4 text-white">Transmissão ao Vivo</h1>
        <p className="text-sm text-white/70 mb-6">
          Sessão: {sessionId}
        </p>
        
        <div className="w-full max-w-md aspect-video bg-secondary/40 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden relative">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="h-12 w-12 text-white/30" />
            </div>
          )}
          
          {cameraActive && transmitting && (
            <div className="absolute top-2 right-2">
              <div className="flex items-center bg-black/50 rounded-full px-2 py-1">
                <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
                <span className="text-xs text-white">AO VIVO</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-6">
          {!cameraActive ? (
            <Button 
              className="bg-accent hover:bg-accent/90 text-white"
              onClick={startCamera}
            >
              <Video className="h-4 w-4 mr-2" />
              Iniciar Câmera
            </Button>
          ) : (
            <Button 
              variant="destructive"
              onClick={stopCamera}
            >
              <VideoOff className="h-4 w-4 mr-2" />
              Parar Câmera
            </Button>
          )}
          
          {availableDevices.length > 1 && (
            <Button 
              variant="outline" 
              className="border-white/20"
              onClick={switchCamera}
              disabled={!cameraActive}
            >
              <Camera className="h-4 w-4 mr-2" />
              Trocar Câmera
            </Button>
          )}
        </div>
        
        <p className="text-xs text-white/50 mt-8 text-center">
          Mantenha esta janela aberta para continuar transmitindo sua imagem.<br />
          Sua câmera será exibida apenas quando o host incluir você na transmissão.
        </p>
        
        <div className="mt-6 flex items-center gap-2">
          <div 
            className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'}`}
          ></div>
          <span className="text-xs text-white">
            {connected ? 'Conectado à sessão' : 
             connecting ? 'Tentando conectar à sessão...' : 
             'Desconectado'}
          </span>
        </div>
        
        {connectionError && (
          <p className="text-xs text-red-400 mt-2 text-center">
            {connectionError}
          </p>
        )}
        
        {!connected && (
          <Button 
            variant="outline" 
            className="mt-4 border-white/20"
            onClick={() => {
              connectionRetryCountRef.current = 0;
              connectToSession();
              toast({
                title: "Reconectando",
                description: "Tentando conectar novamente à sessão.",
              });
            }}
            disabled={connecting}
          >
            {connecting ? 'Conectando...' : 'Reconectar'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ParticipantPage;
