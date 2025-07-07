
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, Mic, MicOff, Phone, PhoneOff, Settings, Monitor, MonitorOff } from "lucide-react";
import { toast } from "sonner";
import { initParticipantWebRTC, cleanupWebRTC } from '@/utils/webrtc';

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
      // Step 1: Get user media
      console.log('📹 PARTICIPANT: Step 1 - Getting user media');
      const stream = await getUserMedia({ 
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
      });

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
      
      // Step 2: Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
          console.log('✅ PARTICIPANT: Local video playing');
        } catch (playError) {
          console.warn('⚠️ PARTICIPANT: Video play warning:', playError);
        }
      }
      
      // Step 3: Initialize WebRTC connection
      console.log('🔗 PARTICIPANT: Step 3 - Initializing WebRTC connection');
      await initParticipantWebRTC(sessionId!, participantId, stream);
      
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('✅ PARTICIPANT: Auto-connection completed successfully');
      
      toast.success('Conectado automaticamente à sessão!');
      
    } catch (error) {
      console.error('❌ PARTICIPANT: Auto-connection failed:', error);
      setConnectionStatus('failed');
      setError(error instanceof Error ? error.message : 'Erro na conexão automática');
      toast.error('Falha na conexão automática. Tente reconectar manualmente.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Get user media with enhanced error handling
  const getUserMedia = async (constraints: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      console.log('🎥 PARTICIPANT: Requesting user media with constraints:', constraints);
      
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
      console.error('❌ PARTICIPANT: Error getting user media:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
        } else if (error.name === 'NotFoundError') {
          toast.error('Câmera ou microfone não encontrados. Verifique se os dispositivos estão conectados.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Câmera ou microfone já estão sendo usados por outro aplicativo.');
        } else if (error.name === 'OverconstrainedError') {
          // Try with fallback constraints
          console.log('🔄 PARTICIPANT: Trying fallback constraints');
          return getUserMediaFallback();
        } else {
          toast.error(`Erro ao acessar mídia: ${error.message}`);
        }
      }
      
      return null;
    }
  };

  const getUserMediaFallback = async (): Promise<MediaStream | null> => {
    const fallbackConstraints = [
      { video: { width: 640, height: 480 }, audio: true },
      { video: true, audio: true },
      { video: { width: 320, height: 240 }, audio: true },
      { audio: true }
    ];

    for (const constraints of fallbackConstraints) {
      try {
        console.log('🔄 PARTICIPANT: Trying fallback constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ PARTICIPANT: Fallback constraints worked');
        return stream;
      } catch (error) {
        console.log('❌ PARTICIPANT: Fallback attempt failed:', error);
        continue;
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
            <h3 className="text-white font-semibold mb-2">Status da Conexão:</h3>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• A câmera e microfone são inicializados automaticamente</li>
              <li>• Sua transmissão está sendo enviada para o host em tempo real</li>
              <li>• Use os controles para ajustar vídeo, áudio e compartilhamento de tela</li>
              <li>• Se houver problemas, use o botão de reconexão</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantPage;
