import React from 'react';
import { Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, Smartphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConnectionStatus {
  websocket: 'disconnected' | 'connecting' | 'connected' | 'failed';
  webrtc: 'disconnected' | 'connecting' | 'connected' | 'failed';
  overall: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

interface MobileStabilityData {
  isConnected: boolean;
  isStable: boolean;
  connectionAttempts: number;
  lastSuccessTime: number;
  error: string | null;
  isMobile: boolean;
}

interface ConnectionStabilityIndicatorProps {
  connectionStatus: ConnectionStatus;
  mobileStability?: MobileStabilityData;
  participantCount: number;
  onForceReconnect?: () => void;
  onBreakLoop?: () => void; // NOVO: Função para quebrar loops
  onDiagnostics?: () => void;
  className?: string;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'connected': return 'text-green-500';
    case 'connecting': return 'text-yellow-500';
    case 'failed': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

const getStatusIcon = (status: string, isMobile = false) => {
  const iconProps = { size: 16, className: getStatusColor(status) };
  
  switch (status) {
    case 'connected': 
      return isMobile ? <Smartphone {...iconProps} /> : <CheckCircle {...iconProps} />;
    case 'connecting': 
      return <Clock {...iconProps} />;
    case 'failed': 
      return <WifiOff {...iconProps} />;
    default: 
      return <AlertTriangle {...iconProps} />;
  }
};

const getStatusText = (status: string): string => {
  switch (status) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting';
    case 'failed': return 'Failed';
    default: return 'Disconnected';
  }
};

const formatTime = (timestamp: number): string => {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export const ConnectionStabilityIndicator: React.FC<ConnectionStabilityIndicatorProps> = ({
  connectionStatus,
  mobileStability,
  participantCount,
  onForceReconnect,
  onBreakLoop,
  onDiagnostics,
  className = ''
}) => {
  const overallColor = getStatusColor(connectionStatus.overall);
  const isHealthy = connectionStatus.overall === 'connected';
  const isStuckConnecting = connectionStatus.webrtc === 'connecting' && connectionStatus.overall === 'connecting';
  const hasIssues = connectionStatus.overall === 'failed' || 
                   isStuckConnecting ||
                   (mobileStability && (!mobileStability.isStable || mobileStability.error));

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getStatusIcon(connectionStatus.overall, mobileStability?.isMobile)}
          <span>Connection Status</span>
          {mobileStability?.isMobile && (
            <Badge variant="outline" className="text-xs">
              📱 Mobile
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall</span>
          <Badge variant={isHealthy ? "default" : "destructive"}>
            {getStatusText(connectionStatus.overall)}
          </Badge>
        </div>

        {/* Detailed Status */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wifi size={12} />
              WebSocket
            </span>
            <span className={getStatusColor(connectionStatus.websocket)}>
              {getStatusText(connectionStatus.websocket)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              📹 WebRTC
            </span>
            <span className={getStatusColor(connectionStatus.webrtc)}>
              {getStatusText(connectionStatus.webrtc)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span>Participants</span>
            <span className="font-medium">{participantCount}</span>
          </div>
        </div>

        {/* Mobile Stability Info */}
        {mobileStability && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>📱 Camera Stable</span>
              <Badge variant={mobileStability.isStable ? "default" : "destructive"}>
                {mobileStability.isStable ? "Yes" : "No"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span>Attempts</span>
              <span className="font-medium">{mobileStability.connectionAttempts}</span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span>Last Success</span>
              <span className="font-medium">
                {formatTime(mobileStability.lastSuccessTime)}
              </span>
            </div>
            
            {mobileStability.error && (
              <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                {mobileStability.error}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {hasIssues && (
          <div className="flex gap-2 pt-2">
            {isStuckConnecting && onBreakLoop && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBreakLoop}
                className="flex-1 text-xs bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
              >
                ⚡ Break Loop
              </Button>
            )}
            
            {onForceReconnect && (
              <Button
                variant="outline"
                size="sm"
                onClick={onForceReconnect}
                className="flex-1 text-xs"
              >
                🔄 Reconnect
              </Button>
            )}
            
            {onDiagnostics && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDiagnostics}
                className="flex-1 text-xs"
              >
                🔍 Diagnose
              </Button>
            )}
          </div>
        )}

        {/* Health Indicator */}
        <div className={`text-center text-xs p-2 rounded ${
          isHealthy 
            ? 'bg-green-50 text-green-700' 
            : isStuckConnecting
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {isHealthy 
            ? '✅ All systems operational' 
            : isStuckConnecting
            ? '🔄 WebRTC connecting loop detected'
            : '⚠️ Connection issues detected'
          }
        </div>
      </CardContent>
    </Card>
  );
};