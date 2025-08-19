// Hook para integrar diagnósticos TURN com inicialização WebRTC
import { useCallback, useEffect, useState } from 'react';
import { turnConnectivityService } from '@/services/TurnConnectivityService';
import { setDynamicIceServers } from '@/utils/webrtc/WebRTCConfig';
import { toast } from 'sonner';

interface DiagnosticState {
  isRunning: boolean;
  isComplete: boolean;
  hasValidTurn: boolean;
  workingServerCount: number;
  error?: string;
  lastDiagnostic?: any;
}

export const useWebRTCTurnDiagnostics = () => {
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>({
    isRunning: false,
    isComplete: false,
    hasValidTurn: false,
    workingServerCount: 0
  });

  // Executar diagnóstico automático
  const runDiagnostic = useCallback(async (force = false) => {
    // Se já executou recentemente e não é forçado, usar cache
    const lastDiagnostic = turnConnectivityService.getLastDiagnostic();
    if (!force && lastDiagnostic && (Date.now() - Date.now()) < 30000) {
      console.log('🧊 [TURN-DIAG] Using cached diagnostic result');
      setDiagnosticState({
        isRunning: false,
        isComplete: true,
        hasValidTurn: lastDiagnostic.workingServers.length > 0,
        workingServerCount: lastDiagnostic.workingServers.length,
        lastDiagnostic
      });
      return lastDiagnostic;
    }

    setDiagnosticState(prev => ({ ...prev, isRunning: true, error: undefined }));
    
    try {
      console.log('🧊 [TURN-DIAG] Running TURN connectivity diagnostic...');
      const result = await turnConnectivityService.runDiagnostic(force);
      
      console.log('🧊 [TURN-DIAG] Diagnostic complete:', {
        workingServers: result.workingServers.length,
        totalServers: result.allServersStatus.length,
        overallHealth: result.overallHealth,
        bestServerLatency: result.bestServer?.latency
      });

      // Aplicar configuração otimizada baseada nos resultados
      await applyOptimalConfiguration(result);

      setDiagnosticState({
        isRunning: false,
        isComplete: true,
        hasValidTurn: result.workingServers.length > 0,
        workingServerCount: result.workingServers.length,
        lastDiagnostic: result
      });

      // Notificar resultado crítico
      if (result.workingServers.length === 0) {
        console.warn('❌ [TURN-DIAG] NO WORKING TURN SERVERS - Using STUN fallback only');
        toast.warning('⚠️ TURN servers indisponíveis - usando fallback STUN');
      } else {
        console.log(`✅ [TURN-DIAG] ${result.workingServers.length} TURN servers available`);
      }

      return result;
    } catch (error) {
      console.error('❌ [TURN-DIAG] Diagnostic failed:', error);
      setDiagnosticState({
        isRunning: false,
        isComplete: true,
        hasValidTurn: false,
        workingServerCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast.error('❌ Erro no diagnóstico TURN - usando configuração fallback');
      throw error;
    }
  }, []);

  // Aplicar configuração otimizada baseada no diagnóstico
  const applyOptimalConfiguration = useCallback(async (diagnostic: any) => {
    console.log('🧊 [TURN-DIAG] Applying optimal ICE configuration...');
    
    // Usar apenas servidores que estão funcionando
    const workingIceServers = diagnostic.workingServers.map((server: any) => ({
      urls: server.url,
      username: server.username,
      credential: server.credential
    }));

    // Adicionar STUN servers como fallback
    const stunServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    const optimizedServers = [...workingIceServers, ...stunServers];
    
    console.log('🧊 [TURN-DIAG] Setting optimized ICE servers:', {
      turnServers: workingIceServers.length,
      stunServers: stunServers.length,
      total: optimizedServers.length
    });

    // Aplicar configuração dinâmica
    setDynamicIceServers(optimizedServers, {
      relayOnly: diagnostic.recommendForceRelay
    });

    console.log('✅ [TURN-DIAG] Optimal ICE configuration applied');
  }, []);

  // Executar diagnóstico automático na inicialização
  useEffect(() => {
    let mounted = true;
    
    const runInitialDiagnostic = async () => {
      try {
        await runDiagnostic();
      } catch (error) {
        if (mounted) {
          console.error('❌ [TURN-DIAG] Initial diagnostic failed:', error);
        }
      }
    };

    runInitialDiagnostic();
    
    return () => {
      mounted = false;
    };
  }, [runDiagnostic]);

  // Função para forçar refresh do diagnóstico
  const forceRefresh = useCallback(async () => {
    return await runDiagnostic(true);
  }, [runDiagnostic]);

  // Função para verificar se está pronto para WebRTC
  const isReadyForWebRTC = useCallback(() => {
    return diagnosticState.isComplete && !diagnosticState.isRunning;
  }, [diagnosticState]);

  // Função para obter recomendações baseadas no diagnóstico
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (!diagnosticState.hasValidTurn) {
      recommendations.push('Conexões podem falhar em redes com NAT restritivo');
      recommendations.push('Considere usar VPN ou rede diferente se houver problemas');
    }

    if (diagnosticState.workingServerCount < 2) {
      recommendations.push('Conectividade limitada - apenas alguns servidores TURN funcionando');
    }

    if (diagnosticState.lastDiagnostic?.bestServer?.latency > 200) {
      recommendations.push('Alta latência detectada - pode afetar qualidade da conexão');
    }

    return recommendations;
  }, [diagnosticState]);

  return {
    // Estado
    isRunning: diagnosticState.isRunning,
    isComplete: diagnosticState.isComplete,
    hasValidTurn: diagnosticState.hasValidTurn,
    workingServerCount: diagnosticState.workingServerCount,
    error: diagnosticState.error,
    lastDiagnostic: diagnosticState.lastDiagnostic,
    
    // Funções
    runDiagnostic,
    forceRefresh,
    isReadyForWebRTC,
    getRecommendations
  };
};