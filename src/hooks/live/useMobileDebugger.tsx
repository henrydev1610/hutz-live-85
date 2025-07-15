import { useState, useEffect } from 'react';

interface MobileDebugInfo {
  participantCount: number;
  mobileCount: number;
  streamsCount: number;
  connectionState: string;
  lastUpdate: number;
  mobileParticipants: string[];
}

export const useMobileDebugger = () => {
  const [debugInfo, setDebugInfo] = useState<MobileDebugInfo>({
    participantCount: 0,
    mobileCount: 0,
    streamsCount: 0,
    connectionState: 'disconnected',
    lastUpdate: Date.now(),
    mobileParticipants: []
  });

  const updateDebugInfo = (info: Partial<MobileDebugInfo>) => {
    setDebugInfo(prev => ({
      ...prev,
      ...info,
      lastUpdate: Date.now()
    }));
  };

  // FASE 4: Debug logging for mobile connections
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('📱 MOBILE-DEBUG: Current state:', debugInfo);
    }, 5000);

    return () => clearInterval(interval);
  }, [debugInfo]);

  return {
    debugInfo,
    updateDebugInfo
  };
};