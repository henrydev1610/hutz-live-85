import { useRef, useEffect } from 'react';

interface TimerManager {
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;
  addTimer: (timeout: NodeJS.Timeout) => void;
  addInterval: (interval: NodeJS.Timeout) => void;
  clearAll: () => void;
}

export const useTimerManager = (): TimerManager => {
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  const addTimer = (timeout: NodeJS.Timeout) => {
    timersRef.current.add(timeout);
  };

  const addInterval = (interval: NodeJS.Timeout) => {
    intervalsRef.current.add(interval);
  };

  const clearAll = () => {
    console.log(`🧹 TIMER MANAGER: Clearing ${timersRef.current.size} timers and ${intervalsRef.current.size} intervals`);
    
    timersRef.current.forEach(timer => clearTimeout(timer));
    intervalsRef.current.forEach(interval => clearInterval(interval));
    
    timersRef.current.clear();
    intervalsRef.current.clear();
  };

  // Cleanup automático na desmontagem
  useEffect(() => {
    return () => {
      clearAll();
    };
  }, []);

  return {
    timers: timersRef.current,
    intervals: intervalsRef.current,
    addTimer,
    addInterval,
    clearAll
  };
};