import { toast } from "sonner";

export const handleMediaError = (error: unknown, isMobile: boolean, attemptNumber: number, totalAttempts: number): void => {
  console.error(`❌ MEDIA: Constraint ${attemptNumber} failed (Mobile: ${isMobile}):`, error);
  
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      console.warn(`⚠️ MEDIA: Permission denied for constraint ${attemptNumber}, trying next...`);
      if (attemptNumber === 1) {
        toast.error('Acesso à câmera/microfone negado. Tentando configurações alternativas...');
      }
    } else if (error.name === 'NotFoundError') {
      console.warn(`⚠️ MEDIA: Device not found with constraint ${attemptNumber}, trying next...`);
      if (attemptNumber === 1) {
        toast.error('Câmera não encontrada. Tentando configurações alternativas...');
      }
    } else if (error.name === 'OverconstrainedError') {
      console.warn(`⚠️ MEDIA: Constraints too strict for constraint ${attemptNumber}, trying simpler...`);
    }
  }
  
  // Only throw error if all attempts failed
  if (attemptNumber === totalAttempts) {
    console.error(`❌ MEDIA: All constraints failed (Mobile: ${isMobile})`);
    toast.error('Não foi possível acessar câmera/microfone. A aplicação funcionará sem mídia.');
    throw error;
  }
};