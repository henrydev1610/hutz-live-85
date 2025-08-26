import { useState, useCallback, useRef } from 'react';

interface UserGestureRecoveryProps {
  onRecoveryRequested: () => Promise<boolean>;
  participantId: string;
}

export const useUserGestureRecovery = ({
  onRecoveryRequested,
  participantId
}: UserGestureRecoveryProps) => {
  const [requiresUserGesture, setRequiresUserGesture] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const gestureTimeoutRef = useRef<NodeJS.Timeout>();

  const requestUserGesture = useCallback((reason: string) => {
    console.warn(`🤏 [USER-GESTURE] Recovery requires user interaction: ${reason}`);
    setRequiresUserGesture(true);

    // Auto-hide gesture request after 10 seconds
    if (gestureTimeoutRef.current) {
      clearTimeout(gestureTimeoutRef.current);
    }
    gestureTimeoutRef.current = setTimeout(() => {
      setRequiresUserGesture(false);
    }, 10000);
  }, []);

  const handleUserGesture = useCallback(async () => {
    if (!requiresUserGesture) return;

    setIsRecovering(true);
    console.log('👆 [USER-GESTURE] User tapped for recovery');

    try {
      const success = await onRecoveryRequested();
      if (success) {
        setRequiresUserGesture(false);
        console.log('✅ [USER-GESTURE] Recovery successful');
      } else {
        console.warn('⚠️ [USER-GESTURE] Recovery failed, keeping gesture UI');
      }
    } catch (error) {
      console.error('❌ [USER-GESTURE] Recovery error:', error);
    } finally {
      setIsRecovering(false);
    }
  }, [requiresUserGesture, onRecoveryRequested]);

  const clearGestureRequest = useCallback(() => {
    setRequiresUserGesture(false);
    if (gestureTimeoutRef.current) {
      clearTimeout(gestureTimeoutRef.current);
    }
  }, []);

  return {
    requiresUserGesture,
    isRecovering,
    requestUserGesture,
    handleUserGesture,
    clearGestureRequest
  };
};