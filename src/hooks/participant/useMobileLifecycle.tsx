import { useEffect, useRef, useCallback } from 'react';

interface MobileLifecycleProps {
  onPageVisible: () => void;
  onPageHidden: () => void;
  onFocusLost: () => void;
  onFocusRegained: () => void;
  participantId: string;
}

export const useMobileLifecycle = ({
  onPageVisible,
  onPageHidden,
  onFocusLost,
  onFocusRegained,
  participantId
}: MobileLifecycleProps) => {
  const lastVisibilityState = useRef<'visible' | 'hidden'>('visible');
  const lastFocusState = useRef<boolean>(true);
  const keepAliveInterval = useRef<NodeJS.Timeout>();

  const startKeepAlive = useCallback(() => {
    // Dummy interactions to maintain permissions
    keepAliveInterval.current = setInterval(() => {
      if (!document.hidden && document.hasFocus()) {
        // Create a small dummy interaction to keep stream alive
        const dummyTouch = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(dummyTouch);
      }
    }, 30000); // Every 30 seconds
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveInterval.current) {
      clearInterval(keepAliveInterval.current);
      keepAliveInterval.current = undefined;
    }
  }, []);

  // Page visibility monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentState = document.hidden ? 'hidden' : 'visible';
      
      if (currentState !== lastVisibilityState.current) {
        console.log(`👁️ [LIFECYCLE] Page ${currentState}`);
        
        if (currentState === 'visible') {
          onPageVisible();
          startKeepAlive();
        } else {
          onPageHidden();
          stopKeepAlive();
        }
        
        lastVisibilityState.current = currentState;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startKeepAlive(); // Start immediately

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopKeepAlive();
    };
  }, [onPageVisible, onPageHidden, startKeepAlive, stopKeepAlive]);

  // Focus monitoring
  useEffect(() => {
    const handleFocus = () => {
      if (!lastFocusState.current) {
        console.log('🎯 [LIFECYCLE] Focus regained');
        onFocusRegained();
        lastFocusState.current = true;
      }
    };

    const handleBlur = () => {
      if (lastFocusState.current) {
        console.log('😴 [LIFECYCLE] Focus lost');
        onFocusLost();
        lastFocusState.current = false;
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onFocusLost, onFocusRegained]);

  // Battery and network monitoring
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 [LIFECYCLE] Network online');
      onFocusRegained(); // Treat as focus regained
    };

    const handleOffline = () => {
      console.log('📵 [LIFECYCLE] Network offline');
      onFocusLost(); // Treat as focus lost
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onFocusLost, onFocusRegained]);

  return {
    isVisible: !document.hidden,
    hasFocus: document.hasFocus(),
    startKeepAlive,
    stopKeepAlive
  };
};
