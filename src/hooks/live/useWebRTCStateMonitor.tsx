// FASE 3: Hook para monitorar e corrigir estado WebRTC travado
import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface WebRTCStateMonitorConfig {
  maxConnectingTime: number;  // Max time in connecting state
  checkInterval: number;      // Check every N milliseconds
  autoResetEnabled: boolean;  // Enable automatic reset
}

interface UseWebRTCStateMonitorProps {
  isActive: boolean;
  onWebRTCStuck: () => void;
  onForceReset: () => void;
  config?: Partial<WebRTCStateMonitorConfig>;
}

const DEFAULT_CONFIG: WebRTCStateMonitorConfig = {
  maxConnectingTime: 15000,  // 15 seconds max
  checkInterval: 5000,       // Check every 5 seconds
  autoResetEnabled: true
};

export const useWebRTCStateMonitor = ({
  isActive,
  onWebRTCStuck,
  onForceReset,
  config = {}
}: UseWebRTCStateMonitorProps) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stateHistoryRef = useRef<Array<{ state: string; timestamp: number; source: string }>>([]);
  const connectingStartTimeRef = useRef<number | null>(null);
  const lastResetRef = useRef<number>(0);

  // Coletar estado WebRTC de múltiplas fontes
  const getWebRTCState = useCallback((): { state: string; source: string } => {
    try {
      // Fonte 1: Live Page Debug
      if (typeof window !== 'undefined') {
        const livePageDebug = (window as any).__livePageDebug;
        if (livePageDebug && typeof livePageDebug.getConnectionState === 'function') {
          const connectionState = livePageDebug.getConnectionState();
          if (connectionState?.webrtc) {
            return { state: connectionState.webrtc, source: 'livePageDebug' };
          }
        }
      }

      // Fonte 2: Unified WebRTC Manager (se disponível globalmente)
      const unifiedManager = (window as any).__unifiedWebRTCManager;
      if (unifiedManager && typeof unifiedManager.getConnectionState === 'function') {
        const connectionState = unifiedManager.getConnectionState();
        if (connectionState?.webrtc) {
          return { state: connectionState.webrtc, source: 'unifiedManager' };
        }
      }

      // Fonte 3: Document events ou DOM inspection
      const webrtcEvents = document.querySelectorAll('[data-webrtc-state]');
      if (webrtcEvents.length > 0) {
        const lastEvent = webrtcEvents[webrtcEvents.length - 1];
        const state = lastEvent.getAttribute('data-webrtc-state');
        if (state) {
          return { state, source: 'domEvents' };
        }
      }

      return { state: 'unknown', source: 'none' };
    } catch (error) {
      console.error('❌ STATE MONITOR: Error getting WebRTC state:', error);
      return { state: 'error', source: 'error' };
    }
  }, []);

  // Analisar histórico de estados para detecção de loops
  const analyzeStateHistory = useCallback((): {
    isStuck: boolean;
    stuckDuration: number;
    pattern: string;
  } => {
    const now = Date.now();
    const recentHistory = stateHistoryRef.current.filter(
      entry => now - entry.timestamp < 60000 // Last 60 seconds
    );

    if (recentHistory.length === 0) {
      return { isStuck: false, stuckDuration: 0, pattern: 'empty' };
    }

    // Check for stuck in connecting state
    const connectingEntries = recentHistory.filter(entry => entry.state === 'connecting');
    if (connectingEntries.length > 0) {
      const firstConnecting = connectingEntries[0];
      const stuckDuration = now - firstConnecting.timestamp;
      
      // If we've been connecting for too long
      if (stuckDuration > fullConfig.maxConnectingTime) {
        return { 
          isStuck: true, 
          stuckDuration, 
          pattern: 'stuck-connecting' 
        };
      }
    }

    // Check for oscillating states (connecting <-> disconnected)
    const stateChanges = recentHistory.length;
    if (stateChanges > 10) { // Too many state changes
      return { 
        isStuck: true, 
        stuckDuration: now - recentHistory[0].timestamp, 
        pattern: 'oscillating' 
      };
    }

    return { isStuck: false, stuckDuration: 0, pattern: 'normal' };
  }, [fullConfig.maxConnectingTime]);

  // Executar correção baseada no tipo de problema
  const executeCorrection = useCallback((analysis: {
    isStuck: boolean;
    stuckDuration: number;
    pattern: string;
  }) => {
    const now = Date.now();
    const timeSinceLastReset = now - lastResetRef.current;
    
    // Avoid too frequent resets
    if (timeSinceLastReset < 10000) { // 10s cooldown
      console.log('🚫 STATE MONITOR: Reset cooldown active, skipping correction');
      return;
    }

    console.warn('🚨 STATE MONITOR: WebRTC stuck detected:', analysis);
    
    if (analysis.pattern === 'stuck-connecting') {
      const durationSeconds = Math.round(analysis.stuckDuration / 1000);
      console.log(`🔄 STATE MONITOR: WebRTC stuck in connecting for ${durationSeconds}s - triggering recovery`);
      
      toast.warning(`🔄 WebRTC travado por ${durationSeconds}s - reconectando...`, { 
        duration: 4000 
      });
      
      onWebRTCStuck();
      lastResetRef.current = now;
      
    } else if (analysis.pattern === 'oscillating') {
      console.log('🔥 STATE MONITOR: WebRTC oscillating - force reset needed');
      
      toast.error('🔥 WebRTC instável - reset forçado', { 
        duration: 5000 
      });
      
      onForceReset();
      lastResetRef.current = now;
    }
  }, [onWebRTCStuck, onForceReset]);

  // Loop principal de monitoramento
  const monitorWebRTCState = useCallback(() => {
    if (!isActive) return;

    try {
      const { state, source } = getWebRTCState();
      const now = Date.now();
      
      // Add to history
      stateHistoryRef.current.push({ state, timestamp: now, source });
      
      // Keep only recent history (last 2 minutes)
      stateHistoryRef.current = stateHistoryRef.current.filter(
        entry => now - entry.timestamp < 120000
      );

      // Track connecting start time
      if (state === 'connecting' && connectingStartTimeRef.current === null) {
        connectingStartTimeRef.current = now;
        console.log('⏱️ STATE MONITOR: Started connecting timer');
      } else if (state !== 'connecting') {
        connectingStartTimeRef.current = null;
      }

      // Analyze for problems
      const analysis = analyzeStateHistory();
      
      // Log every 30 seconds or on state changes
      const shouldLog = stateHistoryRef.current.length === 1 || 
                       now % 30000 < fullConfig.checkInterval;
      
      if (shouldLog) {
        console.log('📊 STATE MONITOR:', {
          currentState: state,
          source,
          historySize: stateHistoryRef.current.length,
          analysis,
          connectingTime: connectingStartTimeRef.current ? now - connectingStartTimeRef.current : 0
        });
      }

      // Execute correction if needed
      if (analysis.isStuck && fullConfig.autoResetEnabled) {
        executeCorrection(analysis);
      }

    } catch (error) {
      console.error('❌ STATE MONITOR: Error during monitoring:', error);
    }
  }, [isActive, getWebRTCState, analyzeStateHistory, executeCorrection, fullConfig]);

  const startMonitoring = useCallback(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
    }

    console.log('🔍 STATE MONITOR: Starting WebRTC state monitoring', {
      maxConnectingTime: fullConfig.maxConnectingTime / 1000 + 's',
      checkInterval: fullConfig.checkInterval / 1000 + 's',
      autoResetEnabled: fullConfig.autoResetEnabled
    });

    // Initial check
    monitorWebRTCState();
    
    // Set interval
    monitorIntervalRef.current = setInterval(monitorWebRTCState, fullConfig.checkInterval);
  }, [monitorWebRTCState, fullConfig]);

  const stopMonitoring = useCallback(() => {
    console.log('🔍 STATE MONITOR: Stopping WebRTC state monitoring');
    
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
    
    // Reset state
    stateHistoryRef.current = [];
    connectingStartTimeRef.current = null;
  }, []);

  const forceCheck = useCallback(() => {
    console.log('🔍 STATE MONITOR: Force check requested');
    monitorWebRTCState();
  }, [monitorWebRTCState]);

  const getMonitoringStatus = useCallback(() => {
    const now = Date.now();
    return {
      isMonitoring: !!monitorIntervalRef.current,
      currentState: getWebRTCState(),
      historySize: stateHistoryRef.current.length,
      connectingTime: connectingStartTimeRef.current ? now - connectingStartTimeRef.current : 0,
      analysis: analyzeStateHistory(),
      config: fullConfig
    };
  }, [getWebRTCState, analyzeStateHistory, fullConfig]);

  // Auto-start/stop based on isActive
  useEffect(() => {
    if (isActive) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isActive, startMonitoring, stopMonitoring]);

  return {
    startMonitoring,
    stopMonitoring,
    forceCheck,
    getMonitoringStatus
  };
};
