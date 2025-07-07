
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Settings, Monitor, MonitorOff, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';
import signalingService from '@/services/WebSocketSignalingService';

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
  const [signalingStatus, setSignalingStatus] = useState<string>('disconnected');

  // Monitor signaling service status
  useEffect(() => {
    const checkSignalingStatus = () => {
      const status = signalingService.getConnectionStatus();
      setSignalingStatus(status);
      console.log('📡 Signaling status:', status);
    };

    const interval = setInterval(checkSignalingStatus, 1000);
    checkSignalingStatus(); // Initial check

    return () => clearInterval(interval);
  }, []);

  // Auto-initialize media and connect on mount
  useEffect(() => {
    console.log('🚀 PARTICIPANT PAGE: Auto-initializing for session:', sessionId);
    
    if (sessionId) {
      autoConnectToSession();
    }
    
    return () => {
      cleanup();
    };
  }, [sessionId]);

  const autoConnectToSession = async () => {
    console.log('🎯 PARTICIPANT: Starting auto-connection process');
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Step 1: Test signaling connection first
      console.log('🔌 PARTICIPANT: Step 1 - Testing signaling connection');
      await signalingService.connect();
      
      const signalingReady = signalingService.isReady();
      console.log('📡 Signaling ready:', signalingReady);
      
      if (!signalingReady) {
        console.warn('⚠️ Signaling not ready, but continuing...');
      }

      // Step 2: Get user media with simpler constraints
      console.log('📹 PARTICIPANT: Step 2 - Getting user media');
      const stream = await getUserMediaWithFallback();

      if (!stream) {
        throw new Error('Falha ao obter stream de mídia');
      }

      localStreamRef.current = stream;
      
      // Update media states
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      setHasVideo(videoTracks.length > 0);
      setHasAudio(audioTracks.length > 0);
      
      console.log(`✅ PARTICIPANT: Media obtained - Video: ${videoTracks.length > 0}, Audio: ${audioTracks.length > 0}`);
      
      // Step 3: Display local video
      if (localVideoRef.current && videoTracks.length > 0) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
          console.log('✅ PARTICIPANT: Local video playing');
        } catch (playError) {
          console.warn('⚠️ PARTICIPANT: Video play warning:', playError);
        }
      }
      
      // Step 4: Initialize WebRTC connection
      console.log('🔗 PARTICIPANT: Step 4 - Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId!, participantId, stream);
      console.log('✅ PARTICIPANT: WebRTC initialized successfully');
      
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ PARTICIPANT: Auto-connection completed successfully');
      
      toast.success('Conectado automaticamente à sessão!');
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Auto-connection failed:', error);
      setConnectionStatus('failed');
      
      let errorMessage = 'Erro na conexão automática';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Mensagens específicas para diferentes tipos de erro
        if (error.message.includes('websocket') || error.message.includes('socket')) {
          errorMessage = 'Erro de conexão WebSocket. Verifique se o servidor está rodando em localhost:3001';
        } else if (error.message.includes('media') || error.message.includes('getUserMedia')) {
          errorMessage = 'Erro ao acessar câmera/microfone. Verifique as permissões do navegador';
        } else if (error.message.includes('WebRTC')) {
          errorMessage = 'Erro na conexão WebRTC. Tente reconectar';
        }
      }
      
      setError(errorMessage);
      toast.error('Falha na conexão automática. Tente reconectar manualmente.');
    } finally {
      setIsConnecting(false);
    }
  };

  const getUserMediaWithFallback = async (): Promise<MediaStream | null> => {
    // Lista de configurações em ordem de preferência
    const constraintsList = [
      // Tentar com vídeo e áudio básicos primeiro
      { video: true, audio: true },
      // Tentar apenas com vídeo
      { video: true, audio: false },
      // Tentar com configurações básicas específicas
      { 
        video: { width: 640, height: 480, facingMode: 'user' }, 
        audio: { echoCancellation: true } 
      },
      // Configuração mínima
      { video: { width: 320, height: 240 }, audio: false },
      // Apenas áudio como último recurso
      { video: false, audio: true }
    ];

    for (let i = 0; i < constraintsList.length; i++) {
      const constraints = constraintsList[i];
      try {
        console.log(`🎥 PARTICIPANT: Trying constraints ${i + 1}/${constraintsList.length}:`, constraints);
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia não é suportado neste navegador');
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ PARTICIPANT: Successfully obtained user media:', {
          tracks: stream.getTracks().map(t => ({ 
            kind: t.kind, 
            label: t.label, 
            enabled: t.enabled,
            readyState: t.readyState 
          }))
        });
        return stream;
      } catch (error) {
        console.error(`❌ PARTICIPANT: Constraints ${i + 1} failed:`, error);
        
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            // Se o usuário negou permissão, não adianta tentar outras configurações
            toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
            throw error;
          } else if (error.name === 'NotFoundError' && i === 0) {
            // Se não encontrou dispositivos na primeira tentativa, mostra aviso mas continua tentando
            console.warn('⚠️ PARTICIPANT: No media devices found, trying fallback options...');
          }
        }
        
        // Se é a última tentativa, relança o erro
        if (i === constraintsList.length - 1) {
          throw error;
        }
      }
    }

    throw new Error('Não foi possível acessar câmera nem microfone com nenhuma configuração');
  };

  // Manual connect (for retry)
  const connectToSession = async () => {
    if (!sessionId) {
      toast.error('ID da sessão não encontrado');
      return;
    }
    
    await autoConnectToSession();
  };

  // Disconnect from session
  const disconnectFromSession = () => {
    try {
      cleanup();
      
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setHasVideo(false);
      setHasAudio(false);
      setHasScreenShare(false);
      
      toast.success('Desconectado da sessão');
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    }
  };

  const cleanup = () => {
    console.log('🧹 PARTICIPANT: Cleaning up');
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`PARTICIPANT: Stopped ${track.kind} track`);
      });
      localStreamRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`PARTICIPANT: Stopped screen ${track.kind} track`);
      });
      screenStreamRef.current = null;
    }
    
    // Clear video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Cleanup WebRTC
    cleanupWebRTC();
    
    // Disconnect signaling
    signalingService.disconnect();
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newEnabled = !isVideoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newEnabled;
        console.log(`PARTICIPANT: Video track enabled: ${track.enabled}`);
      });
      
      setIsVideoEnabled(newEnabled);
      console.log(`PARTICIPANT: Video toggled: ${newEnabled ? 'ON' : 'OFF'}`);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newEnabled = !isAudioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
        console.log(`PARTICIPANT: Audio track enabled: ${track.enabled}`);
      });
      
      setIsAudioEnabled(newEnabled);
      console.log(`PARTICIPANT: Audio toggled: ${newEnabled ? 'ON' : 'OFF'}`);
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
        await autoConnectToSession();
        
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
          
          // Update local stream
          localStreamRef.current = screenStream;
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
          console.error('PARTICIPANT: Error starting screen share:', error);
          toast.error('Erro ao iniciar compartilhamento de tela');
        }
      }
    } catch (error) {
      console.error('PARTICIPANT: Error toggling screen share:', error);
      toast.error('Erro ao alternar compartilhamento de tela');
    }
  };

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

  const getSignalingStatusColor = () => {
    switch (signalingStatus) {
      case 'connected': return 'text-green-400';
      case 'reconnecting': return 'text-yellow-400';
      case 'fallback': return 'text-orange-400';
      default: return 'text-red-400';
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
              <Badge variant="outline" className="text-white border-white/30">
                <div className="flex items-center gap-1">
                  {signalingStatus === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  <span className={getSignalingStatusColor()}>
                    {signalingStatus}
                  </span>
                </div>
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
              <Button 
                onClick={connectToSession}
                className="mt-2"
                disabled={isConnecting}
              >
                Tentar Reconectar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connection Status Details */}
        <Card className="mb-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Status da Conexão:</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-white/70">WebSocket:</span>
                <span className={`ml-2 ${getSignalingStatusColor()}`}>
                  {signalingStatus}
                </span>
              </div>
              <div>
                <span className="text-white/70">WebRTC:</span>
                <span className={`ml-2 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                  {connectionStatus}
                </span>
              </div>
              <div>
                <span className="text-white/70">Vídeo:</span>
                <span className={`ml-2 ${hasVideo ? 'text-green-400' : 'text-red-400'}`}>
                  {hasVideo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
                <span className="text-white/70">Áudio:</span>
                <span className={`ml-2 ${hasAudio ? 'text-green-400' : 'text-red-400'}`}>
                  {hasAudio ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

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
                  disabled={isConnecting}
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
                  disabled={isConnecting}
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
                {isConnected && !isConnecting && 'Conectado - transmitindo para o host'}
                {!isConnected && !isConnecting && 'Desconectado da sessão'}
                {connectionStatus === 'failed' && ' - Clique no botão de telefone para reconectar'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6 bg-black/20 border-white/10">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-2">Instruções:</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• Verifique se o servidor de sinalização está rodando em localhost:3001</li>
              <li>• A câmera e microfone são inicializados automaticamente com fallback</li>
              <li>• Use os controles para ajustar vídeo, áudio e compartilhamento de tela</li>
              <li>• Se houver problemas de conexão, use o botão de reconexão</li>
              <li>• O status do WebSocket deve mostrar "connected" para funcionar corretamente</li>
              <li>• Permita acesso à câmera/microfone quando solicitado pelo navegador</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantPage;
