
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Settings, Monitor, MonitorOff } from "lucide-react";
import { toast } from "sonner";
import { initParticipantWebRTC, setLocalStream, endWebRTC } from '@/utils/webrtcUtils';

const ParticipantPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participantId] = useState(() => `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // Media states
  const [hasVideo, setHasVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  // Stream refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Get user media with enhanced error handling
  const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      console.log('Requesting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Successfully obtained user media:', stream.getTracks().map(t => ({ kind: t.kind, label: t.label, enabled: t.enabled })));
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso e tente novamente.');
        } else if (error.name === 'NotFoundError') {
          toast.error('Câmera ou microfone não encontrados.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Câmera ou microfone já estão sendo usados por outro aplicativo.');
        } else {
          toast.error(`Erro ao acessar mídia: ${error.message}`);
        }
      }
      
      return null;
    }
  };

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Try to get video and audio first
      let stream = await getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      if (!stream) {
        // Fallback to audio only
        console.log('Video failed, trying audio only...');
        stream = await getUserMedia({ audio: true });
        
        if (!stream) {
          throw new Error('Não foi possível acessar câmera nem microfone');
        }
      }
      
      localStreamRef.current = stream;
      
      // Update media availability states
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`Media initialized - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      // Set initial enabled states
      videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
        console.log(`Video track enabled: ${track.enabled}`);
      });
      audioTracks.forEach(track => {
        track.enabled = isAudioEnabled;
        console.log(`Audio track enabled: ${track.enabled}`);
      });
      
      // Display local video
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        // Ensure video plays
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video is playing');
        } catch (playError) {
          console.warn('Video play failed:', playError);
        }
      }
      
      console.log('✅ Media initialized successfully');
      return stream;
      
    } catch (error) {
      console.error('❌ Error initializing media:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao inicializar mídia');
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to session
  const connectToSession = async () => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }
    
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      // Initialize media first
      const stream = await initializeMedia();
      if (!stream) {
        throw new Error('Falha ao inicializar mídia');
      }
      
      // Initialize WebRTC
      console.log('Initializing WebRTC connection...');
      await initParticipantWebRTC(sessionId, participantId, stream);
      
      setLocalStream(stream);
      setIsConnected(true);
      setConnectionStatus('connected');
      
      toast.success('Conectado à sessão com sucesso!');
      
    } catch (error) {
      console.error('❌ Error connecting to session:', error);
      setConnectionStatus('failed');
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Falha ao conectar à sessão');
    }
  };

  // Disconnect from session
  const disconnectFromSession = () => {
    try {
      // Stop all tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
        localStreamRef.current = null;
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped screen ${track.kind} track`);
        });
        screenStreamRef.current = null;
      }
      
      // Clear video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      // End WebRTC session
      endWebRTC();
      
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setHasVideo(false);
      setHasAudio(false);
      setHasScreenShare(false);
      
      toast.success('Desconectado da sessão');
      
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newEnabled = !isVideoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newEnabled;
        console.log(`Video track enabled: ${track.enabled}`);
      });
      
      setIsVideoEnabled(newEnabled);
      console.log(`Video toggled: ${newEnabled ? 'ON' : 'OFF'}`);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newEnabled = !isAudioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
        console.log(`Audio track enabled: ${track.enabled}`);
      });
      
      setIsAudioEnabled(newEnabled);
      console.log(`Audio toggled: ${newEnabled ? 'ON' : 'OFF'}`);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    try {
      if (hasScreenShare) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        // Switch back to camera
        const stream = await initializeMedia();
        if (stream) {
          setLocalStream(stream);
        }
        
        setHasScreenShare(false);
        toast.success('Compartilhamento de tela interrompido');
        
      } else {
        // Start screen sharing
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          
          screenStreamRef.current = screenStream;
          
          // Add audio from microphone if available
          if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
              screenStream.addTrack(track);
            });
          }
          
          setLocalStream(screenStream);
          setHasScreenShare(true);
          
          // Update video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }
          
          // Handle screen share end
          screenStream.getVideoTracks()[0].onended = () => {
            toggleScreenShare();
          };
          
          toast.success('Compartilhamento de tela iniciado');
          
        } catch (error) {
          console.error('Error starting screen share:', error);
          toast.error('Erro ao iniciar compartilhamento de tela');
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast.error('Erro ao alternar compartilhamento de tela');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromSession();
    };
  }, []);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'failed': return 'Falha na conexão';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Participante da Sessão
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-white border-white/30">
                ID: {sessionId}
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-white border-white/30 ${getConnectionStatusColor()}`}
              >
                {getConnectionStatusText()}
              </Badge>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="text-white border-white/30 hover:bg-white/10"
          >
            Voltar
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-500/50 bg-red-500/10">
            <CardContent className="p-4">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Video Preview */}
        <Card className="mb-6 bg-black/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Sua Transmissão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              
              {(!hasVideo || !isVideoEnabled) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="text-center text-white">
                    <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">
                      {!hasVideo ? 'Câmera não disponível' : 'Câmera desabilitada'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Status indicators */}
              <div className="absolute top-4 left-4 flex gap-2">
                {hasVideo && (
                  <Badge variant={isVideoEnabled ? "default" : "destructive"}>
                    {isVideoEnabled ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
                  </Badge>
                )}
                {hasAudio && (
                  <Badge variant={isAudioEnabled ? "default" : "destructive"}>
                    {isAudioEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                  </Badge>
                )}
                {hasScreenShare && (
                  <Badge variant="default">
                    <Monitor className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-black/30 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              {/* Video Toggle */}
              {hasVideo && (
                <Button
                  variant={isVideoEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleVideo}
                  className="h-12 w-12 rounded-full"
                >
                  {isVideoEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                </Button>
              )}

              {/* Audio Toggle */}
              {hasAudio && (
                <Button
                  variant={isAudioEnabled ? "default" : "destructive"}
                  size="lg"
                  onClick={toggleAudio}
                  className="h-12 w-12 rounded-full"
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              )}

              {/* Screen Share Toggle */}
              <Button
                variant={hasScreenShare ? "default" : "outline"}
                size="lg"
                onClick={toggleScreenShare}
                className="h-12 w-12 rounded-full"
                disabled={isConnecting}
              >
                {hasScreenShare ? <Monitor className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}
              </Button>

              {/* Connection Toggle */}
              <Button
                variant={isConnected ? "destructive" : "default"}
                size="lg"
                onClick={isConnected ? disconnectFromSession : connectToSession}
                disabled={isConnecting}
                className="h-12 w-12 rounded-full"
              >
                {isConnected ? <PhoneOff className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              </Button>

              {/* Settings */}
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-12 rounded-full"
                disabled
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>

            {/* Status Text */}
            <div className="text-center mt-4">
              <p className="text-white/70 text-sm">
                {isConnecting && 'Conectando à sessão...'}
                {isConnected && 'Transmitindo para a sessão'}
                {!isConnected && !isConnecting && 'Clique no botão de telefone para conectar'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Instruções:</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• Clique no botão de telefone para conectar/desconectar da sessão</li>
              <li>• Use os botões de câmera e microfone para controlar sua transmissão</li>
              <li>• O botão de monitor permite compartilhar sua tela</li>
              <li>• Sua transmissão será enviada para o host da sessão</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantPage;
