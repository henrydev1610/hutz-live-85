// FASE 4 - MONITORING & RECOVERY
// Dashboard em tempo real para monitoramento de segurança e streams

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { secureContextEnforcer, type SecurityValidationResult } from '@/utils/security/SecureContextEnforcer';
import { streamRecoverySystem, type StreamHealthMetrics } from '@/utils/monitoring/StreamRecoverySystem';
import { turnConnectivityService } from '@/services/TurnConnectivityService';
import { toast } from 'sonner';

interface SecurityDashboardProps {
  className?: string;
}

export const SecurityDashboard = ({ className }: SecurityDashboardProps) => {
  const [securityStatus, setSecurityStatus] = useState<SecurityValidationResult | null>(null);
  const [streamMetrics, setStreamMetrics] = useState<StreamHealthMetrics[]>([]);
  const [turnStatus, setTurnStatus] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Atualizar dados em tempo real
  useEffect(() => {
    const updateDashboard = () => {
      // Security status
      const security = secureContextEnforcer.getValidationResult();
      setSecurityStatus(security);

      // Stream metrics
      const streams = streamRecoverySystem.getAllStreamMetrics();
      setStreamMetrics(streams);

      // TURN status
      const turn = turnConnectivityService.getLastDiagnostic();
      setTurnStatus(turn);
    };

    // Update immediately
    updateDashboard();

    // Update every 2 seconds
    const interval = setInterval(updateDashboard, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshSecurity = async () => {
    setIsRefreshing(true);
    try {
      secureContextEnforcer.clearCache();
      secureContextEnforcer.validateSecureContext();
      await turnConnectivityService.forceRefresh();
      toast.success('🔒 Status de segurança atualizado');
    } catch (error) {
      toast.error('❌ Falha ao atualizar status de segurança');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSecurityStatusColor = (status: SecurityValidationResult | null) => {
    if (!status) return 'destructive';
    if (status.isSecure) return 'default';
    if (status.canAccessMedia) return 'secondary';
    return 'destructive';
  };

  const getStreamHealthColor = (metrics: StreamHealthMetrics) => {
    if (!metrics.isActive) return 'destructive';
    if (!metrics.isVideoProducingData) return 'secondary';
    return 'default';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Security & Recovery Dashboard</h3>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefreshSecurity}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Security Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Context Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityStatus ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Security</span>
                <Badge variant={getSecurityStatusColor(securityStatus)}>
                  {securityStatus.isSecure ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> SECURE</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3 mr-1" /> ISSUES</>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {securityStatus.isHTTPS ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>HTTPS: {securityStatus.isHTTPS ? 'OK' : 'REQUIRED'}</span>
                </div>

                <div className="flex items-center gap-1">
                  {securityStatus.hasSecureContext ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>Secure Context: {securityStatus.hasSecureContext ? 'OK' : 'BLOCKED'}</span>
                </div>

                <div className="flex items-center gap-1">
                  {securityStatus.canAccessMedia ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>Media Access: {securityStatus.canAccessMedia ? 'ALLOWED' : 'BLOCKED'}</span>
                </div>
              </div>

              {securityStatus.issues.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Issues:</strong> {securityStatus.issues.join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Security status not available</div>
          )}
        </CardContent>
      </Card>

      {/* TURN Server Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            TURN Server Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {turnStatus ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">Overall Health</span>
                <Badge variant={turnStatus.overallHealth === 'healthy' ? 'default' : 'destructive'}>
                  {turnStatus.overallHealth.toUpperCase()}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground">
                Working Servers: {turnStatus.workingServers.length} / {turnStatus.allServersStatus.length}
              </div>

              <Progress 
                value={(turnStatus.workingServers.length / Math.max(turnStatus.allServersStatus.length, 1)) * 100} 
                className="h-2"
              />

              {turnStatus.bestServer && (
                <div className="text-xs">
                  <strong>Best Server:</strong> {turnStatus.bestServer.url} 
                  <span className="text-muted-foreground ml-1">
                    ({turnStatus.bestServer.latency}ms)
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">TURN status not available</div>
          )}
        </CardContent>
      </Card>

      {/* Stream Recovery Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active Streams ({streamMetrics.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {streamMetrics.length > 0 ? (
            streamMetrics.map((stream) => (
              <div key={stream.streamId} className="flex items-center justify-between p-2 rounded border">
                <div className="flex-1">
                  <div className="text-xs font-medium">{stream.streamId}</div>
                  <div className="text-xs text-muted-foreground">
                    Video: {stream.hasVideoTracks ? 'Yes' : 'No'} | 
                    State: {stream.videoTrackState} | 
                    Recovery: {stream.recoveryAttempts}/3
                  </div>
                </div>
                <Badge variant={getStreamHealthColor(stream)} className="text-xs">
                  {stream.isVideoProducingData ? 'HEALTHY' : stream.isActive ? 'DEGRADED' : 'FAILED'}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No active streams</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};