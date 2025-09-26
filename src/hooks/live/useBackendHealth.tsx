/**
 * FASE 1: React Hook para monitoramento de saúde do backend
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { backendHealthChecker, BackendHealthStatus, BackendHealthResult } from '@/utils/backend/BackendHealthChecker';

export const useBackendHealth = (autoStart: boolean = true) => {
  const [healthStatus, setHealthStatus] = useState<BackendHealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<BackendHealthResult | null>(null);

  // Callback para atualizar estado quando health status muda
  const handleHealthUpdate = useCallback((status: BackendHealthStatus) => {
    setHealthStatus(status);
    
    // Mostrar alertas baseados no status
    if (status.consecutiveFailures === 3) {
      toast.error('🚨 Backend offline - Verifique sua conexão com a internet');
    } else if (status.consecutiveFailures === 1 && !status.isHealthy) {
      toast.warning('⚠️ Problemas de conectividade detectados');
    } else if (status.isHealthy && status.consecutiveFailures === 0) {
      // Backend voltou online
      if (healthStatus && !healthStatus.isHealthy) {
        toast.success('✅ Conexão com o servidor restabelecida');
      }
    }
  }, [healthStatus]);

  // Check manual do backend
  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await backendHealthChecker.checkBackendHealth();
      setLastCheckResult(result);
      return result;
    } catch (error) {
      console.error('❌ BACKEND HEALTH CHECK ERROR:', error);
      toast.error('Erro ao verificar status do servidor');
      throw error;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Validar configuração do backend
  const validateConfiguration = useCallback(async () => {
    try {
      return await backendHealthChecker.validateBackendConfiguration();
    } catch (error) {
      console.error('❌ BACKEND VALIDATION ERROR:', error);
      toast.error('Erro ao validar configuração do backend');
      throw error;
    }
  }, []);

  // Forçar re-check
  const forceCheck = useCallback(async () => {
    return await checkHealth();
  }, [checkHealth]);

  // Inicializar monitoramento
  useEffect(() => {
    if (autoStart) {
      // Adicionar listener
      backendHealthChecker.addHealthListener(handleHealthUpdate);
      
      // Iniciar monitoramento (30s de intervalo)
      backendHealthChecker.startHealthMonitoring(30000);
      
      // Check inicial
      checkHealth();
      
      return () => {
        backendHealthChecker.removeHealthListener(handleHealthUpdate);
        backendHealthChecker.stopHealthMonitoring();
      };
    }
  }, [autoStart, handleHealthUpdate, checkHealth]);

  // Estado derivado
  const isBackendOnline = healthStatus?.isHealthy ?? null;
  const isDegradedMode = healthStatus ? backendHealthChecker.isDegradedMode() : false;
  const averageResponseTime = healthStatus?.averageResponseTime ?? 0;
  const consecutiveFailures = healthStatus?.consecutiveFailures ?? 0;
  
  // Status geral do backend
  const backendStatus = healthStatus ? (
    healthStatus.isHealthy ? 'online' : 
    consecutiveFailures >= 3 ? 'offline' : 
    'unstable'
  ) : 'unknown';

  return {
    // Status
    healthStatus,
    isBackendOnline,
    isDegradedMode,
    backendStatus,
    averageResponseTime,
    consecutiveFailures,
    lastCheckResult,
    
    // Estados
    isChecking,
    
    // Ações
    checkHealth,
    forceCheck,
    validateConfiguration,
    
    // Métodos utilitários
    startMonitoring: () => backendHealthChecker.startHealthMonitoring(),
    stopMonitoring: () => backendHealthChecker.stopHealthMonitoring(),
  };
};