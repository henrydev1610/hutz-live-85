
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Video, VideoOff } from 'lucide-react';

const ParticipantPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Auto-start camera on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const timer = setTimeout(() => {
        startCamera();
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    // Get list of video devices
    const getVideoDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        
        // Automatically select front camera if available
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
    
    // Connect to the transmission service
    connectToSession();
    
    return () => {
      if (cameraActive) {
        stopCamera();
      }
      disconnectFromSession();
    };
  }, [toast]);

  const connectToSession = () => {
    // In a real implementation, we would connect to a WebRTC service
    // For now, we'll simulate the connection
    console.log(`Connecting to session: ${sessionId}`);
    
    // Create a broadcast channel to communicate with the host
    const channel = new BroadcastChannel(`telao-session-${sessionId}`);
    
    // Send a join message
    channel.postMessage({
      type: 'participant-join',
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    });
    
    // Simulate connection established
    setTimeout(() => {
      setConnected(true);
      toast({
        title: "Conectado à sessão",
        description: `Você está conectado à sessão ${sessionId}.`,
      });
    }, 500);
  };

  const disconnectFromSession = () => {
    // In a real implementation, we would disconnect from the WebRTC service
    if (connected) {
      console.log(`Disconnecting from session: ${sessionId}`);
      setConnected(false);
      setTransmitting(false);
      
      // Send a leave message on the broadcast channel
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      channel.postMessage({
        type: 'participant-leave',
        timestamp: Date.now()
      });
      channel.close();
    }
  };

  const startTransmitting = () => {
    if (!connected || !cameraActive) return;
    
    // In a real implementation, we would start sending video data
    setTransmitting(true);
    console.log(`Started transmitting video to session: ${sessionId}`);
    
    // Send a frame periodically to simulate video transmission
    const sendVideoFrame = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Set canvas dimensions to match video
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          
          // Draw the current video frame to the canvas
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Convert the canvas to a data URL (this is very inefficient for real video streaming
          // but works for this demo)
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            
            // Send the frame to the host
            const channel = new BroadcastChannel(`telao-session-${sessionId}`);
            channel.postMessage({
              type: 'video-frame',
              frame: dataUrl,
              timestamp: Date.now()
            });
          } catch (e) {
            console.error('Error creating data URL:', e);
          }
        }
      }
    };
    
    // Send a frame every second (again, very inefficient but works for demo)
    const intervalId = setInterval(sendVideoFrame, 1000);
    
    // Store the interval ID somewhere so it can be cleared later
    (window as any).frameIntervalId = intervalId;
  };

  const stopTransmitting = () => {
    if (!transmitting) return;
    
    // In a real implementation, we would stop sending video data
    setTransmitting(false);
    console.log(`Stopped transmitting video to session: ${sessionId}`);
    
    // Clear the frame sending interval
    if ((window as any).frameIntervalId) {
      clearInterval((window as any).frameIntervalId);
      (window as any).frameIntervalId = null;
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
      
      // Automatically start transmitting when camera is activated
      setTimeout(() => {
        startTransmitting();
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
    
    // Stop transmitting first
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
    
    // Stop current camera
    stopCamera();
    
    // Find next camera in the list
    const currentIndex = availableDevices.findIndex(device => device.deviceId === deviceId);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    const nextDeviceId = availableDevices[nextIndex].deviceId;
    
    setDeviceId(nextDeviceId);
    
    // Small delay to ensure camera has stopped
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
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-white">
            {connected ? 'Conectado à sessão' : 'Desconectado'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ParticipantPage;
