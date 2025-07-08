import { toast } from "sonner";

export const handleMediaError = (error: unknown, isMobile: boolean, attemptNumber: number, totalAttempts: number): void => {
  console.error(`❌ MEDIA: Constraint ${attemptNumber} failed (Mobile: ${isMobile}):`, error);
  
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      console.warn(`⚠️ MEDIA: Permission denied for constraint ${attemptNumber}, trying next...`);
      if (attemptNumber === 1) {
        toast.error('Acesso negado. Tentando configurações alternativas...');
      }
      // Não fazer throw - permitir que tente próxima constraint
    } else if (error.name === 'NotFoundError') {
      console.warn(`⚠️ MEDIA: Device not found with constraint ${attemptNumber}, trying next...`);
      if (attemptNumber === 1 && isMobile) {
        toast.error('Câmera não encontrada. Tentando configurações alternativas...');
      }
    } else if (error.name === 'OverconstrainedError') {
      console.warn(`⚠️ MEDIA: Constraints too strict for constraint ${attemptNumber}, trying simpler...`);
    }
  }
  
  if (attemptNumber === totalAttempts) {
    console.warn(`⚠️ MEDIA: All constraints failed (Mobile: ${isMobile}), returning null for degraded mode`);
    if (isMobile) {
      toast.error('Não foi possível acessar câmera/microfone. Conectando em modo degradado...');
    } else {
      toast.error('Não foi possível acessar mídia. Você pode tentar reconectar manualmente.');
    }
    // Não fazer throw - permitir modo degradado
  }
};