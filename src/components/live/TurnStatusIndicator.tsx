// FASE 4: Indicador visual do status TURN em tempo real
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { turnConnectivityService } from '@/services/TurnConnectivityService';
import { toast } from 'sonner';

interface TurnStatusIndicatorProps {
  className?: string;
  compact?: boolean;
}

export const TurnStatusIndicator: React.FC<TurnStatusIndicatorProps> = ({
  className = '',
  compact = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastDiagnostic, setLastDiagnostic] = useState(turnConnectivityService.getLastDiagnostic());
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'healthy' | 'degraded' | 'failed'>('unknown');

  useEffect(() => {
    // FASE 1: Diagnóstico automático na inicialização
    const runInitialDiagnostic = async () => {
      console.log('🧊 [TURN-UI] Running initial TURN diagnostic...');
      try {
        const result = await turnConnectivityService.runDiagnostic(true);
        setLastDiagnostic(result);
        setHealthStatus(result.overallHealth);
      } catch (error) {
        console.error('🧊 [TURN-UI] Initial diagnostic failed:', error);
        setHealthStatus('failed');
      }
    };

    runInitialDiagnostic();

    // FASE 4: Atualização automática do status
    const interval = setInterval(() => {
      const diagnostic = turnConnectivityService.getLastDiagnostic();
      if (diagnostic) {
        setLastDiagnostic(diagnostic);
        setHealthStatus(diagnostic.overallHealth);
      }
    }, 5000); // Atualizar UI a cada 5s

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await turnConnectivityService.forceRefresh();
      setLastDiagnostic(result);
      setHealthStatus(result.overallHealth);
      
      if (result.overallHealth === 'failed') {
        toast.error('❌ Todos os servidores TURN falharam - usando fallback STUN');
      } else {
        toast.success(`✅ ${result.workingServers.length} servidores TURN funcionando`);
      }
    } catch (error) {
      console.error('🧊 [TURN-UI] Refresh failed:', error);
      toast.error('Erro ao testar servidores TURN');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = () => {
    switch (healthStatus) {
      case 'healthy': return <CheckCircle className="text-green-500" size={16} />;
      case 'degraded': return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'failed': return <WifiOff className="text-red-500" size={16} />;
      default: return <Clock className="text-gray-500" size={16} />;
    }
  };

  const getStatusColor = () => {
    switch (healthStatus) {
      case 'healthy': return 'bg-green-50 border-green-200 text-green-700';
      case 'degraded': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'failed': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusText = () => {
    switch (healthStatus) {
      case 'healthy': return 'TURN Servers Healthy';
      case 'degraded': return 'TURN Servers Degraded';
      case 'failed': return 'TURN Servers Failed';
      default: return 'Testing TURN Servers...';
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <Badge variant={healthStatus === 'healthy' ? 'default' : 'destructive'} className="text-xs">
          {lastDiagnostic?.workingServers.length || 0}/{lastDiagnostic?.allServersStatus.length || 0} TURN
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  }

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getStatusIcon()}
          <span>TURN Server Status</span>
          <Badge variant="outline" className="text-xs">
            🧊 ICE
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className={`p-3 rounded-lg border ${getStatusColor()}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{getStatusText()}</span>
            <Badge variant={healthStatus === 'healthy' ? 'default' : 'destructive'}>
              {lastDiagnostic?.workingServers.length || 0}/{lastDiagnostic?.allServersStatus.length || 0}
            </Badge>
          </div>
        </div>

        {/* Server Details */}
        {lastDiagnostic && lastDiagnostic.allServersStatus.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">Server Details:</div>
            {lastDiagnostic.allServersStatus.map((server, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  {server.status === 'connected' ? (
                    <Wifi className="text-green-500" size={12} />
                  ) : (
                    <WifiOff className="text-red-500" size={12} />
                  )}
                  {server.url.replace('turn:', '').split(':')[0]}
                </span>
                <div className="flex items-center gap-2">
                  {server.latency && (
                    <span className="text-gray-500">{server.latency}ms</span>
                  )}
                  <Badge 
                    variant={server.status === 'connected' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {server.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Best Server Info */}
        {lastDiagnostic?.bestServer && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Best Server:</span>
              <span className="font-medium text-green-600">
                {lastDiagnostic.bestServer.latency}ms
              </span>
            </div>
          </div>
        )}

        {/* Fallback Warning */}
        {lastDiagnostic?.recommendFallback && (
          <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 p-2 rounded">
            ⚠️ Using STUN-only fallback (NAT traversal may fail)
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-1 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Test Servers
          </Button>
        </div>

        {/* Health Summary */}
        <div className={`text-center text-xs p-2 rounded ${getStatusColor()}`}>
          {healthStatus === 'healthy' 
            ? '✅ TURN servers operational - WebRTC should work behind NAT'
            : healthStatus === 'degraded'
            ? '⚠️ Some TURN servers failing - connection may be unstable'
            : '❌ All TURN servers failed - using STUN fallback only'
          }
        </div>
      </CardContent>
    </Card>
  );
};