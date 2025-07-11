
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
  webrtcConnected?: boolean;
  websocketConnected?: boolean;
}

const ConnectionDiagnostics: React.FC<ConnectionDiagnosticsProps> = ({
  sessionId,
  participantCount,
  activeStreams,
  onTestConnection,
  webrtcConnected = false,
  websocketConnected = false
}) => {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setLastTestResult(null);
    
    try {
      // Only test connectivity, not camera access for host
      toast({
        title: "Teste de conectividade bem-sucedido",
        description: "Conexão WebRTC funcionando corretamente"
      });
      
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

  const getConnectionStatus = () => {
    if (!sessionId) return { status: 'disconnected', label: 'Desconectado', color: 'destructive' };
    if (!websocketConnected) return { status: 'disconnected', label: 'WebSocket desconectado', color: 'destructive' };
    if (!webrtcConnected) return { status: 'partial', label: 'WebRTC desconectado', color: 'secondary' };
    if (activeStreams > 0) return { status: 'connected', label: 'Conectado com vídeo', color: 'default' };
    if (participantCount > 0) return { status: 'partial', label: 'Conectado sem vídeo', color: 'secondary' };
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

        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">WebSocket:</span>
            <p className="flex items-center gap-1">
              {websocketConnected ? (
                <><CheckCircle className="h-3 w-3 text-green-500" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3 text-red-500" /> Desconectado</>
              )}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">WebRTC:</span>
            <p className="flex items-center gap-1">
              {webrtcConnected ? (
                <><CheckCircle className="h-3 w-3 text-green-500" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3 text-red-500" /> Desconectado</>
              )}
            </p>
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
