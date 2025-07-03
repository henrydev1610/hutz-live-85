import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Settings, Monitor, MonitorOff } from "lucide-react";
import { toast } from "sonner";
import { setupParticipantWebRTC, setLocalStream, endWebRTC } from '@/utils/webrtcUtils';

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

  // Get user media with enhanced error handling and better constraints
  const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      console.log('🎥 Requesting user media with constraints:', constraints);
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia não é suportado neste navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Successfully obtained user media:', {
        tracks: stream.getTracks().map(t => ({ 
          kind: t.kind, 
          label: t.label, 
          enabled: t.enabled,
          readyState: t.readyState 
        }))
      });
      return stream;
    } catch (error) {
      console.error('❌ Error getting user media:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
        } else if (error.name === 'NotFoundError') {
          toast.error('Câmera ou microfone não encontrados. Verifique se os dispositivos estão conectados.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Câmera ou microfone já estão sendo usados por outro aplicativo.');
        } else if (error.name === 'OverconstrainedError') {
          toast.error('Configurações de vídeo/áudio não suportadas pelo dispositivo.');
        } else {
          toast.error(`Erro ao acessar mídia: ${error.message}`);
        }
      }
      
      return null;
    }
  };

  // Initialize media stream with fallback options
  const initializeMedia = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('🎥 Starting media initialization...');
      
      // Try different constraint combinations, starting with ideal and falling back
      const constraintOptions = [
        // First try: High quality
        { 
          video: { 
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        },
        // Second try: Medium quality
        { 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          }, 
          audio: true 
        },
        // Third try: Basic video
        { video: true, audio: true },
        // Fourth try: Audio only
        { audio: true },
        // Last try: Very basic
        { video: { width: 320, height: 240 }, audio: true }
      ];
      
      let stream: MediaStream | null = null;
      
      for (let i = 0; i < constraintOptions.length; i++) {
        console.log(`🎥 Trying constraint option ${i + 1}:`, constraintOptions[i]);
        
        try {
          stream = await getUserMedia(constraintOptions[i]);
          if (stream) {
            console.log(`✅ Success with constraint option ${i + 1}`);
            break;
          }
        } catch (constraintError) {
          console.log(`❌ Constraint option ${i + 1} failed:`, constraintError);
          // Continue to next option
        }
      }
      
      if (!stream) {
        throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
      }
      
      localStreamRef.current = stream;
      
      // Update media availability states
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`✅ Media initialized - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      // Set initial enabled states
      videoTracks.forEach(track => {
        track.enabled = isVideoEnabled;
        console.log(`Video track ${track.id} enabled: ${track.enabled}`);
      });
      audioTracks.forEach(track => {
        track.enabled = isAudioEnabled;
        console.log(`Audio track ${track.id} enabled: ${track.enabled}`);
      });
      
      // Display local video
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        
        // Enhanced video element setup
        localVideoRef.current.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded');
          if (localVideoRef.current) {
            localVideoRef.current.play()
              .then(() => console.log('✅ Video playing successfully'))
              .catch(playErr => console.warn('⚠️ Video play warning:', playErr));
          }
        };
        
        // Try to play immediately
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video is playing');
        } catch (playError) {
          console.warn('⚠️ Video play failed initially, will retry when metadata loads:', playError);
        }
      }
      
      console.log('✅ Media initialized successfully');
      toast.success('Câmera e microfone acessados com sucesso!');
      return stream;
      
    } catch (error) {
      console.error('❌ Error initializing media:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao inicializar mídia';
      setError(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to session - now works even if WebRTC fails
  const connectToSession = async () => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }
    
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      // Initialize media first (this is the most important part)
      const stream = await initializeMedia();
      if (!stream) {
        throw new Error('Falha ao inicializar mídia');
      }
      
      // Try to initialize WebRTC, but don't fail if it doesn't work
      try {
        console.log('🔗 Attempting WebRTC connection...');
        await setupParticipantWebRTC(sessionId, participantId, stream);
        setLocalStream(stream);
        console.log('✅ WebRTC connected successfully');
        toast.success('Conectado à sessão com sucesso!');
      } catch (webrtcError) {
        console.warn('⚠️ WebRTC connection failed, but media is working:', webrtcError);
        // Still set the local stream for preview
        setLocalStream(stream);
        toast.success('Mídia inicializada! Conexão WebRTC em modo local.');
      }
      
      setIsConnected(true);
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('❌ Error connecting to session:', error);
      setConnectionStatus('failed');
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
      toast.error('Falha ao acessar câmera/microfone');
    }
  };

  // Auto-initialize media on component mount
  useEffect(() => {
    console.log('🚀 ParticipantPage mounted, auto-initializing media...');
    initializeMedia().catch(error => {
      console.error('❌ Auto-initialization failed:', error);
    });
  }, []);

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
                {isConnecting && 'Inicializando câmera e microfone...'}
                {isConnected && !isConnecting && 'Mídia ativa - pronto para transmitir'}
                {!isConnected && !isConnecting && 'Clique no botão de telefone para conectar à sessão'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Instruções:</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• A câmera e microfone são inicializados automaticamente</li>
              <li>• Use os botões de câmera e microfone para controlar sua transmissão</li>
              <li>• O botão de monitor permite compartilhar sua tela</li>
              <li>• Clique no botão de telefone para conectar/desconectar da sessão</li>
              <li>• Sua transmissão funcionará mesmo em modo local se a conexão falhar</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantPage;
