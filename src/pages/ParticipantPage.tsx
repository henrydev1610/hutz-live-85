
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Camera, User, VideoOff, Loader2, X, ChevronRight, CheckSquare, Tv2 } from "lucide-react";
import { isSessionActive, addParticipantToSession } from '@/utils/sessionUtils';
import { initParticipantWebRTC, setLocalStream } from '@/utils/webrtc';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Generate a unique participant ID
    const newParticipantId = `participant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setParticipantId(newParticipantId);

    // Check if session exists
    checkSession();

    // Check for camera availability
    checkCameraAvailability();

    return () => {
      cleanupResources();
    };
  }, []);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      if (!sessionId) {
        setSessionFound(false);
        toast({
          title: "Sessão não encontrada",
          description: "O ID da sessão não foi fornecido.",
          variant: "destructive",
        });
        return;
      }

      const isActive = isSessionActive(sessionId);
      setSessionFound(isActive);

      if (!isActive) {
        toast({
          title: "Sessão não encontrada",
          description: "A sessão não existe ou expirou.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking session:", error);
      setSessionFound(false);
      toast({
        title: "Erro ao verificar sessão",
        description: "Não foi possível verificar se a sessão existe.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkCameraAvailability = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
      setHasWebcam(hasVideoDevices);

      if (hasVideoDevices) {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraPermission(true);
        } catch (error) {
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

      // Get new video stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

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

      // Add participant to session
      const success = addParticipantToSession(sessionId, participantId, participantName);
      
      if (!success) {
        throw new Error("Failed to add participant to session");
      }

      // Set up WebRTC
      setLocalStream(stream);
      await initParticipantWebRTC(sessionId, participantId, stream);

      // Set up broadcast channel for heartbeats
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      broadcastChannelRef.current = channel;

      // Send initial join message
      channel.postMessage({
        type: 'participant-join',
        id: participantId,
        name: participantName,
        timestamp: Date.now()
      });

      // Set up heartbeat
      const heartbeatInterval = setInterval(() => {
        if (channel) {
          channel.postMessage({
            type: 'participant-heartbeat',
            id: participantId,
            timestamp: Date.now()
          });
        }
      }, 5000);

      heartbeatIntervalRef.current = heartbeatInterval;

      // Update state
      setIsJoined(true);
      setIsJoining(false);

      if (showToast) {
        toast({
          title: "Conectado à sessão",
          description: "Você está conectado e visível para o apresentador.",
        });
      }

      return () => {
        // Cleanup function
        if (channel) {
          channel.close();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      };
    } catch (error) {
      console.error("Error joining session:", error);
      setIsJoining(false);
      
      if (showToast) {
        toast({
          title: "Erro ao conectar",
          description: "Não foi possível conectar à sessão.",
          variant: "destructive",
        });
      }
      return () => {}; // Return empty cleanup function on error
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
