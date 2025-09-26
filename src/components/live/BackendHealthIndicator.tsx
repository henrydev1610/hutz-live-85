/**
 * FASE 5: Componente para mostrar status do backend em tempo real
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, WifiOff, RefreshCw } from 'lucide-react';
import { useBackendHealth } from '@/hooks/live/useBackendHealth';

export const BackendHealthIndicator = () => {
  const { 
    backendStatus, 
    isBackendOnline, 
    averageResponseTime, 
    consecutiveFailures,
    isChecking,
    forceCheck,
    healthStatus
  } = useBackendHealth(true);

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'unstable': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (backendStatus) {
      case 'online': return <CheckCircle className="w-4 h-4" />;
      case 'offline': return <WifiOff className="w-4 h-4" />;
      case 'unstable': return <AlertCircle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'online': return `Online (${Math.round(averageResponseTime)}ms)`;
      case 'offline': return `Offline (${consecutiveFailures} falhas)`;
      case 'unstable': return `Instável (${consecutiveFailures} falhas)`;
      default: return 'Verificando...';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Card className="w-64 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Status do Servidor</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={forceCheck}
              disabled={isChecking}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          
          {backendStatus === 'offline' && (
            <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
              ⚠️ Servidor não está respondendo. Verifique sua conexão.
            </div>
          )}
          
          {backendStatus === 'unstable' && (
            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
              ⚠️ Conexão instável detectada.
            </div>
          )}
          
          {healthStatus && (
            <div className="mt-2 text-xs text-gray-500">
              Última verificação: {new Date(healthStatus.lastCheck).toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const CompactBackendHealthIndicator = () => {
  const { backendStatus, isChecking } = useBackendHealth(true);

  const getVariant = () => {
    switch (backendStatus) {
      case 'online': return 'default';
      case 'offline': return 'destructive';
      case 'unstable': return 'secondary';
      default: return 'outline';
    }
  };

  const getText = () => {
    switch (backendStatus) {
      case 'online': return '🟢 Online';
      case 'offline': return '🔴 Offline';
      case 'unstable': return '🟡 Instável';
      default: return '⚪ Verificando';
    }
  };

  return (
    <Badge variant={getVariant()} className="animate-pulse-subtle">
      {isChecking ? '🔄' : getText()}
    </Badge>
  );
};