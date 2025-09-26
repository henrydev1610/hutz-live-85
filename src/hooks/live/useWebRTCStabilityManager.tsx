// FASE 2&5: Hook para gerenciar estabilidade WebRTC com diagnósticos objetivos

import { useEffect, useRef, useState, useCallback } from 'react';
import { EnhancedConnectionHandler } from '@/utils/webrtc/EnhancedConnectionHandler';
import { centralizedVideoRenderer } from '@/utils/webrtc/CentralizedVideoRenderer';

interface WebRTCStabilityState {
  isStable: boolean;
  connectionsCount: number;
  healthyVideosCount: number;
  lastDiagnostic: string;
  failureCount: number;
}

export const useWebRTCStabilityManager = (isHost: boolean = false) => {
  const connectionHandler = useRef<EnhancedConnectionHandler | null>(null);
  const [stabilityState, setStabilityState] = useState<WebRTCStabilityState>({
    isStable: true,
    connectionsCount: 0,
    healthyVideosCount: 0,
    lastDiagnostic: 'Initializing...',
    failureCount: 0
  });

  // FASE 5: Diagnóstico contínuo
  const runDiagnostics = useCallback(() => {
    if (!connectionHandler.current) return;

    const diagnostics = connectionHandler.current.getDiagnostics();
    const systemDiag = centralizedVideoRenderer.getSystemDiagnostics();
    
    // FASE 5: Critérios objetivos de estabilidade
    const isStable = diagnostics.connections > 0 ? 
      (diagnostics.healthyVideos / diagnostics.connections) >= 0.8 : // 80% dos vídeos saudáveis
      true; // Sem conexões é considerado estável
    
    const diagnosticSummary = `Connections: ${diagnostics.connections}, Healthy: ${diagnostics.healthyVideos}, Overall: ${systemDiag.overallHealth ? 'OK' : 'ISSUES'}`;
    
    setStabilityState(prev => ({
      ...prev,
      isStable,
      connectionsCount: diagnostics.connections,
      healthyVideosCount: diagnostics.healthyVideos,
      lastDiagnostic: diagnosticSummary,
      failureCount: isStable ? 0 : prev.failureCount + 1
    }));

    // Log diagnóstico estruturado
    console.log(`📊 STABILITY: ${diagnosticSummary} | Stable: ${isStable}`);
    
    // FASE 5: Log detalhado de participantes
    diagnostics.participantStates.forEach(state => {
      const videoHealth = centralizedVideoRenderer.isVideoHealthy(state.participantId);
      console.log(`👤 PARTICIPANT: ${state.participantId} | Connection: ${state.connectionState} | Video: ${videoHealth ? '✅' : '❌'} (${state.videoMetrics.width}x${state.videoMetrics.height})`);
    });

  }, []);

  // Inicializar connection handler
  useEffect(() => {
    if (!connectionHandler.current) {
      connectionHandler.current = new EnhancedConnectionHandler(isHost);
      console.log(`🎯 STABILITY: Connection handler initialized, isHost: ${isHost}`);
    }

    // Configurar diagnóstico periódico
    const diagnosticInterval = setInterval(runDiagnostics, 5000); // A cada 5s

    return () => {
      clearInterval(diagnosticInterval);
    };
  }, [isHost, runDiagnostics]);

  // FASE 2: Criar conexão com participante
  const createConnection = useCallback((participantId: string, localStream?: MediaStream) => {
    if (!connectionHandler.current) return null;
    
    console.log(`🤝 STABILITY: Creating connection for ${participantId}`);
    return connectionHandler.current.createConnection(participantId, localStream);
  }, []);

  // FASE 2: Processar sinalização
  const handleOffer = useCallback(async (participantId: string, offer: RTCSessionDescriptionInit) => {
    if (!connectionHandler.current) return;
    await connectionHandler.current.handleOffer(participantId, offer);
  }, []);

  const handleAnswer = useCallback(async (participantId: string, answer: RTCSessionDescriptionInit) => {
    if (!connectionHandler.current) return;
    await connectionHandler.current.handleAnswer(participantId, answer);
  }, []);

  const handleIceCandidate = useCallback(async (participantId: string, candidate: RTCIceCandidate) => {
    if (!connectionHandler.current) return;
    await connectionHandler.current.handleIceCandidate(participantId, candidate);
  }, []);

  // FASE 2: Substituir track (troca de câmera)
  const replaceVideoTrack = useCallback(async (participantId: string, newTrack: MediaStreamTrack) => {
    if (!connectionHandler.current) return;
    await connectionHandler.current.replaceVideoTrack(participantId, newTrack);
    console.log(`🔄 STABILITY: Video track replaced for ${participantId}`);
  }, []);

  // Configurar callbacks
  const setStreamCallback = useCallback((callback: (participantId: string, stream: MediaStream) => void) => {
    if (connectionHandler.current) {
      connectionHandler.current.setStreamCallback(callback);
    }
  }, []);

  const setParticipantJoinCallback = useCallback((callback: (participantId: string) => void) => {
    if (connectionHandler.current) {
      connectionHandler.current.setParticipantJoinCallback(callback);
    }
  }, []);

  // Limpeza
  const cleanup = useCallback(() => {
    if (connectionHandler.current) {
      connectionHandler.current.cleanup();
      console.log(`🧹 STABILITY: Full cleanup completed`);
    }
  }, []);

  const cleanupConnection = useCallback((participantId: string) => {
    if (connectionHandler.current) {
      connectionHandler.current.cleanupConnection(participantId);
      console.log(`🧹 STABILITY: Connection cleaned for ${participantId}`);
    }
  }, []);

  // FASE 5: Forçar diagnóstico imediato
  const forceDiagnostic = useCallback(() => {
    runDiagnostics();
    return stabilityState;
  }, [runDiagnostics, stabilityState]);

  // FASE 5: Verificar saúde do sistema
  const getSystemHealth = useCallback(() => {
    const systemDiag = centralizedVideoRenderer.getSystemDiagnostics();
    const connectionDiag = connectionHandler.current?.getDiagnostics();
    
    return {
      system: systemDiag,
      connections: connectionDiag,
      stability: stabilityState,
      timestamp: Date.now()
    };
  }, [stabilityState]);

  // Verificações de estado
  const hasConnection = useCallback((participantId: string) => {
    return connectionHandler.current?.hasConnection(participantId) || false;
  }, []);

  const getConnectionState = useCallback((participantId: string) => {
    return connectionHandler.current?.getConnectionState(participantId) || null;
  }, []);

  return {
    // Estado
    stabilityState,
    
    // Conexões
    createConnection,
    hasConnection,
    getConnectionState,
    
    // Sinalização
    handleOffer,
    handleAnswer, 
    handleIceCandidate,
    replaceVideoTrack,
    
    // Callbacks
    setStreamCallback,
    setParticipantJoinCallback,
    
    // Limpeza
    cleanup,
    cleanupConnection,
    
    // Diagnósticos
    forceDiagnostic,
    getSystemHealth,
    runDiagnostics
  };
};