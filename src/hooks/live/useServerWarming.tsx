import { useState, useCallback, useRef } from 'react';
import { getBackendBaseURL } from '@/utils/connectionUtils';

interface ServerWarmingState {
  isWarming: boolean;
  progress: number;
  stage: 'ping' | 'health' | 'websocket' | 'complete';
  error?: string;
}

export const useServerWarming = () => {
  const [warmingState, setWarmingState] = useState<ServerWarmingState>({
    isWarming: false,
    progress: 0,
    stage: 'ping'
  });

  const warmingTimeoutRef = useRef<NodeJS.Timeout>();
  const serverWarmCache = useRef(new Map<string, { warmedAt: number; isWarm: boolean }>());

  const isServerWarm = useCallback((url: string): boolean => {
    const cached = serverWarmCache.current.get(url);
    if (!cached) return false;
    
    const warmDuration = 10 * 60 * 1000; // 10 minutes
    const isStillWarm = Date.now() - cached.warmedAt < warmDuration;
    
    if (!isStillWarm) {
      serverWarmCache.current.delete(url);
      return false;
    }
    
    return cached.isWarm;
  }, []);

  const markServerWarm = useCallback((url: string) => {
    serverWarmCache.current.set(url, {
      warmedAt: Date.now(),
      isWarm: true
    });
  }, []);

  const warmUpServer = useCallback(async (url?: string): Promise<boolean> => {
    const serverUrl = url || getBackendBaseURL();
    
    // Check if already warm
    if (isServerWarm(serverUrl)) {
      console.log('🔥 Server already warm, skipping warmup');
      return true;
    }

    setWarmingState({
      isWarming: true,
      progress: 0,
      stage: 'ping'
    });

    try {
      // Stage 1: Ping endpoint (0-25%)
      console.log('🔥 WARMING: Stage 1 - Ping server');
      setWarmingState(prev => ({ ...prev, progress: 10, stage: 'ping' }));
      
      await fetch(`${serverUrl}/ping`, { 
        method: 'GET',
        signal: AbortSignal.timeout(15000)
      });
      
      setWarmingState(prev => ({ ...prev, progress: 25 }));
      
      // Stage 2: Health check (25-50%)
      console.log('🔥 WARMING: Stage 2 - Health check');
      setWarmingState(prev => ({ ...prev, progress: 35, stage: 'health' }));
      
      const healthResponse = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(20000)
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.status}`);
      }
      
      setWarmingState(prev => ({ ...prev, progress: 50 }));
      
      // Stage 3: WebSocket readiness (50-75%)
      console.log('🔥 WARMING: Stage 3 - WebSocket readiness');
      setWarmingState(prev => ({ ...prev, progress: 60, stage: 'websocket' }));
      
      // Test WebSocket endpoint availability
      await fetch(`${serverUrl}/socket.io/`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      
      setWarmingState(prev => ({ ...prev, progress: 75 }));
      
      // Stage 4: Complete (75-100%)
      console.log('🔥 WARMING: Stage 4 - Complete');
      setWarmingState(prev => ({ ...prev, progress: 90, stage: 'complete' }));
      
      // Mark server as warm
      markServerWarm(serverUrl);
      
      setWarmingState(prev => ({ ...prev, progress: 100, isWarming: false }));
      
      console.log('✅ Server warming complete');
      return true;
      
    } catch (error) {
      console.error('❌ Server warming failed:', error);
      setWarmingState({
        isWarming: false,
        progress: 0,
        stage: 'ping',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }, [isServerWarm, markServerWarm]);

  const resetWarming = useCallback(() => {
    if (warmingTimeoutRef.current) {
      clearTimeout(warmingTimeoutRef.current);
    }
    setWarmingState({
      isWarming: false,
      progress: 0,
      stage: 'ping'
    });
  }, []);

  const clearWarmCache = useCallback(() => {
    serverWarmCache.current.clear();
    console.log('🧹 Server warm cache cleared');
  }, []);

  return {
    warmingState,
    warmUpServer,
    resetWarming,
    clearWarmCache,
    isServerWarm,
    markServerWarm
  };
};