import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Camera, User, VideoOff, Loader2, X, ChevronRight, CheckSquare, Tv2 } from "lucide-react";
import { isSessionActive, addParticipantToSession, getSessionFinalAction } from '@/utils/sessionUtils';
import { initParticipantWebRTC, setLocalStream, cleanupWebRTC } from '@/utils/webrtc';
import { initializeParticipantSession } from '@/utils/liveStreamUtils';

const ParticipantPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participantId, setParticipantId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [sessionFound, setSessionFound] = useState<boolean | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWebcam, setHasWebcam] = useState(true);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [autoJoin, setAutoJoin] = useState(true); // Always set to true by default
  const [finalAction, setFinalAction] = useState<{
    type: 'none' | 'image' | 'coupon';
    image?: string;
    link?: string;
    coupon?: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const autoJoinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraStartAttempts = useRef<number>(0);

  // Generate a unique participant ID on component mount
  useEffect(() => {
    const newParticipantId = `participant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setParticipantId(newParticipantId);
    console.log("Generated participant ID:", newParticipantId);
    
    // Check if session exists
    checkSession();

    // Check for camera availability
    checkCameraAvailability();

    // Always set autoJoin to true, ignoring URL parameters
    setAutoJoin(true);

    return () => {
      cleanupResources();
    };
  }, []);

  // Auto-join if enabled
  useEffect(() => {
    if (sessionFound && autoJoin && !isJoined && !isJoining && cameraPermission !== null) {
      // Use a short timeout to ensure everything is initialized
      autoJoinTimeoutRef.current = setTimeout(() => {
        console.log("Auto-joining session...");
        joinSession(false); // Don't show toast on auto-join
      }, 500); // Reduced timeout to join faster
    }
    
    return () => {
      if (autoJoinTimeoutRef.current) {
        clearTimeout(autoJoinTimeoutRef.current);
      }
    };
  }, [sessionFound, autoJoin, isJoined, isJoining, cameraPermission]);

  // When joined, get session final action
  useEffect(() => {
    if (isJoined && sessionId) {
      const sessionFinalAction = getSessionFinalAction(sessionId);
      if (sessionFinalAction) {
        setFinalAction(sessionFinalAction);
      }
    }
  }, [isJoined, sessionId]);

  // Retry checking session a few times in case of race conditions
  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 5; // Increased max checks for better reliability
    
    const retrySessionCheck = () => {
      if (sessionFound === false && checkCount < maxChecks) {
        checkCount++;
        console.log(`Retrying session check (${checkCount}/${maxChecks})...`);
        setTimeout(() => {
          checkSession(false); // Don't show toast on retries
        }, 1000 * checkCount); // Increasing delay between retries
      }
    };
    
    if (sessionFound === false) {
      retrySessionCheck();
    }
  }, [sessionFound]);

  // Attempt to restart camera if it fails initially
  useEffect(() => {
    if (isJoined && isCameraActive && !videoStream && cameraStartAttempts.current < 3) {
      console.log("Camera should be active but no stream, attempting restart...");
      const restartTimeout = setTimeout(() => {
        cameraStartAttempts.current += 1;
        startCamera(true); // Force restart
      }, 1000);
      
      return () => clearTimeout(restartTimeout);
    }
  }, [isJoined, isCameraActive, videoStream]);

  // Force camera restart if video element is not displaying properly
  useEffect(() => {
    if (videoStream && videoRef.current) {
      // Check if video is actually playing
      const checkVideoPlaying = () => {
        if (videoRef.current && 
            (videoRef.current.readyState < 2 || 
             videoRef.current.paused || 
             videoRef.current.videoWidth === 0)) {
          console.log("Video not playing properly, restarting camera");
          startCamera(true); // Force restart
        }
      };
      
      // Check video playing status after a short delay
      const videoCheckTimeout = setTimeout(checkVideoPlaying, 2000);
      return () => clearTimeout(videoCheckTimeout);
    }
  }, [videoStream]);

  // Send video stream info to broadcast channels
  useEffect(() => {
    if (isJoined && sessionId && videoStream) {
      const sendVideoStreamInfo = () => {
        try {
          // Send stream information through broadcast channels
          const channel = new BroadcastChannel(`live-session-${sessionId}`);
          const backupChannel = new BroadcastChannel(`telao-session-${sessionId}`);
          
          const streamInfo = {
            type: 'video-stream-info',
            id: participantId,
            hasStream: true,
            trackIds: videoStream.getTracks().map(track => track.id),
            timestamp: Date.now()
          };
          
          channel.postMessage(streamInfo);
          backupChannel.postMessage(streamInfo);
          
          setTimeout(() => {
            channel.close();
            backupChannel.close();
          }, 500);
        } catch (e) {
          console.error("Error sending stream info:", e);
        }
      };
      
      // Send initial stream info
      sendVideoStreamInfo();
      
      // Set up interval to keep sending stream info
      const streamInfoInterval = setInterval(sendVideoStreamInfo, 5000);
      
      return () => clearInterval(streamInfoInterval);
    }
  }, [isJoined, sessionId, videoStream, participantId]);

  const checkSession = async (showToast = true) => {
    setIsLoading(true);
    try {
      if (!sessionId) {
        setSessionFound(false);
        if (showToast) {
          toast({
            title: "Sessão não encontrada",
            description: "O ID da sessão não foi fornecido.",
            variant: "destructive",
          });
        }
        return;
      }

      console.log("Checking if session is active:", sessionId);
      
      // First try BroadcastChannel to check for host heartbeat
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        const backupChannel = new BroadcastChannel(`live-session-${sessionId}-backup`);
        
        // Listen for host heartbeat
        let heartbeatReceived = false;
        const heartbeatHandler = () => {
          heartbeatReceived = true;
          channel.close();
          backupChannel.close();
          setSessionFound(true);
          setIsLoading(false);
        };
        
        channel.onmessage = (event) => {
          if (event.data.type === 'host-heartbeat') {
            heartbeatHandler();
          }
        };
        
        backupChannel.onmessage = (event) => {
          if (event.data.type === 'host-heartbeat') {
            heartbeatHandler();
          }
        };
        
        // Send ping to request an immediate response
        channel.postMessage({ type: 'ping', timestamp: Date.now() });
        backupChannel.postMessage({ type: 'ping', timestamp: Date.now() });
        
        // Check localStorage for heartbeat too
        try {
          const localStorageHeartbeat = localStorage.getItem(`live-heartbeat-${sessionId}`);
          if (localStorageHeartbeat) {
            const timestamp = parseInt(localStorageHeartbeat);
            // If heartbeat is less than 30 seconds old, consider session active
            if (Date.now() - timestamp < 30000) {
              heartbeatHandler();
              return;
            }
          }
        } catch (e) {
          console.warn("Error checking localStorage heartbeat:", e);
        }
        
        // If no immediate response, wait a short time
        setTimeout(() => {
          if (!heartbeatReceived) {
            // Fall back to checking via sessionUtils
            const isActive = isSessionActive(sessionId);
            console.log("Session active from storage check:", isActive);
            setSessionFound(isActive);
            
            if (!isActive && showToast) {
              toast({
                title: "Sessão não encontrada",
                description: "A sessão não existe ou expirou.",
                variant: "destructive",
              });
            }
            setIsLoading(false);
            
            channel.close();
            backupChannel.close();
          }
        }, 2000);
      } catch (broadcastError) {
        console.error("BroadcastChannel error:", broadcastError);
        // Fall back to storage check
        const isActive = isSessionActive(sessionId);
        console.log("Session active from storage check:", isActive);
        setSessionFound(isActive);
        
        if (!isActive && showToast) {
          toast({
            title: "Sessão não encontrada",
            description: "A sessão não existe ou expirou.",
            variant: "destructive",
          });
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error checking session:", error);
      setSessionFound(false);
      if (showToast) {
        toast({
          title: "Erro ao verificar sessão",
          description: "Não foi possível verificar se a sessão existe.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }
  };

  const checkCameraAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
      setHasWebcam(hasVideoDevices);
      console.log("Camera availability:", hasVideoDevices);

      if (hasVideoDevices) {
        try {
          // We actually need to start the camera to properly check permission
          // and to ensure it's ready for the auto-join
          const testStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user"
            },
            audio: false 
          });
          setCameraPermission(true);
          
          // Keep this stream for later use
          setVideoStream(testStream);
          setIsCameraActive(true);
          
          // Set video element source
          if (videoRef.current) {
            videoRef.current.srcObject = testStream;
            videoRef.current.play().catch(err => {
              console.error("Error playing initial video:", err);
            });
            console.log("Preview camera stream set successfully");
          } else {
            console.warn("Video element ref not available yet");
          }
        } catch (error) {
          console.error("Camera permission denied:", error);
          setCameraPermission(false);
        }
      } else {
        setCameraPermission(false);
      }
    } catch (error) {
      console.error("Error checking camera:", error);
      setCameraPermission(false);
      setHasWebcam(false);
    }
  };

  const startCamera = async (forceRestart = false) => {
    try {
      // Stop any existing stream if force restarting
      if (forceRestart && videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setVideoStream(null);
      }

      // Don't start if we already have a stream
      if (videoStream && !forceRestart) {
        console.log("Camera already running, using existing stream");
        setIsCameraActive(true);
        return videoStream;
      }

      console.log("Starting camera...");
      // Get new video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      console.log("Camera started successfully with tracks:", stream.getTracks().length);
      
      // Set stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("Set video element source object successfully");
        
        // Force video element to play
        try {
          await videoRef.current.play();
          console.log("Video playback started successfully");
        } catch (playError) {
          console.error("Error playing video:", playError);
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await videoRef.current?.play();
              console.log("Video playback started on retry");
            } catch (retryError) {
              console.error("Error playing video on retry:", retryError);
            }
          }, 1000);
        }
      } else {
        console.warn("Video element ref not available");
      }

      setVideoStream(stream);
      setIsCameraActive(true);
      return stream;
    } catch (error) {
      console.error("Error starting camera:", error);
      toast({
        title: "Erro na câmera",
        description: "Não foi possível acessar a câmera.",
        variant: "destructive",
      });
      setIsCameraActive(false);
      return null;
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoStream(null);
      setIsCameraActive(false);
    }
  };

  const joinSession = async (showToast: boolean = true) => {
    if (!sessionId || !participantId) return;

    setIsJoining(true);
    setConnectionAttempts(prev => prev + 1);
    
    try {
      // Start camera if not already started
      let stream: MediaStream | null = videoStream;
      if (!stream) {
        stream = await startCamera();
        if (!stream) {
          // If camera fails, still try to join without camera
          console.log("Failed to start camera, joining without video");
        }
      } else {
        console.log("Using existing camera stream for WebRTC");
      }

      console.log("Adding participant to session:", {
        sessionId,
        participantId,
        participantName
      });
      
      // Add participant to session
      const success = addParticipantToSession(sessionId, participantId, participantName);
      
      if (!success) {
        throw new Error("Failed to add participant to session");
      }

      // Set up WebRTC if we have a stream
      if (stream) {
        console.log("Setting up WebRTC with stream...");
        setLocalStream(stream);
        
        try {
          await initParticipantWebRTC(sessionId, participantId, stream);
          console.log("WebRTC initialized successfully");
        } catch (e) {
          console.error("WebRTC initialization error:", e);
          // Continue despite WebRTC errors - we'll still try to join via broadcast channel
        }
      } else {
        console.log("No stream available, skipping WebRTC setup");
      }

      // Set up live stream session
      console.log("Initializing participant session...");
      const cleanup = initializeParticipantSession(sessionId, participantId, participantName);
      cleanupFunctionRef.current = cleanup;

      // Update state
      setIsJoined(true);
      setIsJoining(false);

      if (showToast) {
        toast({
          title: "Conectado à sessão",
          description: "Você está conectado e visível para o apresentador.",
        });
      }

      return true;
    } catch (error) {
      console.error("Error joining session:", error);
      setIsJoining(false);
      
      if (showToast) {
        // Only show error toast after multiple attempts
        if (connectionAttempts >= 2) {
          toast({
            title: "Erro ao conectar",
            description: "Não foi possível conectar à sessão. Tente novamente.",
            variant: "destructive",
          });
        } else {
          // Try again automatically on first failure
          console.log("Retrying connection automatically...");
          setTimeout(() => joinSession(showToast), 1500);
        }
      }
      return false;
    }
  };

  const leaveSession = () => {
    cleanupResources();
    setIsJoined(false);
    
    // Don't navigate to home, show final action if available
    if (finalAction && finalAction.type !== 'none') {
      // Final action will be shown
    } else {
      // Do not navigate to home page
      toast({
        title: "Desconectado",
        description: "Você saiu da sessão.",
      });
    }
  };

  const cleanupResources = () => {
    // Stop camera
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoStream(null);
      setIsCameraActive(false);
    }

    // Clean up WebRTC connections
    if (sessionId) {
      cleanupWebRTC();
    }

    // Call the cleanup function from liveStreamUtils
    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }

    // Close broadcast channel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }

    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Handle final action
  const handleFinalActionClick = () => {
    if (finalAction && finalAction.link) {
      window.location.href = finalAction.link;
    }
  };

  // Render call to action after leaving
  if (!isJoined && !isLoading && sessionFound && finalAction && finalAction.type !== 'none') {
    if (finalAction.type === 'image' && finalAction.image) {
      return (
        <div className="container max-w-md mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
            <CardContent className="pt-6 px-6 pb-8 flex flex-col items-center">
              <h2 className="text-xl font-semibold mb-4 text-center">Obrigado por participar!</h2>
              <div 
                className="w-full aspect-square bg-center bg-contain bg-no-repeat cursor-pointer rounded-lg mb-4" 
                style={{ backgroundImage: `url(${finalAction.image})` }}
                onClick={handleFinalActionClick}
              ></div>
              {finalAction.link && (
                <Button className="w-full" onClick={handleFinalActionClick}>
                  Acessar
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (finalAction.type === 'coupon' && finalAction.coupon) {
      return (
        <div className="container max-w-md mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
            <CardContent className="pt-6 px-6 pb-8 flex flex-col items-center">
              <h2 className="text-xl font-semibold mb-4 text-center">Obrigado por participar!</h2>
              <div className="w-full p-6 bg-secondary/30 rounded-lg mb-6 text-center">
                <p className="text-sm text-white/70 mb-2">Seu cupom:</p>
                <p className="text-2xl font-bold tracking-wider">{finalAction.coupon}</p>
              </div>
              {finalAction.link && (
                <Button className="w-full" onClick={handleFinalActionClick}>
                  Usar cupom
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
        <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
          <CardContent className="pt-6 px-6 pb-8 flex flex-col items-center">
            <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verificando sessão</h2>
            <p className="text-muted-foreground text-center">
              Estamos verificando se a sessão existe e está ativa...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionFound === false) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
        <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
          <CardContent className="pt-6 px-6 pb-8 flex flex-col items-center">
            <X className="h-10 w-10 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sessão não encontrada</h2>
            <p className="text-muted-foreground text-center mb-6">
              A sessão que você está tentando acessar não existe ou já foi encerrada.
            </p>
            <Button 
              className="w-full"
              onClick={() => {
                checkSession(); // Try checking again
              }}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main view when connected to the session
  return (
    <div className="container max-w-md mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
      <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
        <CardContent className="pt-6 px-6 pb-8">
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center bg-green-500/20 text-green-500 h-12 w-12 rounded-full mb-4">
              <CheckSquare className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Conectado à sessão</h2>
            <p className="text-muted-foreground">
              Você está conectado e sua câmera está sendo transmitida.
            </p>
          </div>

          <div className="relative mb-6 bg-black rounded-lg overflow-hidden">
            <div className="aspect-video flex items-center justify-center">
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                ></video>
              ) : (
                <div className="flex flex-col items-center justify-center p-8">
                  <VideoOff className="h-10 w-10 text-white/30 mb-2" />
                  <p className="text-white/50 text-sm text-center">
                    Câmera desativada
                  </p>
                </div>
              )}
            </div>

            <div className="absolute bottom-2 right-2">
              <Button 
                size="sm" 
                variant={isCameraActive ? "destructive" : "default"}
                className="rounded-full h-10 w-10 p-0"
                onClick={() => isCameraActive ? stopCamera() : startCamera()}
              >
                {isCameraActive ? <VideoOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-secondary/20 border border-white/10 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-1">
                  <h3 className="text-sm font-medium">Nome do participante</h3>
                  <p className="text-sm text-white/70">{participantName || 'Anônimo'}</p>
                </div>
                <Tv2 className="h-5 w-5 text-white/40" />
              </div>
            </div>

            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={leaveSession}
            >
              Sair da sessão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParticipantPage;
