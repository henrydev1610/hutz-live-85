import { toast } from "sonner";

export const handleMediaError = (error: unknown, isMobile: boolean, attemptNumber: number, totalAttempts: number): void => {
  console.error(`❌ MEDIA: Constraint ${attemptNumber} failed (Mobile: ${isMobile}):`, error);
  
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      if (attemptNumber === 1) {
        toast.error('Por favor, permita o acesso à câmera/microfone e clique em "Permitir" quando solicitado.');
      }
      // Só lança o erro na última tentativa
      if (attemptNumber === totalAttempts) {
        throw error;
      }
    } else if (error.name === 'NotFoundError') {
      console.warn(`⚠️ MEDIA: Device not found with constraint ${attemptNumber}, trying next...`);
      if (attemptNumber === 1) {
        toast.error('Câmera não encontrada. Tentando configurações alternativas...');
      }
    } else if (error.name === 'OverconstrainedError') {
      console.warn(`⚠️ MEDIA: Constraints too strict for constraint ${attemptNumber}, trying simpler...`);
    } else if (error.name === 'NotReadableError') {
      console.warn(`⚠️ MEDIA: Device is in use by another application, trying next...`);
    }
  }
  
  if (attemptNumber === totalAttempts) {
    console.error(`❌ MEDIA: All constraints failed (Mobile: ${isMobile})`);
    toast.error('Não foi possível acessar a câmera. Verifique as permissões e tente novamente.');
    throw error;
  }
};