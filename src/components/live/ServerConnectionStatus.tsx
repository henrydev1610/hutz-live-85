import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';

interface ServerConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'warming' | 'connected' | 'failed';
  progress?: number;
  onRetry?: () => void;
  onDiagnose?: () => void;
  timeoutStage?: 'initial' | 'extended' | 'final';
  errorDetails?: string;
}

export const ServerConnectionStatus = ({
  status,
  progress = 0,
  onRetry,
  onDiagnose,
  timeoutStage = 'initial',
  errorDetails
}: ServerConnectionStatusProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (status === 'connecting' || status === 'warming') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [status]);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          variant: 'default' as const,
          title: 'Connected',
          message: 'WebRTC connection established successfully'
        };
      case 'connecting':
        return {
          icon: <Wifi className="h-5 w-5 text-blue-500 animate-pulse" />,
          variant: 'secondary' as const,
          title: 'Connecting...',
          message: getTimeoutMessage()
        };
      case 'warming':
        return {
          icon: <Zap className="h-5 w-5 text-yellow-500 animate-bounce" />,
          variant: 'outline' as const,
          title: 'Server Waking Up',
          message: 'Backend server is starting up, please wait...'
        };
      case 'failed':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          variant: 'destructive' as const,
          title: 'Connection Failed',
          message: errorDetails || 'Unable to connect to server'
        };
      default:
        return {
          icon: <WifiOff className="h-5 w-5 text-gray-500" />,
          variant: 'outline' as const,
          title: 'Disconnected',
          message: 'Not connected to server'
        };
    }
  };

  const getTimeoutMessage = () => {
    switch (timeoutStage) {
      case 'initial':
        return `Establishing connection... (${elapsedTime}s/30s)`;
      case 'extended':
        return `Still connecting... Server may be waking up (${elapsedTime}s/60s)`;
      case 'final':
        return `Final attempt... This may take up to 90 seconds (${elapsedTime}s/90s)`;
      default:
        return `Connecting... (${elapsedTime}s)`;
    }
  };

  const getProgressValue = () => {
    if (status === 'warming') return Math.min(progress, 100);
    if (status === 'connecting') {
      const maxTime = timeoutStage === 'final' ? 90 : timeoutStage === 'extended' ? 60 : 30;
      return Math.min((elapsedTime / maxTime) * 100, 100);
    }
    return status === 'connected' ? 100 : 0;
  };

  const config = getStatusConfig();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {config.icon}
          Server Connection
          <Badge variant={config.variant} className="ml-auto">
            {config.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{config.message}</p>
        
        {(status === 'connecting' || status === 'warming') && (
          <Progress value={getProgressValue()} className="h-2" />
        )}

        {status === 'warming' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Render.com servers may take up to 60 seconds to wake up
          </div>
        )}

        {(status === 'failed' || (status === 'connecting' && elapsedTime > 45)) && (
          <div className="flex gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="flex-1">
                Retry Connection
              </Button>
            )}
            {onDiagnose && (
              <Button size="sm" variant="ghost" onClick={onDiagnose} className="flex-1">
                Diagnose
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};