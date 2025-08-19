
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
  Monitor,
  Smartphone
} from 'lucide-react';
import { detectMobileAggressively, validateMobileCameraCapabilities } from '@/utils/media/deviceDetection';
import { getUserMediaWithFallback } from '@/utils/media/getUserMediaFallback';

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
  const [isTestingMobileCamera, setIsTestingMobileCamera] = useState(false);
  const [mobileTestResult, setMobileTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setLastTestResult(null);
    
    try {
      // Test getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      toast({
        title: "Teste de câmera bem-sucedido",
        description: "Sua câmera está funcionando corretamente"
      });
      
      // Clean up test stream
      stream.getTracks().forEach(track => track.stop());
      
      // Call the provided test function
      onTestConnection();
      
      setLastTestResult('success');
      
    } catch (error) {
      console.error('Test connection failed:', error);
      
      toast({
        title: "Erro no teste de conexão",
        description: "Verifique as permissões da câmera",
        variant: "destructive"
      });
      
      setLastTestResult('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTestMobileCamera = async () => {
    setIsTestingMobileCamera(true);
    setMobileTestResult(null);
    
    try {
      // Check if device is mobile
      const isMobile = detectMobileAggressively();
      
      if (!isMobile) {
        toast({
          title: "⚠️ Dispositivo não é móvel",
          description: "Este teste é específico para câmeras de celular",
          variant: "destructive"
        });
        setMobileTestResult('error');
        return;
      }

      // Test environment camera first (back camera - typical mobile)
      let stream: MediaStream | null = null;
      let facingMode = 'unknown';
      let resolution = 'unknown';
      
      try {
        // Test environment camera first (back camera)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { exact: 'environment' } } 
          });
        } catch (error) {
          // Fallback to front camera
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: { exact: 'user' } } 
            });
          } catch (error2) {
            // Final fallback to any camera
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: true 
            });
          }
        }
        
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          facingMode = settings.facingMode || 'unknown';
          resolution = `${settings.width}x${settings.height}`;
          
          toast({
            title: "📱 Câmera móvel funcionando!",
            description: `${facingMode === 'environment' ? 'Câmera traseira' : 'Câmera frontal'} detectada - ${resolution}`
          });
          
          setMobileTestResult('success');
        }
        
      } catch (error) {
        console.error('Mobile camera test failed:', error);
        
        toast({
          title: "❌ Erro na câmera móvel",
          description: "Câmera do celular não detectada",
          variant: "destructive"
        });
        
        setMobileTestResult('error');
      } finally {
        // Clean up test stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
      
    } catch (error) {
      console.error('Mobile detection failed:', error);
      setMobileTestResult('error');
    } finally {
      setIsTestingMobileCamera(false);
    }
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
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Video className="h-4 w-4" />
                <span className="font-semibold" id="active-streams-count">{activeStreams}</span>
              </div>
              <button
                onClick={() => {
                  console.log('🔄 [DEBUG] Forçando atualização de streams...');
                  console.log('🔍 [DEBUG] Estado atual:', {
                    activeStreams,
                    participantCount,
                    timestamp: Date.now()
                  });
                  
                  // Forçar refresh via global debug function
                  if ((window as any).__livePageDebug) {
                    (window as any).__livePageDebug.forceStreamRefresh();
                  }
                  
                  // Forçar re-render
                  const event = new CustomEvent('force-streams-refresh');
                  window.dispatchEvent(event);
                }}
                className="p-1 rounded hover:bg-gray-700 transition-colors"
                title="Forçar atualização de streams"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>

        {/* Test Connection Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="w-full"
            variant={lastTestResult === 'success' ? 'default' : 'outline'}
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Testar Conexão de Vídeo
              </>
            )}
          </Button>
          
          {lastTestResult && (
            <div className="mt-2 text-center text-sm">
              {lastTestResult === 'success' ? (
                <span className="text-green-600">✅ Teste bem-sucedido</span>
              ) : (
                <span className="text-red-600">❌ Teste falhou</span>
              )}
            </div>
          )}
        </div>

        {/* Test Mobile Camera Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleTestMobileCamera}
            disabled={isTestingMobileCamera}
            className="w-full"
            variant={mobileTestResult === 'success' ? 'default' : 'outline'}
          >
            {isTestingMobileCamera ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testando câmera móvel...
              </>
            ) : (
              <>
                <Smartphone className="mr-2 h-4 w-4" />
                Testar Câmera do Celular
              </>
            )}
          </Button>
          
          {mobileTestResult && (
            <div className="mt-2 text-center text-sm">
              {mobileTestResult === 'success' ? (
                <span className="text-green-600">✅ Câmera móvel funcionando</span>
              ) : (
                <span className="text-red-600">❌ Câmera móvel falhou</span>
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
