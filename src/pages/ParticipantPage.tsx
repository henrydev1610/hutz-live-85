
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Camera, User, VideoOff, Loader2, X, ChevronRight, CheckSquare, Tv2 } from "lucide-react";
import { isSessionActive, addParticipantToSession } from '@/utils/sessionUtils';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);

  // Generate a unique participant ID on component mount
  useEffect(() => {
    const newParticipantId = `participant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setParticipantId(newParticipantId);
    console.log("Generated participant ID:", newParticipantId);
    
    // Check if session exists
    checkSession();

    // Check for camera availability
    checkCameraAvailability();

    return () => {
      cleanupResources();
    };
  }, []);

  // Retry checking session a few times in case of race conditions
  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 3;
    
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
      const isActive = await isSessionActive(sessionId);
      console.log("Session active:", isActive);
      setSessionFound(isActive);

      if (!isActive && showToast) {
        toast({
          title: "Sessão não encontrada",
          description: "A sessão não existe ou expirou.",
          variant: "destructive",
        });
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
    } finally {
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
          await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraPermission(true);
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

  const startCamera = async () => {
    try {
      // Stop any existing stream
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
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
          setIsJoining(false);
          return;
        }
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

      // Set up WebRTC
      console.log("Setting up WebRTC...");
      setLocalStream(stream);
      
      try {
        await initParticipantWebRTC(sessionId, participantId, stream);
      } catch (e) {
        console.error("WebRTC initialization error:", e);
        // Continue despite WebRTC errors - we'll still try to join via broadcast channel
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
    
    navigate('/');
    
    toast({
      title: "Desconectado",
      description: "Você saiu da sessão.",
    });
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
              onClick={() => navigate('/')}
            >
              Voltar para a página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isJoined) {
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
  }

  return (
    <div className="container max-w-md mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
      <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 w-full">
        <CardContent className="pt-6 px-6 pb-8">
          <h2 className="text-xl font-semibold mb-6 text-center">Entrar na sessão</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="participantName">Seu nome (opcional)</Label>
              <Input
                id="participantName"
                placeholder="Digite seu nome"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="w-full"
              />
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
                    {hasWebcam ? (
                      <>
                        <Camera className="h-10 w-10 text-white/30 mb-2" />
                        <p className="text-white/50 text-sm text-center">
                          Clique para ativar sua câmera
                        </p>
                      </>
                    ) : (
                      <>
                        <VideoOff className="h-10 w-10 text-white/30 mb-2" />
                        <p className="text-white/50 text-sm text-center">
                          Nenhuma câmera detectada
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {hasWebcam && (
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
              )}
            </div>
          </div>
          
          <Button 
            className="w-full hutz-button-accent" 
            onClick={() => joinSession()}
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                Entrar na sessão 
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParticipantPage;
