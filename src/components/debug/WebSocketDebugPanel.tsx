import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';
import { getWebSocketURL } from '@/utils/connectionUtils';

export const WebSocketDebugPanel = () => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [metrics, setMetrics] = useState({
    attemptCount: 0,
    errorCount: 0,
    consecutiveFailures: 0,
    lastAttempt: 0,
    lastSuccess: 0,
    status: 'disconnected' as 'disconnected' | 'connecting' | 'connected' | 'failed',
  });
  const [wsUrl, setWsUrl] = useState('');

  useEffect(() => {
    setWsUrl(getWebSocketURL());
    
    const interval = setInterval(() => {
      const serviceMetrics = unifiedWebSocketService.getMetrics();
      setMetrics(serviceMetrics);
      setStatus(serviceMetrics.status);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = () => {
    unifiedWebSocketService.disconnect();
    setTimeout(() => {
      unifiedWebSocketService.connect();
    }, 500);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500 text-white';
      case 'connecting': return 'bg-yellow-500 text-white';
      case 'failed': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusText = () => {
    if (status === 'connected' && metrics.lastSuccess > 0) {
      const uptime = Math.floor((Date.now() - metrics.lastSuccess) / 1000);
      return `CONECTADO (${uptime}s)`;
    }
    return status.toUpperCase();
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>WebSocket Debug</span>
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div>
          <p className="font-semibold mb-1">URL:</p>
          <p className="text-muted-foreground break-all">{wsUrl}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="font-semibold">Tentativas:</p>
            <p className="text-muted-foreground">{metrics.attemptCount}</p>
          </div>
          <div>
            <p className="font-semibold">Erros:</p>
            <p className="text-muted-foreground">{metrics.errorCount}</p>
          </div>
          <div>
            <p className="font-semibold">Falhas Consecutivas:</p>
            <p className="text-muted-foreground">{metrics.consecutiveFailures}</p>
          </div>
          <div>
            <p className="font-semibold">Última Tentativa:</p>
            <p className="text-muted-foreground">
              {metrics.lastAttempt ? `${Math.floor((Date.now() - metrics.lastAttempt) / 1000)}s atrás` : 'N/A'}
            </p>
          </div>
        </div>

        {metrics.lastSuccess > 0 && (
          <div>
            <p className="font-semibold">Último Sucesso:</p>
            <p className="text-muted-foreground">
              {Math.floor((Date.now() - metrics.lastSuccess) / 1000)}s atrás
            </p>
          </div>
        )}

        <Button 
          onClick={handleReconnect} 
          size="sm" 
          className="w-full"
          disabled={status === 'connecting'}
        >
          {status === 'connecting' ? 'Conectando...' : 'Forçar Reconexão'}
        </Button>

        <div className="pt-2 border-t">
          <p className="text-muted-foreground text-xs">
            Pressione F12 para ver logs detalhados no console
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
