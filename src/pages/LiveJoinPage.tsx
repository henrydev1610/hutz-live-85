
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Camera, CircleCheck, LogOut, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Input } from '@/components/ui/input';

const LiveJoinPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [connected, setConnected] = useState(false);
  const [participantName, setParticipantName] = useState(`Participante ${Math.floor(Math.random() * 1000)}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const connectionAttemptedRef = useRef(false);
  const participantIdRef = useRef(`user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  
  const {
    localStream,
    isConnected,
    isInitializing,
    initializeParticipantCamera
  } = useWebRTC({
    sessionId: sessionId || null
  });
  
  // Request camera permission on component mount - but only once
  useEffect(() => {
    const requestCamera = async () => {
      if (connectionAttemptedRef.current) {
        console.log('[LiveJoinPage] Connection was already attempted, skipping');
        return; // Prevent multiple initialization attempts
      }
      
      connectionAttemptedRef.current = true;
      
      try {
        console.log('[LiveJoinPage] Requesting camera access...');
        const stream = await initializeParticipantCamera();
        if (stream) {
          if (videoRef.current) {
            console.log('[LiveJoinPage] Setting stream to video element');
            videoRef.current.srcObject = stream;
          }
          setCameraPermission('granted');
          
          // Notify the parent window that a new participant has joined with their stream
          setTimeout(() => {
            setConnected(true);
            toast({
              description: "Conectado à sessão com sucesso!",
            });
            
            // Send participant info to parent window
            if (window.opener) {
              console.log('[LiveJoinPage] Sending participant joined message');
              const participantData = {
                id: participantIdRef.current,
                name: participantName,
                stream: null // We can't send MediaStream via postMessage
              };
              
              window.opener.postMessage({
                type: 'PARTICIPANT_JOINED',
                sessionId,
                participantData
              }, '*');
              
              // Now send a separate message specifically for stream handling
              console.log('[LiveJoinPage] Sending participant stream message');
              window.opener.postMessage({
                type: 'PARTICIPANT_STREAM',
                sessionId,
                participantId: participantIdRef.current,
                hasStream: !!stream
              }, '*');
              
              // Use a more frequent interval to ensure messages are received
              const intervalId = setInterval(() => {
                if (window.opener && !window.opener.closed) {
                  console.log('[LiveJoinPage] Resending participant joined message');
                  window.opener.postMessage({
                    type: 'PARTICIPANT_JOINED',
                    sessionId,
                    participantData: {
                      ...participantData,
                      name: participantName // Make sure the current name is sent
                    }
                  }, '*');
                  
                  // Also resend stream status
                  window.opener.postMessage({
                    type: 'PARTICIPANT_STREAM',
                    sessionId,
                    participantId: participantIdRef.current,
                    hasStream: !!stream
                  }, '*');
                } else {
                  clearInterval(intervalId);
                }
              }, 3000); // More frequent updates
            } else {
              console.error('[LiveJoinPage] No opener window found');
              toast({
                title: "Erro de conexão",
                description: "Não foi possível estabelecer comunicação com a sessão",
                variant: "destructive"
              });
            }
          }, 1000);
        }
      } catch (err) {
        console.error('[LiveJoinPage] Error accessing camera:', err);
        setCameraPermission('denied');
        toast({
          title: "Acesso à câmera negado",
          description: "Você precisa permitir o acesso à câmera para participar da sessão",
          variant: "destructive"
        });
      }
    };

    if (sessionId && !connectionAttemptedRef.current && !isInitializing) {
      console.log('[LiveJoinPage] Attempting to connect to session:', sessionId);
      requestCamera();
    } else if (!sessionId) {
      navigate('/');
    }
  }, [sessionId, navigate, toast, initializeParticipantCamera, isInitializing]);

  // Update name in parent window when changed
  const handleNameChange = useCallback((newName: string) => {
    setParticipantName(newName);
    
    if (connected && window.opener && !window.opener.closed) {
      console.log(`[LiveJoinPage] Sending updated name: ${newName}`);
      window.opener.postMessage({
        type: 'PARTICIPANT_NAME_CHANGED',
        sessionId,
        participantId: participantIdRef.current,
        name: newName
      }, '*');
    }
  }, [connected, sessionId]);

  // Ensure video element always shows the same stream reference
  useEffect(() => {
    if (localStream && videoRef.current && videoRef.current.srcObject !== localStream) {
      console.log('[LiveJoinPage] Updating video element with current stream');
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleLeaveSession = () => {
    // Notify that participant has left
    if (window.opener) {
      console.log('[LiveJoinPage] Sending participant left message');
      window.opener.postMessage({
        type: 'PARTICIPANT_LEFT',
        sessionId,
        participantId: participantIdRef.current
      }, '*');
    }
    
    // Navigate back to dashboard
    navigate('/dashboard');
  };

  // Handle beforeunload event to notify parent window when the page is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window.opener) {
        window.opener.postMessage({
          type: 'PARTICIPANT_LEFT',
          sessionId,
          participantId: participantIdRef.current
        }, '*');
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Also send a leave message when component unmounts
      if (window.opener) {
        window.opener.postMessage({
          type: 'PARTICIPANT_LEFT',
          sessionId,
          participantId: participantIdRef.current
        }, '*');
      }
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold hutz-gradient-text">Momento Live</h1>
          <p className="text-white/70 mt-1">
            Sessão: {sessionId}
          </p>
        </div>
        
        {/* Name input */}
        <div className="mb-4">
          <label htmlFor="participant-name" className="block text-sm font-medium text-white/80 mb-1">
            Seu nome
          </label>
          <Input
            id="participant-name"
            value={participantName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="bg-secondary/30 border border-white/10"
            placeholder="Digite seu nome"
            maxLength={30}
          />
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
                    onClick={() => {
                      connectionAttemptedRef.current = false;
                      setCameraPermission('pending');
                      window.location.reload();
                    }}
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
