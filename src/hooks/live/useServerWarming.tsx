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
    
    const warmDuration = 15 * 60 * 1000; // 15 minutes - enhanced for production
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
      
      const pingResponse = await fetch(`${serverUrl}/ping`, { 
        method: 'GET',
        signal: AbortSignal.timeout(20000),
        headers: {
          'X-Render-Wake': 'true',
          'Cache-Control': 'no-cache'
        }
      });

      // Enhanced 502/504 detection for server warming
      if (pingResponse.status === 502 || pingResponse.status === 504) {
        console.log('🔥 WARMING: Server dormant, extending warm-up time...');
        setWarmingState(prev => ({ ...prev, progress: 15, stage: 'ping' }));
        await new Promise(resolve => setTimeout(resolve, 2000)); // Extra time for Render.com
      }
      
      setWarmingState(prev => ({ ...prev, progress: 25 }));
      
      // Stage 2: Health check (25-50%)
      console.log('🔥 WARMING: Stage 2 - Health check');
      setWarmingState(prev => ({ ...prev, progress: 35, stage: 'health' }));
      
      const healthResponse = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(25000),
        headers: {
          'X-Render-Wake': 'true',
          'Cache-Control': 'no-cache'
        }
      });
      
      // Enhanced server warming detection
      if (healthResponse.status === 502 || healthResponse.status === 504) {
        console.log('🔥 WARMING: Health endpoint warming up...');
        setWarmingState(prev => ({ ...prev, progress: 40, stage: 'health' }));
        await new Promise(resolve => setTimeout(resolve, 3000)); // Extended for Render.com
        // Retry health check after warming
        const retryHealth = await fetch(`${serverUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(25000)
        });
        if (!retryHealth.ok && retryHealth.status !== 502 && retryHealth.status !== 504) {
          throw new Error(`Health check failed: ${retryHealth.status}`);
        }
      } else if (!healthResponse.ok) {
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