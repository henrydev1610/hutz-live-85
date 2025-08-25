// FASE 4: Dashboard de status dos servidores TURN
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { turnServerDiagnostics } from '@/utils/webrtc/TurnServerDiagnostics';

interface TurnServerStatus {
  url: string;
  username?: string;
  isWorking: boolean;
  lastTest: number;
  latency?: number;
  error?: string;
}

interface StatusDashboard {
  timestamp: number;
  summary: {
    turnServers: number;
    stunServers: number;
    turnWorking: number;
    turnHealth: number;
  };
  servers: {
    turn: TurnServerStatus[];
    stun: { url: string; type: string }[];
  };
  recommendations: string[];
}

export function TurnServerStatusPanel() {
  const [status, setStatus] = useState<StatusDashboard | null>(null);
  const [testing, setTesting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadStatus = () => {
    const dashboard = turnServerDiagnostics.getStatusDashboard();
    setStatus(dashboard);
  };

  const runTests = async () => {
    setTesting(true);
    try {
      await turnServerDiagnostics.testAllTurnServers();
      loadStatus();
    } catch (error) {
      console.error('Failed to test TURN servers:', error);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    loadStatus();
    
    if (autoRefresh) {
      const interval = setInterval(loadStatus, 30000); // 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (!status) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando status dos servidores...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-600';
    if (health >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = (health: number) => {
    if (health >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (health >= 50) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-4 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getHealthIcon(status.summary.turnHealth)}
              Status dos Servidores TURN
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-50' : ''}
              >
                Auto: {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={runTests}
                disabled={testing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin' : ''}`} />
                Testar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{status.summary.turnServers}</div>
              <div className="text-sm text-muted-foreground">TURN Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{status.summary.stunServers}</div>
              <div className="text-sm text-muted-foreground">STUN Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{status.summary.turnWorking}</div>
              <div className="text-sm text-muted-foreground">Funcionando</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getHealthColor(status.summary.turnHealth)}`}>
                {status.summary.turnHealth}%
              </div>
              <div className="text-sm text-muted-foreground">Saúde</div>
            </div>
          </div>

          {/* TURN Servers */}
          {status.servers.turn.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Servidores TURN</h4>
              <div className="space-y-2">
                {status.servers.turn.map((server, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-mono text-sm">{server.url}</div>
                      {server.username && (
                        <div className="text-xs text-muted-foreground">Usuario: {server.username}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {server.latency && (
                        <Badge variant="outline">{server.latency}ms</Badge>
                      )}
                      <Badge variant={server.isWorking ? 'default' : 'destructive'}>
                        {server.isWorking ? 'OK' : 'FALHA'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STUN Servers */}
          {status.servers.stun.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Servidores STUN</h4>
              <div className="space-y-2">
                {status.servers.stun.map((server, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="font-mono text-sm">{server.url}</div>
                    <Badge variant="secondary">STUN</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {status.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Recomendações</h4>
              <div className="space-y-1">
                {status.recommendations.map((rec, index) => (
                  <div key={index} className="text-sm p-2 bg-muted rounded">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center">
            Última atualização: {new Date(status.timestamp).toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}