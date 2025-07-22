
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';

interface SignalingStatus {
  nodeServer: {
    connected: boolean;
    url: string;
    lastPing: number | null;
    error?: string;
  };
  supabaseEdge: {
    connected: boolean;
    url: string;
    lastPing: number | null;
    error?: string;
  };
  activeSystem: 'node' | 'supabase' | 'both' | 'none';
  conflictDetected: boolean;
}

export const SignalingDiagnostics: React.FC = () => {
  const [status, setStatus] = useState<SignalingStatus>({
    nodeServer: {
      connected: false,
      url: import.meta.env.VITE_API_URL || 'http://localhost:3001',
      lastPing: null
    },
    supabaseEdge: {
      connected: false,
      url: 'https://fuhvpzprzqdfcojueswo.supabase.co/functions/v1/signaling',
      lastPing: null
    },
    activeSystem: 'none',
    conflictDetected: false
  });

  const [isTestingConnections, setIsTestingConnections] = useState(false);

  const testNodeServerConnection = async (): Promise<boolean> => {
    try {
      const nodeUrl = status.nodeServer.url;
      console.log(`🔍 DIAGNOSTIC: Testing Node.js server at ${nodeUrl}`);
      
      // Test HTTP endpoint first
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const httpResponse = await fetch(`${nodeUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (httpResponse.ok) {
        console.log('✅ DIAGNOSTIC: Node.js HTTP server is responsive');
        
        // Test WebSocket connection
        return new Promise((resolve) => {
          const wsUrl = nodeUrl.replace('http', 'ws');
          const testSocket = new WebSocket(wsUrl);
          
          const timeout = setTimeout(() => {
            testSocket.close();
            resolve(false);
          }, 3000);
          
          testSocket.onopen = () => {
            console.log('✅ DIAGNOSTIC: Node.js WebSocket connection successful');
            clearTimeout(timeout);
            testSocket.close();
            resolve(true);
          };
          
          testSocket.onerror = () => {
            console.log('❌ DIAGNOSTIC: Node.js WebSocket connection failed');
            clearTimeout(timeout);
            resolve(false);
          };
        });
      }
      
      return false;
    } catch (error) {
      console.error('❌ DIAGNOSTIC: Node.js server test failed:', error);
      return false;
    }
  };

  const testSupabaseEdgeConnection = async (): Promise<boolean> => {
    try {
      const supabaseUrl = status.supabaseEdge.url;
      console.log(`🔍 DIAGNOSTIC: Testing Supabase Edge Function at ${supabaseUrl}`);
      
      // Test WebSocket upgrade request
      return new Promise((resolve) => {
        const wsUrl = supabaseUrl.replace('https', 'wss') + '?room=test&id=diagnostic';
        const testSocket = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          testSocket.close();
          resolve(false);
        }, 3000);
        
        testSocket.onopen = () => {
          console.log('✅ DIAGNOSTIC: Supabase Edge Function WebSocket connection successful');
          clearTimeout(timeout);
          testSocket.close();
          resolve(true);
        };
        
        testSocket.onerror = () => {
          console.log('❌ DIAGNOSTIC: Supabase Edge Function WebSocket connection failed');
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ DIAGNOSTIC: Supabase Edge Function test failed:', error);
      return false;
    }
  };

  const getCurrentActiveConnection = (): 'node' | 'supabase' | 'none' => {
    const currentUrl = unifiedWebSocketService.getConnectionMetrics();
    const nodeUrl = status.nodeServer.url;
    const supabaseUrl = status.supabaseEdge.url;
    
    if (unifiedWebSocketService.isConnected()) {
      // Check which URL is being used by examining the service
      const wsUrl = (unifiedWebSocketService as any).socket?.io?.uri;
      if (wsUrl) {
        if (wsUrl.includes('localhost') || wsUrl.includes('3001') || wsUrl.includes('render.com')) {
          return 'node';
        } else if (wsUrl.includes('supabase.co')) {
          return 'supabase';
        }
      }
    }
    
    return 'none';
  };

  const runDiagnostics = async () => {
    setIsTestingConnections(true);
    console.log('🔍 DIAGNOSTIC: Starting signaling diagnostics...');
    
    try {
      // Test both systems simultaneously
      const [nodeConnected, supabaseConnected] = await Promise.all([
        testNodeServerConnection(),
        testSupabaseEdgeConnection()
      ]);
      
      const activeSystem = getCurrentActiveConnection();
      const conflictDetected = nodeConnected && supabaseConnected;
      
      setStatus(prev => ({
        ...prev,
        nodeServer: {
          ...prev.nodeServer,
          connected: nodeConnected,
          lastPing: Date.now(),
          error: nodeConnected ? undefined : 'Connection failed'
        },
        supabaseEdge: {
          ...prev.supabaseEdge,
          connected: supabaseConnected,
          lastPing: Date.now(),
          error: supabaseConnected ? undefined : 'Connection failed'
        },
        activeSystem: conflictDetected ? 'both' : activeSystem,
        conflictDetected
      }));
      
      // Log detailed results
      console.log('📊 DIAGNOSTIC RESULTS:', {
        nodeConnected,
        supabaseConnected,
        activeSystem,
        conflictDetected,
        currentConnection: unifiedWebSocketService.isConnected()
      });
      
      if (conflictDetected) {
        console.warn('⚠️ DIAGNOSTIC: CONFLICT DETECTED - Both signaling systems are available!');
        console.warn('This explains why mobile-to-desktop streaming is inconsistent.');
      }
      
    } catch (error) {
      console.error('❌ DIAGNOSTIC: Failed to run diagnostics:', error);
    } finally {
      setIsTestingConnections(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
    
    // Run diagnostics every 30 seconds
    const interval = setInterval(runDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (connected: boolean, isActive?: boolean) => {
    if (isActive) {
      return <Badge className="bg-blue-500 text-white">ATIVO</Badge>;
    }
    return connected ? (
      <Badge className="bg-green-500 text-white">ONLINE</Badge>
    ) : (
      <Badge className="bg-red-500 text-white">OFFLINE</Badge>
    );
  };

  const getStatusIcon = (connected: boolean) => {
    return connected ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <WifiOff className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Diagnóstico de Signaling
          {status.conflictDetected && (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.conflictDetected && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <strong>Conflito Detectado!</strong>
            </div>
            <p className="text-yellow-700 mt-1">
              Ambos os sistemas de signaling (Node.js e Supabase) estão ativos. 
              Isso causa inconsistências na transmissão mobile-to-desktop.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Node.js Server Status */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Node.js Server</h3>
              {getStatusIcon(status.nodeServer.connected)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status:</span>
                {getStatusBadge(
                  status.nodeServer.connected, 
                  status.activeSystem === 'node'
                )}
              </div>
              <div className="text-xs text-gray-500">
                URL: {status.nodeServer.url}
              </div>
              {status.nodeServer.lastPing && (
                <div className="text-xs text-gray-500">
                  Último teste: {new Date(status.nodeServer.lastPing).toLocaleTimeString()}
                </div>
              )}
              {status.nodeServer.error && (
                <div className="text-xs text-red-500">
                  Erro: {status.nodeServer.error}
                </div>
              )}
            </div>
          </div>

          {/* Supabase Edge Function Status */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Supabase Edge Function</h3>
              {getStatusIcon(status.supabaseEdge.connected)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status:</span>
                {getStatusBadge(
                  status.supabaseEdge.connected, 
                  status.activeSystem === 'supabase'
                )}
              </div>
              <div className="text-xs text-gray-500">
                URL: {status.supabaseEdge.url}
              </div>
              {status.supabaseEdge.lastPing && (
                <div className="text-xs text-gray-500">
                  Último teste: {new Date(status.supabaseEdge.lastPing).toLocaleTimeString()}
                </div>
              )}
              {status.supabaseEdge.error && (
                <div className="text-xs text-red-500">
                  Erro: {status.supabaseEdge.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Connection Info */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Conexão Atual</h3>
          <div className="space-y-1 text-sm">
            <div>Sistema Ativo: <strong>{status.activeSystem.toUpperCase()}</strong></div>
            <div>
              Status WebSocket: {unifiedWebSocketService.isConnected() ? (
                <Badge className="bg-green-500 text-white">CONECTADO</Badge>
              ) : (
                <Badge className="bg-red-500 text-white">DESCONECTADO</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isTestingConnections}
            size="sm"
          >
            {isTestingConnections ? 'Testando...' : 'Testar Novamente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
