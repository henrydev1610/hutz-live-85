import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getEnvironmentInfo, validateURLConsistency, detectSlowNetwork } from '@/utils/connectionUtils';
import { diagnoseConnection, testBroadcastReception } from '@/utils/connectionDiagnostics';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
}

interface ConnectivityTestPanelProps {
  sessionId?: string;
  participantId?: string;
}

export const ConnectivityTestPanel: React.FC<ConnectivityTestPanelProps> = ({
  sessionId = 'test-session',
  participantId = 'test-participant'
}) => {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Environment Info', status: 'idle', message: 'Não executado' },
    { name: 'URL Consistency', status: 'idle', message: 'Não executado' },
    { name: 'Network Detection', status: 'idle', message: 'Não executado' },
    { name: 'WebSocket Connection', status: 'idle', message: 'Não executado' },
    { name: 'Broadcast Channel', status: 'idle', message: 'Não executado' },
    { name: 'Media Device Access', status: 'idle', message: 'Não executado' },
    { name: 'Backend Connectivity', status: 'idle', message: 'Não executado' }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const updateTest = useCallback((index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => 
      i === index ? { ...test, ...updates } : test
    ));
  }, []);

  const runEnvironmentTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Coletando informações do ambiente...' });
    
    try {
      const envInfo = getEnvironmentInfo();
      updateTest(index, {
        status: 'success',
        message: `Host: ${envInfo.host} | Protocolo: ${envInfo.protocol} | Mobile: ${envInfo.mobileInfo.isMobileUA}`,
        details: envInfo
      });
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro: ${error}`,
        details: error
      });
    }
  };

  const runURLConsistencyTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Verificando consistência de URLs...' });
    
    try {
      const isConsistent = validateURLConsistency();
      updateTest(index, {
        status: isConsistent ? 'success' : 'error',
        message: isConsistent ? 'URLs consistentes e mapeamento correto' : 'URLs inconsistentes ou mapeamento incorreto'
      });
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro: ${error}`
      });
    }
  };

  const runNetworkTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Detectando velocidade da rede...' });
    
    try {
      const isSlowNetwork = detectSlowNetwork();
      updateTest(index, {
        status: 'success',
        message: isSlowNetwork ? 'Rede lenta detectada' : 'Rede rápida detectada'
      });
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro: ${error}`
      });
    }
  };

  const runWebSocketTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando conexão WebSocket...' });
    
    try {
      if (!unifiedWebSocketService.isConnected()) {
        await unifiedWebSocketService.connect();
      }

      if (unifiedWebSocketService.isConnected()) {
        updateTest(index, {
          status: 'success',
          message: 'WebSocket conectado com sucesso'
        });
      } else {
        updateTest(index, {
          status: 'error',
          message: 'Falha na conexão WebSocket'
        });
      }
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro WebSocket: ${error}`
      });
    }
  };

  const runBroadcastTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando Broadcast Channel...' });
    
    try {
      const success = await testBroadcastReception(sessionId, participantId);
      updateTest(index, {
        status: success ? 'success' : 'error',
        message: success ? 'Broadcast Channel funcionando' : 'Broadcast Channel não está funcionando'
      });
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro: ${error}`
      });
    }
  };

  const runMediaTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando acesso a dispositivos de mídia...' });
    
    try {
      // Cleanup previous stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      mediaStreamRef.current = stream;
      
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      updateTest(index, {
        status: 'success',
        message: `Mídia acessada: ${videoTracks.length} vídeo, ${audioTracks.length} áudio`
      });
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro de mídia: ${error}`
      });
    }
  };

  const runBackendTest = async (index: number) => {
    updateTest(index, { status: 'running', message: 'Testando conectividade com backend...' });
    
    try {
      const envInfo = getEnvironmentInfo();
      const response = await fetch(`${envInfo.apiBaseUrl}/health`, {
        method: 'GET',
        mode: 'cors'
      });

      if (response.ok) {
        updateTest(index, {
          status: 'success',
          message: `Backend respondeu: ${response.status}`
        });
      } else {
        updateTest(index, {
          status: 'error',
          message: `Backend erro: ${response.status} ${response.statusText}`
        });
      }
    } catch (error) {
      updateTest(index, {
        status: 'error',
        message: `Erro de conectividade: ${error}`
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setProgress(0);

    const testFunctions = [
      runEnvironmentTest,
      runURLConsistencyTest,
      runNetworkTest,
      runWebSocketTest,
      runBroadcastTest,
      runMediaTest,
      runBackendTest
    ];

    for (let i = 0; i < testFunctions.length; i++) {
      await testFunctions[i](i);
      setProgress(((i + 1) / testFunctions.length) * 100);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      idle: 'secondary',
      running: 'outline',
      success: 'default',
      error: 'destructive'
    } as const;

    const labels = {
      idle: 'Pendente',
      running: 'Executando...',
      success: 'Sucesso',
      error: 'Erro'
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const cleanup = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  React.useEffect(() => {
    return cleanup;
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔧 Teste de Conectividade Completo</span>
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests} 
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? 'Executando...' : 'Executar Todos os Testes'}
            </Button>
            <Button 
              onClick={cleanup}
              variant="outline"
              size="sm"
            >
              Limpar
            </Button>
          </div>
        </CardTitle>
        {isRunning && (
          <Progress value={progress} className="mt-2" />
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {tests.map((test, index) => (
            <div key={test.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{test.name}</span>
                  {getStatusBadge(test.status)}
                </div>
                <p className="text-sm text-muted-foreground">{test.message}</p>
                {test.details && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-blue-600 hover:text-blue-800">
                      Ver detalhes
                    </summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p><strong>Session ID:</strong> {sessionId}</p>
          <p><strong>Participant ID:</strong> {participantId}</p>
          <p><strong>Status:</strong> {isRunning ? 'Executando testes...' : 'Pronto para testar'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectivityTestPanel;