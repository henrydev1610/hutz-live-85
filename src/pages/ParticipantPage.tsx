
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
  const { toast } = useToast();

  useEffect(() => {
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
  }, [toast]);

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
      
      // Here you would normally set up a connection to send the video stream
      // to the main session using WebRTC or a similar technology
      console.log(`Connected to session: ${sessionId}`);
      
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
        <h1 className="text-xl font-semibold mb-4">Transmissão ao Vivo</h1>
        <p className="text-sm text-white/70 mb-6">
          Sessão: {sessionId}
        </p>
        
        <div className="w-full max-w-md aspect-video bg-secondary/40 backdrop-blur-lg border border-white/10 rounded-lg overflow-hidden relative">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
          
          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="h-12 w-12 text-white/30" />
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-6">
          {!cameraActive ? (
            <Button 
              className="hutz-button-accent"
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
      </div>
    </div>
  );
};

export default ParticipantPage;
