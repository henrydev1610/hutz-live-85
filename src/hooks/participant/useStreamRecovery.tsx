import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface StreamRecoveryOptions {
  participantId: string;
  onRecoverySuccess?: (stream: MediaStream) => void;
  onRecoveryFailure?: (error: Error) => void;
}

/**
 * FASE 3: Hook para recovery automático de stream durante reconexões
 */
export const useStreamRecovery = ({
  participantId,
  onRecoverySuccess,
  onRecoveryFailure
}: StreamRecoveryOptions) => {
  const recoveryInProgressRef = useRef(false);
  const lastKnownStreamRef = useRef<MediaStream | null>(null);
  
  // Registrar stream para possível recovery
  const registerStream = useCallback((stream: MediaStream) => {
    if (stream && stream.active) {
      lastKnownStreamRef.current = stream;
      (stream as any).__isRegisteredForRecovery = true;
      
      console.log(`✅ FASE 3: Stream ${stream.id} registered for recovery`);
      
      // Monitor stream health
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.warn(`⚠️ FASE 3: Track ${track.kind} ended - may need recovery`);
        });
      });
    }
  }, []);
  
  // Verificar se stream ainda está válido
  const validateStream = useCallback((stream: MediaStream | null): boolean => {
    if (!stream) return false;
    
    const isActive = stream.active;
    const hasLiveTracks = stream.getTracks().some(track => 
      track.readyState === 'live' && track.enabled
    );
    
    const isValid = isActive && hasLiveTracks;
    
    if (!isValid) {
      console.warn(`⚠️ FASE 3: Stream validation failed - active: ${isActive}, liveTracks: ${hasLiveTracks}`);
    }
    
    return isValid;
  }, []);
  
  // Recuperar stream se necessário
  const recoverStream = useCallback(async (): Promise<MediaStream | null> => {
    if (recoveryInProgressRef.current) {
      console.log(`⏳ FASE 3: Recovery already in progress for ${participantId}`);
      return null;
    }
    
    console.log(`🔄 FASE 3: Attempting stream recovery for ${participantId}`);
    recoveryInProgressRef.current = true;
    
    try {
      // Verificar se stream global ainda é válido
      const globalStream = (window as any).__participantSharedStream;
      
      if (validateStream(globalStream)) {
        console.log(`✅ FASE 3: Global stream still valid - no recovery needed`);
        recoveryInProgressRef.current = false;
        return globalStream;
      }
      
      // Verificar se último stream conhecido ainda é válido
      if (validateStream(lastKnownStreamRef.current)) {
        console.log(`✅ FASE 3: Last known stream still valid - restoring`);
        
        (window as any).__participantSharedStream = lastKnownStreamRef.current;
        onRecoverySuccess?.(lastKnownStreamRef.current!);
        recoveryInProgressRef.current = false;
        
        return lastKnownStreamRef.current;
      }
      
      // Tentar obter novo stream
      console.log(`🆕 FASE 3: Acquiring new stream for recovery`);
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' }, // Mobile preferência
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      
      if (newStream && validateStream(newStream)) {
        console.log(`✅ FASE 3: New stream acquired successfully - ${newStream.id}`);
        
        // Registrar novo stream
        registerStream(newStream);
        (window as any).__participantSharedStream = newStream;
        
        onRecoverySuccess?.(newStream);
        toast.success('📱 Stream recuperado com sucesso');
        
        recoveryInProgressRef.current = false;
        return newStream;
      } else {
        throw new Error('New stream validation failed');
      }
      
    } catch (error) {
      console.error(`❌ FASE 3: Stream recovery failed for ${participantId}:`, error);
      
      const errorObj = error as Error;
      onRecoveryFailure?.(errorObj);
      toast.error('❌ Falha na recuperação do stream');
      
      recoveryInProgressRef.current = false;
      return null;
    }
  }, [participantId, validateStream, registerStream, onRecoverySuccess, onRecoveryFailure]);
  
  // Verificar se recovery é necessário
  const needsRecovery = useCallback((): boolean => {
    const globalStream = (window as any).__participantSharedStream;
    return !validateStream(globalStream);
  }, [validateStream]);
  
  return {
    registerStream,
    validateStream,
    recoverStream,
    needsRecovery,
    isRecoveryInProgress: recoveryInProgressRef.current
  };
};