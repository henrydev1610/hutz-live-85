import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

interface ConnectionDiagnosticsReportProps {
  sessionId: string | null;
  participantStreams: { [id: string]: MediaStream };
  participantList: any[];
  isHost?: boolean;
  onForceRecovery?: () => void;
}

interface DiagnosticResult {
  component: string;
  status: 'good' | 'warning' | 'error';
  message: string;
  details?: string;
}

export const ConnectionDiagnosticsReport: React.FC<ConnectionDiagnosticsReportProps> = ({
  sessionId,
  participantStreams,
  participantList,
  isHost = false,
  onForceRecovery
}) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const runDiagnostics = () => {
    const results: DiagnosticResult[] = [];
    
    // 1. Verificar SessionId
    if (!sessionId) {
      results.push({
        component: 'Session',
        status: 'error',
        message: 'Sessão não inicializada',
        details: 'sessionId é null'
      });
    } else {
      results.push({
        component: 'Session',
        status: 'good',
        message: `Sessão ativa: ${sessionId.substring(0, 8)}...`
      });
    }

    // 2. Verificar WebSocket
    const ws = (window as any).unifiedWebSocketService;
    if (ws) {
      const connected = ws.isConnected();
      results.push({
        component: 'WebSocket',
        status: connected ? 'good' : 'error',
        message: connected ? 'Conectado' : 'Desconectado',
        details: connected ? `Status: ${ws.getConnectionStatus()}` : 'Verificar conexão de rede'
      });
    } else {
      results.push({
        component: 'WebSocket',
        status: 'error',
        message: 'Serviço não encontrado',
        details: 'unifiedWebSocketService não inicializado'
      });
    }

    // 3. Verificar Participantes
    const participantCount = participantList.length;
    if (isHost) {
      if (participantCount === 0) {
        results.push({
          component: 'Participantes',
          status: 'warning',
          message: 'Nenhum participante conectado',
          details: 'Aguardando conexões'
        });
      } else {
        results.push({
          component: 'Participantes',
          status: 'good',
          message: `${participantCount} participante(s) conectado(s)`
        });
      }
    } else {
      results.push({
        component: 'Participantes',
        status: 'good',
        message: 'Modo participante ativo'
      });
    }

    // 4. Verificar Streams
    const streamCount = Object.keys(participantStreams).length;
    if (isHost && participantCount > 0 && streamCount === 0) {
      results.push({
        component: 'Streams',
        status: 'error',
        message: 'Participantes conectados mas sem streams',
        details: 'Possível problema de WebRTC'
      });
    } else if (streamCount > 0) {
      results.push({
        component: 'Streams',
        status: 'good',
        message: `${streamCount} stream(s) ativo(s)`,
        details: Object.keys(participantStreams).map(id => `${id.substring(0, 8)}...`).join(', ')
      });
    } else {
      results.push({
        component: 'Streams',
        status: 'warning',
        message: 'Nenhum stream ativo',
        details: isHost ? 'Aguardando streams de participantes' : 'Verificar câmera/microfone'
      });
    }

    // 5. Verificar Ponte Host → Popup (apenas para host)
    if (isHost) {
      const hasHostCallback = typeof (window as any).hostStreamCallback === 'function';
      const hasGetParticipantStream = typeof (window as any).getParticipantStream === 'function';
      const hasMLStreams = !!(window as any).__mlStreams__;
      
      if (hasHostCallback && hasGetParticipantStream && hasMLStreams) {
        results.push({
          component: 'Ponte Host→Popup',
          status: 'good',
          message: 'Callbacks registrados corretamente',
          details: `Streams em cache: ${Object.keys((window as any).__mlStreams__ || {}).length}`
        });
      } else {
        results.push({
          component: 'Ponte Host→Popup',
          status: 'error',
          message: 'Callbacks não registrados',
          details: `hostCallback: ${hasHostCallback}, getStream: ${hasGetParticipantStream}, cache: ${hasMLStreams}`
        });
      }
    }

    // 6. Verificar WebRTC PeerConnections
    const activePCs = (window as any).__activePeerConnections__ || {};
    const pcCount = Object.keys(activePCs).length;
    if (isHost && participantCount > 0 && pcCount === 0) {
      results.push({
        component: 'WebRTC',
        status: 'error',
        message: 'Nenhuma PeerConnection ativa',
        details: 'Handshake WebRTC não completado'
      });
    } else if (pcCount > 0) {
      results.push({
        component: 'WebRTC',
        status: 'good',
        message: `${pcCount} PeerConnection(s) ativa(s)`
      });
    } else {
      results.push({
        component: 'WebRTC',
        status: 'warning',
        message: 'Aguardando PeerConnections'
      });
    }

    setDiagnostics(results);
    setLastUpdate(Date.now());
  };

  useEffect(() => {
    // Executar diagnósticos a cada 10 segundos
    const interval = setInterval(runDiagnostics, 10000);
    
    // Executar diagnósticos imediatamente
    runDiagnostics();
    
    return () => clearInterval(interval);
  }, [sessionId, participantStreams, participantList, isHost]);

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'good': return 'OK';
      case 'warning': return 'AVISO';
      case 'error': return 'ERRO';
      default: return 'DESCONHECIDO';
    }
  };

  const hasErrors = diagnostics.some(d => d.status === 'error');
  const hasWarnings = diagnostics.some(d => d.status === 'warning');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔍 Diagnóstico de Conexão</span>
          <Badge variant={hasErrors ? 'destructive' : hasWarnings ? 'secondary' : 'default'}>
            {hasErrors ? 'PROBLEMAS DETECTADOS' : hasWarnings ? 'ATENÇÃO' : 'TUDO OK'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Geral */}
        {hasErrors && (
          <Alert variant="destructive">
            <AlertDescription>
              Problemas críticos detectados na conexão. Clique em "Forçar Recovery" para tentar corrigir.
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de Diagnósticos */}
        <div className="space-y-2">
          {diagnostics.map((diagnostic, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Badge className={getStatusColor(diagnostic.status)}>
                  {getStatusText(diagnostic.status)}
                </Badge>
                <div>
                  <div className="font-medium">{diagnostic.component}</div>
                  <div className="text-sm text-muted-foreground">{diagnostic.message}</div>
                  {diagnostic.details && (
                    <div className="text-xs text-muted-foreground mt-1">{diagnostic.details}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Controles */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Última atualização: {new Date(lastUpdate).toLocaleTimeString()}
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={runDiagnostics}>
              🔄 Atualizar
            </Button>
            {hasErrors && onForceRecovery && (
              <Button variant="destructive" size="sm" onClick={onForceRecovery}>
                🔧 Forçar Recovery
              </Button>
            )}
          </div>
        </div>

        {/* Informações Técnicas */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Detalhes técnicos
          </summary>
          <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
            <div>Session: {sessionId || 'null'}</div>
            <div>Participants: {participantList.length}</div>
            <div>Streams: {Object.keys(participantStreams).length}</div>
            <div>Role: {isHost ? 'Host' : 'Participant'}</div>
            <div>Timestamp: {lastUpdate}</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
};