
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '@/stores/settingsStore';
import { Camera, LogOut } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ParticipantPage = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [participantId] = useState(uuidv4());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { actionSettings } = useSettingsStore();
  
  // Get user media and connect to the session
  useEffect(() => {
    if (!sessionId) return;
    
    const setupParticipant = async () => {
      try {
        setIsLoading(true);
        
        // Request camera access
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        
        // Initialize WebRTC connection
        await initParticipantWebRTC(sessionId, participantId, mediaStream);
        setIsConnected(true);
        setIsLoading(false);
        
        toast({
          title: "Conectado à sessão",
          description: "Sua câmera está ativa e você está participando da sessão."
        });
      } catch (err) {
        console.error("Error setting up participant:", err);
        toast({
          title: "Erro ao conectar",
          description: "Não foi possível acessar sua câmera ou conectar à sessão.",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    };
    
    setupParticipant();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cleanupWebRTC();
    };
  }, [sessionId, participantId]);
  
  const handleLeaveSession = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    cleanupWebRTC();
    setIsConnected(false);
    showEndAction();
  };
  
  const showEndAction = () => {
    // Show the appropriate end action based on settings
  };
  
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-4">Sessão Inválida</h1>
          <p className="text-lg">O link que você está tentando acessar é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-white">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-center mb-2">
            Transmissão ao Vivo
          </h1>
          <p className="text-center text-sm opacity-75">
            {isConnected 
              ? "Você está participando da transmissão" 
              : isLoading 
                ? "Conectando à sessão..." 
                : "Conecte sua câmera para participar"
            }
          </p>
        </div>

        <div className="w-full aspect-square bg-gray-900 rounded-lg overflow-hidden mb-6 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Button 
                    onClick={() => window.location.reload()} 
                    className="flex items-center"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Ativar Câmera
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 bg-black/40 rounded-md">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLeaveSession}
              disabled={!isConnected || isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
      
      {!isConnected && actionSettings.type !== 'none' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          {actionSettings.type === 'image' && actionSettings.imageUrl && (
            <div className="max-w-md">
              <img 
                src={actionSettings.imageUrl} 
                alt="Ação final" 
                className="w-full h-auto rounded-md"
              />
              {actionSettings.linkUrl && (
                <a 
                  href={actionSettings.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 p-3 bg-accent text-white text-center rounded-md"
                >
                  Acessar Link
                </a>
              )}
            </div>
          )}
          
          {actionSettings.type === 'coupon' && actionSettings.couponCode && (
            <div className="bg-white text-black p-6 rounded-md max-w-md w-full text-center">
              <div className="text-xl font-bold mb-2">Seu Cupom</div>
              <div className="bg-gray-100 p-4 rounded-md mb-4">
                <span className="font-mono text-2xl font-bold">
                  {actionSettings.couponCode}
                </span>
              </div>
              {actionSettings.text && (
                <p className="mb-4">{actionSettings.text}</p>
              )}
              {actionSettings.linkUrl && (
                <a 
                  href={actionSettings.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 p-3 bg-accent text-white text-center rounded-md"
                >
                  Utilizar Cupom
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ParticipantPage;
