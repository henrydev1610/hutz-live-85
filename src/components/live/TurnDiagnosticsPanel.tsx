// Painel integrado de diagnósticos TURN com monitoramento de candidatos
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff, Activity } from 'lucide-react';
import { TurnStatusIndicator } from './TurnStatusIndicator';
import { useWebRTCTurnDiagnostics } from '@/hooks/live/useWebRTCTurnDiagnostics';
import { candidateMonitor } from '@/utils/webrtc/CandidateMonitor';
import { toast } from 'sonner';

interface TurnDiagnosticsPanelProps {
  sessionId?: string;
  className?: string;
}

export const TurnDiagnosticsPanel: React.FC<TurnDiagnosticsPanelProps> = ({
  sessionId,
  className = ''
}) => {
  const {
    isRunning,
    isComplete,
    hasValidTurn,
    workingServerCount,
    error,
    lastDiagnostic,
    runDiagnostic,
    forceRefresh,
    getRecommendations
  } = useWebRTCTurnDiagnostics();

  const [candidateReport, setCandidateReport] = useState<any>(null);
  const [isTestingCandidates, setIsTestingCandidates] = useState(false);

  const handleGenerateCandidateReport = async () => {
    setIsTestingCandidates(true);
    try {
      // Gerar relatório de candidatos
      const report = candidateMonitor.getGlobalReport();
      setCandidateReport(report);
      
      candidateMonitor.logDetailedReport();
      
      if (report.criticalWarnings.length > 0) {
        toast.warning(`⚠️ ${report.criticalWarnings.length} participantes sem candidatos relay`);
      } else {
        toast.success('✅ Relatório de candidatos gerado com sucesso');
      }
    } catch (error) {
      console.error('Error generating candidate report:', error);
      toast.error('❌ Erro ao gerar relatório de candidatos');
    } finally {
      setIsTestingCandidates(false);
    }
  };

  const handleRunFullDiagnostic = async () => {
    try {
      await forceRefresh();
      await handleGenerateCandidateReport();
      toast.success('🧊 Diagnóstico completo executado');
    } catch (error) {
      toast.error('❌ Erro no diagnóstico completo');
    }
  };

  const getHealthStatusIcon = () => {
    if (isRunning) return <RefreshCw className="animate-spin text-blue-500" size={20} />;
    if (error) return <AlertCircle className="text-red-500" size={20} />;
    if (hasValidTurn) return <CheckCircle className="text-green-500" size={20} />;
    return <WifiOff className="text-yellow-500" size={20} />;
  };

  const recommendations = getRecommendations();

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {getHealthStatusIcon()}
          <span>Diagnósticos TURN</span>
          <Badge variant="outline" className="text-xs">
            🧊 ICE Monitor
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="candidates">Candidatos</TabsTrigger>
            <TabsTrigger value="actions">Ações</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-3">
            {/* TURN Status Indicator Compacto */}
            <TurnStatusIndicator compact className="mb-4" />
            
            {/* Status Geral */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Servers TURN funcionando:</span>
                <Badge variant={hasValidTurn ? 'default' : 'destructive'}>
                  {workingServerCount}/5
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span>Status diagnóstico:</span>
                <Badge variant={isComplete ? 'default' : 'secondary'}>
                  {isRunning ? 'Executando...' : isComplete ? 'Completo' : 'Pendente'}
                </Badge>
              </div>

              {lastDiagnostic?.bestServer && (
                <div className="flex items-center justify-between text-sm">
                  <span>Melhor latência:</span>
                  <span className="text-green-600 font-medium">
                    {lastDiagnostic.bestServer.latency}ms
                  </span>
                </div>
              )}
            </div>

            {/* Recomendações */}
            {recommendations.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <div className="text-sm font-medium text-yellow-800 mb-1">
                  ⚠️ Recomendações:
                </div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm text-red-700">
                ❌ Erro: {error}
              </div>
            )}
          </TabsContent>

          <TabsContent value="candidates" className="space-y-3">
            {candidateReport ? (
              <div className="space-y-3">
                {/* Estatísticas Globais */}
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-800 mb-2">
                    📊 Estatísticas de Candidatos:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Host: {candidateReport.globalStats.host}</div>
                    <div>STUN: {candidateReport.globalStats.srflx}</div>
                    <div>TURN: {candidateReport.globalStats.relay}</div>
                    <div>Total: {candidateReport.globalStats.total}</div>
                  </div>
                </div>

                {/* Participantes com Relay */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Participantes:</span>
                    <span>{candidateReport.participantCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Com candidatos relay:</span>
                    <Badge variant={candidateReport.participantsWithRelay > 0 ? 'default' : 'destructive'}>
                      {candidateReport.participantsWithRelay}/{candidateReport.participantCount}
                    </Badge>
                  </div>
                </div>

                {/* Alertas Críticos */}
                {candidateReport.criticalWarnings.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                    <div className="text-sm font-medium text-red-800 mb-1">
                      ❌ Sem candidatos relay:
                    </div>
                    <div className="text-xs text-red-700">
                      {candidateReport.criticalWarnings.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                <Activity className="mx-auto mb-2" size={32} />
                <p>Execute o teste de candidatos para ver o relatório</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-3">
            <div className="space-y-2">
              <Button
                onClick={forceRefresh}
                disabled={isRunning}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
                Testar Servidores TURN
              </Button>
              
              <Button
                onClick={handleGenerateCandidateReport}
                disabled={isTestingCandidates}
                className="w-full"
                variant="outline"
              >
                <Activity className={`h-4 w-4 mr-2 ${isTestingCandidates ? 'animate-pulse' : ''}`} />
                Relatório de Candidatos
              </Button>
              
              <Button
                onClick={handleRunFullDiagnostic}
                disabled={isRunning || isTestingCandidates}
                className="w-full"
                variant="default"
              >
                <CheckCircle className={`h-4 w-4 mr-2 ${(isRunning || isTestingCandidates) ? 'animate-pulse' : ''}`} />
                Diagnóstico Completo
              </Button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
              <div className="font-medium mb-1">💡 Dicas:</div>
              <ul className="space-y-1">
                <li>• Execute diagnósticos antes de iniciar chamadas</li>
                <li>• Candidatos relay são essenciais para NAT traversal</li>
                <li>• Use o monitoramento contínuo durante transmissões</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};