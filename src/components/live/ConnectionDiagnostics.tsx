
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Wifi, 
  WifiOff, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Video,
  Monitor
} from 'lucide-react';

interface ConnectionDiagnosticsProps {
  sessionId: string | null;
  participantCount: number;
  activeStreams: number;
  onTestConnection: () => void;
}

const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  sessionId,
  participantCount,
  activeStreams,
  onTestConnection
}) => {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<'success' | 'error' | null>(null);
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleTestConnection = async () => {
    if (testStream) {
      // Stop current test
      stopTestStream();
      return;
    }

    setIsTestingConnection(true);
    setLastTestResult(null);
    
    try {
      console.log('🎥 Testing camera connection...');
      
      // Test getUserMedia with desktop-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, 
        audio: false 
      });
      
      console.log('✅ Camera test successful, showing preview');
      
      // Show stream in video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
      
      setTestStream(stream);
      setLastTestResult('success');
      
      toast({
        title: "Teste de câmera bem-sucedido",
        description: "Sua câmera está funcionando! Clique novamente para parar."
      });
      
      // Call the provided test function
      onTestConnection();
      
    } catch (error) {
      console.error('❌ Camera test failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "Erro no teste de conexão",
        description: `Verifique as permissões da câmera: ${errorMessage}`,
        variant: "destructive"
      });
      
      setLastTestResult('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const stopTestStream = () => {
    console.log('🛑 Stopping camera test');
    
    if (testStream) {
      testStream.getTracks().forEach(track => track.stop());
      setTestStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    toast({
      title: "Teste finalizado",
      description: "Câmera desconectada"
    });
  };

  const getConnectionStatus = () => {
    if (!sessionId) return { status: 'disconnected', label: 'Desconectado', color: 'destructive' };
    
    // Check if we have WebRTC connections even without streams counted
    const hasWebRTCConnections = participantCount > 0;
    const hasActiveStreams = activeStreams > 0;
    
    if (hasActiveStreams) return { status: 'connected', label: 'Conectado com vídeo', color: 'default' };
    if (hasWebRTCConnections) return { status: 'connected', label: 'Conectado', color: 'default' };
    return { status: 'waiting', label: 'Aguardando participantes', color: 'outline' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Diagnósticos de Conexão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status da Conexão:</span>
          <div className="flex items-center gap-2">
            {connectionStatus.status === 'connected' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {connectionStatus.status === 'partial' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
            {connectionStatus.status === 'disconnected' && <XCircle className="h-4 w-4 text-red-500" />}
            {connectionStatus.status === 'waiting' && <Wifi className="h-4 w-4 text-blue-500" />}
            <Badge variant={connectionStatus.color as any}>
              {connectionStatus.label}
            </Badge>
          </div>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Sessão:</span>
            <p className="font-mono text-xs truncate">
              {sessionId ? sessionId.substring(0, 8) + '...' : 'Nenhuma'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Participantes:</span>
            <p className="font-semibold">{participantCount}</p>
          </div>
        </div>

        {/* Stream Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Streams Ativos:</span>
          <div className="flex items-center gap-1">
            <Video className="h-4 w-4" />
            <span className="font-semibold">{activeStreams}</span>
          </div>
        </div>

        {/* Camera Test Preview */}
        {testStream && (
          <div className="pt-4 border-t">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2">
                <Badge variant="default" className="bg-green-600">
                  🔴 Ao Vivo
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Test Connection Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="w-full"
            variant={testStream ? 'destructive' : (lastTestResult === 'success' ? 'default' : 'outline')}
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : testStream ? (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Parar Teste de Vídeo
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Testar Conexão de Vídeo
              </>
            )}
          </Button>
          
          {lastTestResult && !testStream && (
            <div className="mt-2 text-center text-sm">
              {lastTestResult === 'success' ? (
                <span className="text-green-600">✅ Teste bem-sucedido</span>
              ) : (
                <span className="text-red-600">❌ Teste falhou</span>
              )}
            </div>
          )}
        </div>

        {/* WebRTC Support Check */}
        <div className="text-xs text-muted-foreground">
          <p>WebRTC: {typeof RTCPeerConnection !== 'undefined' ? '✅ Suportado' : '❌ Não suportado'}</p>
          <p>getUserMedia: {navigator.mediaDevices?.getUserMedia ? '✅ Disponível' : '❌ Indisponível'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectionDiagnostics;
