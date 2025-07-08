import { toast } from "sonner";

export const handleMediaError = (error: unknown, isMobile: boolean, attemptNumber: number, totalAttempts: number): void => {
  console.error(`❌ MEDIA: Constraint ${attemptNumber} failed (Mobile: ${isMobile}):`, error);
  
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      toast.error('Acesso à câmera/microfone negado. Por favor, permita o acesso nas configurações do navegador.');
      throw error;
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
    console.error(`❌ MEDIA: All constraints failed (Mobile: ${isMobile})`);
    if (isMobile) {
      toast.error('Não foi possível acessar a câmera do seu dispositivo. Verifique as permissões do navegador.');
    }
    throw error;
  }
};