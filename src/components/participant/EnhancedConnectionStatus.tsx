import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Zap, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface EnhancedConnectionStatusProps {
  stage: 'idle' | 'warming' | 'connecting' | 'webrtc' | 'connected' | 'failed';
  isConnecting: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDiagnose?: () => void;
  backendStatus?: 'online' | 'offline' | 'unstable' | 'unknown';
  elapsedTime?: number;
}

export const EnhancedConnectionStatus = ({
  stage,
  isConnecting,
  error,
  onRetry,
  onDiagnose,
  backendStatus = 'unknown',
  elapsedTime = 0
}: EnhancedConnectionStatusProps) => {
  
  const getStageInfo = () => {
    switch (stage) {
      case 'warming':
        return {
          icon: <Zap className="h-4 w-4 text-yellow-500 animate-bounce" />,
          title: 'Acordando Servidor',
          message: '🔥 Servidor dormindo no Render.com - aguarde...',
          variant: 'outline' as const,
          progress: 25
        };
      case 'connecting':
        return {
          icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
          title: 'Conectando...',
          message: '⚡ Estabelecendo conexão WebSocket...',
          variant: 'secondary' as const,
          progress: 50
        };
      case 'webrtc':
        return {
          icon: <Wifi className="h-4 w-4 text-blue-600 animate-pulse" />,
          title: 'Configurando WebRTC',
          message: '🎯 Estabelecendo conexão peer-to-peer...',
          variant: 'secondary' as const,
          progress: 75
        };
      case 'connected':
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
          title: 'Connected',
          message: 'Successfully connected to session',
          variant: 'default' as const,
          progress: 100
        };
      case 'failed':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
          title: 'Connection Failed',
          message: error || 'Unable to connect to session',
          variant: 'destructive' as const,
          progress: 0
        };
      default:
        return {
          icon: <WifiOff className="h-4 w-4 text-gray-500" />,
          title: 'Disconnected',
          message: 'Ready to connect',
          variant: 'outline' as const,
          progress: 0
        };
    }
  };

  const getBackendStatusBadge = () => {
    const config = {
      online: { color: 'bg-green-500', text: 'Backend Online' },
      offline: { color: 'bg-red-500', text: 'Backend Offline' },
      unstable: { color: 'bg-yellow-500', text: 'Backend Unstable' },
      unknown: { color: 'bg-gray-500', text: 'Backend Unknown' }
    };
    
    const { color, text } = config[backendStatus] || config.unknown;
    
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-muted-foreground">{text}</span>
      </div>
    );
  };

  const stageInfo = getStageInfo();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {stageInfo.icon}
          Connection Status
          <Badge variant={stageInfo.variant} className="ml-auto">
            {stageInfo.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">{stageInfo.message}</p>
          <Progress value={stageInfo.progress} className="h-2" />
        </div>

        {elapsedTime > 0 && (isConnecting || stage === 'warming') && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Elapsed: {elapsedTime}s</span>
            {elapsedTime > 30 && (
              <span className="text-yellow-600">• Server may be cold-starting</span>
            )}
          </div>
        )}

        <div className="space-y-2">
          {getBackendStatusBadge()}
          
          {stage === 'warming' && (
            <div className="text-xs text-muted-foreground">
              💡 Servidores Render.com podem levar até 2 minutos para acordar
            </div>
          )}
          
          {(elapsedTime > 60 && isConnecting) && (
            <div className="text-xs text-yellow-600">
              🔥 Servidor estava dormindo - processo normal no Render.com
            </div>
          )}
        </div>

        {(stage === 'failed' || (isConnecting && elapsedTime > 45)) && (
          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onRetry}
                className="flex-1"
                disabled={isConnecting}
              >
                Retry
              </Button>
            )}
            {onDiagnose && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onDiagnose}
                className="flex-1"
              >
                Diagnose
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};