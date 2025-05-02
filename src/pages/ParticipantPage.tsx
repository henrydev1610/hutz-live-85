import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Camera, VideoOff, Loader2, X, ChevronRight, CheckSquare } from "lucide-react";
import { isSessionActive, addParticipantToSession, getSessionFinalAction } from '@/utils/sessionUtils';
import { initParticipantWebRTC, setLocalStream, cleanupWebRTC } from '@/utils/webrtc';
import { initializeParticipantSession } from '@/utils/liveStreamUtils';
import { diagnoseConnection, testBroadcastReception } from '@/utils/connectionDiagnostics';

const ParticipantPage = () => {
  const { toast } = useToast();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [participantId, setParticipantId] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [sessionFound, setSessionFound] = useState<boolean | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasWebcam, setHasWebcam] = useState(true);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [finalAction, setFinalAction] = useState<{
    type: 'none' | 'image' | 'coupon';
    image?: string;
    link?: string;
    coupon?: string;
  } | null>(null);
  const [finalActionTimerId, setFinalActionTimerId] = useState<NodeJS.Timer | null>(null);
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const videoRef = useRef<HTMLVideoElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupFunctionRef = useRef<(() => void) | null>(null);
  const autoJoinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraStartAttempts = useRef<number>(0);

  useEffect(() => {
    const newParticipantId = `participant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setParticipantId(newParticipantId);
    console.log("Generated participant ID:", newParticipantId);
    
    checkSession();

    checkBrowserCompatibility();
    
    checkCameraAvailability();

    return () => {
      cleanupResources();
    };
  }, []);

  const checkBrowserCompatibility = () => {
    const isWebRTCSupported = 
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia && 
      window.RTCPeerConnection;
    
    console.log("Browser information:", {
      userAgent: navigator.userAgent,
      webRTCSupported: isWebRTCSupported,
      mediaDevicesSupported: !!navigator.mediaDevices,
      getUserMediaSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      RTCPeerConnectionSupported: !!window.RTCPeerConnection,
      broadcastChannelSupported: typeof BroadcastChannel !== 'undefined'
    });
    
    if (!isWebRTCSupported) {
      console.warn("WebRTC is not fully supported in this browser");
      toast({
        title: "Compatibilidade limitada",
        description: "Este navegador pode ter compatibilidade limitada com a transmissão ao vivo.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (sessionFound && !isJoined && !isJoining && cameraPermission !== null) {
      autoJoinTimeoutRef.current = setTimeout(() => {
        console.log("Auto-joining session...");
        joinSession(false);
      }, 500);
    }
    
    return () => {
      if (autoJoinTimeoutRef.current) {
        clearTimeout(autoJoinTimeoutRef.current);
      }
    };
  }, [sessionFound, isJoined, isJoining, cameraPermission]);

  useEffect(() => {
    if (isJoined && sessionId) {
      const sessionFinalAction = getSessionFinalAction(sessionId);
      if (sessionFinalAction) {
        setFinalAction(sessionFinalAction);
      }
    }
  }, [isJoined, sessionId]);

  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 5;

    const retrySessionCheck = () => {
      if (sessionFound === false && checkCount < maxChecks) {
        checkCount++;
        console.log(`Retrying session check (${checkCount}/${maxChecks})...`);
        setTimeout(() => {
          checkSession(false);
        }, 1000 * checkCount);
      }
    };
    
    if (sessionFound === false) {
      retrySessionCheck();
    }
  }, [sessionFound]);

  useEffect(() => {
    if (isJoined && isCameraActive && !videoStream && cameraStartAttempts.current < 3) {
      console.log("Camera should be active but no stream, attempting restart...");
      const restartTimeout = setTimeout(() => {
        cameraStartAttempts.current += 1;
        startCamera(true);
      }, 2000); // Increased timeout to give more time before restart
      
      return () => clearTimeout(restartTimeout);
    }
  }, [isJoined, isCameraActive, videoStream]);

  useEffect(() => {
    if (videoStream && videoRef.current) {
      // Don't automatically restart the camera, just log the issue
      const checkVideoPlaying = () => {
        if (videoRef.current && 
            (videoRef.current.readyState < 2 || 
             videoRef.current.paused || 
             videoRef.current.videoWidth === 0)) {
          console.log("Video not playing properly, attempting to play without restart");
          
          // Try to play the video without restarting camera
          videoRef.current.play().catch(err => {
            console.warn("Failed to play video:", err);
            // Only log the error, don't restart camera here
          });
        }
      };
      
      const videoCheckTimeout = setTimeout(checkVideoPlaying, 3000);
      return () => clearTimeout(videoCheckTimeout);
    }
  }, [videoStream]);

  useEffect(() => {
    if (isJoined && sessionId && videoStream) {
      const sendVideoStreamInfo = () => {
        try {
          // Use multiple channels for better reliability
          const channels = [
            new BroadcastChannel(`live-session-${sessionId}`),
            new BroadcastChannel(`telao-session-${sessionId}`),
            new BroadcastChannel(`stream-info-${sessionId}`)
          ];
          
          // Add more detailed information about the stream
          const streamInfo = {
            type: 'video-stream-info',
            id: participantId,
            hasStream: true,
            hasVideo: videoStream.getVideoTracks().length > 0,
            active: videoStream.active,
            trackIds: videoStream.getTracks().map(track => ({
              id: track.id,
              kind: track.kind,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            })),
            streamActive: videoStream.active,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform
            },
            timestamp: Date.now(),
            // Add visibility state to help debugging
            visibilityState: document.visibilityState
          };
          
          // Send on all channels
          channels.forEach(channel => {
            channel.postMessage(streamInfo);
            
            // Also send a test message
            channel.postMessage({
              type: 'connection-test',
              id: participantId,
              testId: `test-${Date.now()}`,
              timestamp: Date.now()
            });
          });
          
          // Close channels after sending to prevent memory leaks
          setTimeout(() => {
            channels.forEach(channel => channel.close());
          }, 500);
          
          console.log("Sent stream info on all channels:", streamInfo);
          
          // Periodically run diagnostics
          if (Math.random() < 0.2) {
            diagnoseConnection(sessionId, participantId)
              .then(result => console.log("Connection diagnostics:", result));
            
            testBroadcastReception(sessionId, participantId)
              .then(received => console.log("Broadcast reception test:", received ? "Successful" : "Failed"));
          }
        } catch (e) {
          console.error("Error sending stream info:", e);
        }
      };
      
      // Send immediately and then set interval
      sendVideoStreamInfo();
      
      const streamInfoInterval = setInterval(sendVideoStreamInfo, 2000);
      
      // Store interval for cleanup
      window._streamIntervals = window._streamIntervals || {};
      window._streamIntervals[participantId] = streamInfoInterval;
      
      return () => {
        clearInterval(streamInfoInterval);
        if (window._streamIntervals && window._streamIntervals[participantId]) {
          delete window._streamIntervals[participantId];
        }
      };
    }
  }, [isJoined, sessionId, videoStream, participantId]);

  useEffect(() => {
    if (finalActionOpen && finalActionTimeLeft > 0) {
      const timerId = setInterval(() => {
        setFinalActionTimeLeft((prev) => prev - 1);
      }, 1000);
      
      setFinalActionTimerId(timerId);
      
      return () => {
        if (timerId) clearInterval(timerId);
      };
    } else if (finalActionTimeLeft <= 0) {
      closeFinalAction();
    }
  }, [finalActionOpen, finalActionTimeLeft]);

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
      
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        const backupChannel = new BroadcastChannel(`live-session-${sessionId}-backup`);
        
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
        
        channel.postMessage({ type: 'ping', timestamp: Date.now() });
        backupChannel.postMessage({ type: 'ping', timestamp: Date.now() });
        
        try {
          const localStorageHeartbeat = localStorage.getItem(`live-heartbeat-${sessionId}`);
          if (localStorageHeartbeat) {
            const timestamp = parseInt(localStorageHeartbeat);
            if (Date.now() - timestamp < 30000) {
              heartbeatHandler();
              return;
            }
          }
        } catch (e) {
          console.warn("Error checking localStorage heartbeat:", e);
        }
        
        setTimeout(() => {
          if (!heartbeatReceived) {
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
          const testStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280, min: 320 },
              height: { ideal: 720, min: 240 },
              frameRate: { ideal: 30, min: 10 }
            },
            audio: false 
          });
          setCameraPermission(true);
          
          setVideoStream(testStream);
          setIsCameraActive(true);
          
          if (videoRef.current) {
            videoRef.current.srcObject = testStream;
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error("Error playing initial video:", err);
                });
              }
            };
            
            if (videoRef.current.readyState >= 2) {
              videoRef.current.play().catch(err => {
                console.error("Error playing initial video:", err);
              });
            }
            
            console.log("Preview camera stream set successfully");
          } else {
            console.warn("Video element ref not available yet");
          }
        } catch (error) {
          console.error("Camera permission denied:", error);
          setCameraPermission(false);
          
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            toast({
              title: "Permissão negada",
              description: "Você precisa permitir o acesso à câmera para participar.",
              variant: "destructive",
            });
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            toast({
              title: "Câmera não encontrada",
              description: "Não foi possível detectar uma câmera conectada.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Erro de câmera",
              description: `Não foi possível acessar a câmera: ${error.message || error.name}`,
              variant: "destructive",
            });
          }
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
      if (forceRestart && videoStream) {
        console.log("Stopping existing video tracks before restart");
        videoStream.getTracks().forEach(track => {
          console.log(`Stopping track: ${track.kind} (${track.id}) readyState=${track.readyState}`);
          track.stop();
        });
        
        // Only clear the video element's srcObject if we're forcing a restart
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        
        // Reset video stream state
        setVideoStream(null);
        
        // Small delay to ensure cleanup is complete before restarting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Skip if we already have a valid stream and aren't forcing restart
      if (videoStream && !forceRestart && videoStream.active) {
        console.log("Camera already running with active stream, using existing stream");
        setIsCameraActive(true);
        return videoStream;
      }

      console.log("Starting camera with browser-compatible settings...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 30, min: 10 }
        },
        audio: false
      });

      console.log("Camera started successfully with tracks:", stream.getTracks().length);
      console.log("Video tracks:", stream.getVideoTracks().map(t => 
        `${t.label} (${t.id}): enabled=${t.enabled}, muted=${t.muted}, readyState=${t.readyState}`
      ));
      
      // Set video element source and play it
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("Set video element source object successfully");
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(playError => {
              console.error("Error playing video on loadedmetadata:", playError);
            });
          }
        };
        
        try {
          if (videoRef.current.readyState >= 2) {
            await videoRef.current.play();
            console.log("Video playback started successfully");
          }
        } catch (playError) {
          console.error("Error playing video:", playError);
          
          // Try to play again after a short delay
          setTimeout(async () => {
            try {
              if (videoRef.current) {
                await videoRef.current.play();
                console.log("Video playback started on retry");
              }
            } catch (retryError) {
              console.error("Error playing video on retry:", retryError);
              // Set up a click event handler to play on user interaction
              try {
                document.addEventListener('click', function tryPlayOnce() {
                  if (videoRef.current) {
                    videoRef.current.play().catch(e => console.error("Play on click failed:", e));
                    document.removeEventListener('click', tryPlayOnce);
                  }
                }, {once: true});
              } catch (e) {
                console.error("Failed to set up play-on-click handler:", e);
              }
            }
          }, 1000);
        }
      } else {
        console.warn("Video element ref not available");
      }

      // Update state with new stream
      setVideoStream(stream);
      setIsCameraActive(true);
      
      // If already joined, update WebRTC connection with new stream
      if (isJoined && sessionId) {
        // Announce the new stream to others
        announceStreamInfo(stream, sessionId, participantId);
        
        // Update WebRTC with the new stream
        console.log("Updating WebRTC with new camera stream");
        setLocalStream(stream);
      }
      
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

  const announceStreamInfo = (stream: MediaStream, sessId: string, partId: string) => {
    try {
      try {
        const channel = new BroadcastChannel(`live-session-${sessId}`);
        channel.postMessage({
          type: 'video-stream-info',
          id: partId,
          hasStream: true,
          hasVideo: stream.getVideoTracks().length > 0,
          active: stream.active,
          trackIds: stream.getTracks().map(t => t.id) || [],
          timestamp: Date.now(),
          visibilityState: document.visibilityState
        });
        setTimeout(() => channel.close(), 500);
      } catch (broadcastError) {
        console.warn("BroadcastChannel not supported for announcements:", broadcastError);
      }
      
      try {
        const storageKey = `stream-info-${sessId}-${partId}-${Date.now()}`;
        localStorage.setItem(storageKey, JSON.stringify({
          type: 'video-stream-info',
          id: partId,
          hasStream: true,
          hasVideo: stream.getVideoTracks().length > 0,
          trackIds: stream.getTracks().map(t => t.id) || [],
          timestamp: Date.now(),
          visibilityState: document.visibilityState
        }));
        setTimeout(() => localStorage.removeItem(storageKey), 10000);
      } catch (storageError) {
        console.warn("localStorage fallback failed:", storageError);
      }
    } catch (e) {
      console.error("Error in stream announcement:", e);
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
      let stream: MediaStream | null = videoStream;
      if (!stream) {
        stream = await startCamera();
        if (!stream) {
          console.log("Failed to start camera, joining without video");
        }
      } else {
        console.log("Using existing camera stream for WebRTC");
      }

      console.log("Adding participant to session:", {
        sessionId,
        participantId
      });
      
      const success = addParticipantToSession(sessionId, participantId, "");
      
      if (!success) {
        throw new Error("Failed to add participant to session");
      }

      if (stream) {
        console.log("Setting up WebRTC with stream...");
        setLocalStream(stream);
        
        try {
          await initParticipantWebRTC(sessionId, participantId, stream);
          console.log("WebRTC initialized successfully");
          
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              if (stream && stream.active) {
                announceStreamInfo(stream, sessionId, participantId);
              }
            }, i * 800);
          }
        } catch (e) {
          console.error("WebRTC initialization error:", e);
          setTimeout(async () => {
            try {
              await initParticipantWebRTC(sessionId, participantId, stream!);
              console.log("WebRTC initialized successfully on retry");
            } catch (retryError) {
              console.error("WebRTC initialization retry error:", retryError);
            }
          }, 2000);
        }
        
        const streamAnnouncementInterval = setInterval(() => {
          if (stream && stream.active) {
            announceStreamInfo(stream, sessionId, participantId);
            
            if (Math.random() < 0.1) {
              diagnoseConnection(sessionId, participantId)
                .then(result => console.log("Connection diagnostics:", result));
            }
          }
        }, 3000);
        
        (window as any)._streamIntervals = (window as any)._streamIntervals || {};
        (window as any)._streamIntervals[participantId] = streamAnnouncementInterval;
      } else {
        console.log("No stream available, skipping WebRTC setup");
      }

      console.log("Initializing participant session...");
      const cleanup = initializeParticipantSession(sessionId, participantId, "");
      cleanupFunctionRef.current = cleanup;

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
        if (connectionAttempts >= 2) {
          toast({
            title: "Erro ao conectar",
            description: "Não foi possível conectar à sessão. Tente novamente.",
            variant: "destructive",
          });
        } else {
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
    
    if (finalAction && finalAction.type !== 'none') {
    } else {
      window.close();
    }
  };

  const cleanupResources = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setVideoStream(null);
      setIsCameraActive(false);
    }

    if (sessionId) {
      cleanupWebRTC();
    }

    if (cleanupFunctionRef.current) {
      cleanupFunctionRef.current();
      cleanupFunctionRef.current = null;
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (window._streamIntervals && window._streamIntervals[participantId]) {
      clearInterval(window._streamIntervals[participantId]);
      delete window._streamIntervals[participantId];
    }
  };

  const handleFinalActionClick = () => {
    if (finalAction && finalAction.link) {
      window.location.href = finalAction.link;
    }
  };

  const closeFinalAction = () => {
    if (finalActionTimerId) {
      clearInterval(finalActionTimerId);
      setFinalActionTimerId(null);
    }
    setFinalActionOpen(false);
    setFinalActionTimeLeft(20);
    
    toast({
      title: "Transmissão finalizada",
      description: "A transmissão foi encerrada com sucesso."
    });
  };

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
                checkSession();
              }}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

          <Button 
            variant="destructive" 
            className="w-full" 
            onClick={leaveSession}
          >
            Sair da sessão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

declare global {
  interface Window {
    _sessionIntervals?: {
      [key: string]: number;
    };
    _streamIntervals?: {
      [key: string]: number;
    };
  }
}

export default ParticipantPage;
