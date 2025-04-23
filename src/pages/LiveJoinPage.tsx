
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Camera, CircleCheck, LogOut, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LiveJoinPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Request camera permission on component mount
  useEffect(() => {
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" },
          audio: true 
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setCameraPermission('granted');
        
        // In a real implementation, we would connect to the WebRTC session here
        // For now, let's simulate a connection with a setTimeout
        setTimeout(() => {
          setConnected(true);
          toast({
            description: "Conectado à sessão com sucesso!",
          });
          
          // Send stream to parent window if available
          if (window.opener) {
            const participantData = {
              id: `user-${Date.now()}`,
              name: `Participante ${Math.floor(Math.random() * 1000)}`,
              stream: stream
            };
            
            // Since we can't send MediaStream directly via postMessage,
            // in a real implementation, we would use WebRTC to establish
            // peer connections. For now, we'll just send the connection info
            window.opener.postMessage({
              type: 'PARTICIPANT_JOINED',
              sessionId,
              participantData: {
                id: participantData.id,
                name: participantData.name
                // Stream would be established via WebRTC
              }
            }, '*');
          }
        }, 1500);
        
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraPermission('denied');
        toast({
          title: "Acesso à câmera negado",
          description: "Você precisa permitir o acesso à câmera para participar da sessão",
          variant: "destructive"
        });
      }
    };

    if (sessionId) {
      requestCamera();
    } else {
      navigate('/');
    }
    
    return () => {
      // Clean up video stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, navigate, toast]);

  const handleLeaveSession = () => {
    // In a real implementation, we would disconnect from the WebRTC session here
    if (window.opener) {
      window.opener.postMessage({
        type: 'PARTICIPANT_LEFT',
        sessionId
      }, '*');
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Navigate back to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold hutz-gradient-text">Momento Live</h1>
          <p className="text-white/70 mt-1">
            Sessão: {sessionId}
          </p>
        </div>
        
        {/* Camera view */}
        <div className="relative aspect-square bg-secondary/30 rounded-lg overflow-hidden shadow-lg border border-white/10">
          {cameraPermission === 'granted' ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {cameraPermission === 'pending' ? (
                <>
                  <Camera className="h-12 w-12 text-white/50 mb-3" />
                  <p className="text-white/70">Solicitando acesso à câmera...</p>
                </>
              ) : (
                <>
                  <X className="h-12 w-12 text-red-500 mb-3" />
                  <p className="text-white/70">Acesso à câmera negado</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Tentar novamente
                  </Button>
                </>
              )}
            </div>
          )}
          
          {/* Connection status indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
            {connected ? (
              <>
                <CircleCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm">Conectado</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-sm">Conectando...</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex justify-center mt-6">
          <Button 
            variant="destructive"
            size="lg"
            className="gap-2"
            onClick={handleLeaveSession}
          >
            <LogOut className="h-4 w-4" />
            Sair da sessão
          </Button>
        </div>
        
        <p className="text-sm text-center text-white/50 mt-6">
          Quando você aparece na transmissão ao vivo, seu vídeo é compartilhado com todos os participantes do evento.
        </p>
      </div>
    </div>
  );
};

export default LiveJoinPage;
