import { useEffect } from 'react';
import { useQRCodeGeneration } from './useQRCodeGeneration';

interface AutoQRGenerationProps {
  sessionId: string | null;
  qrCodeURL: string;
  state: any;
}

export const useAutoQRGeneration = ({ sessionId, qrCodeURL, state }: AutoQRGenerationProps) => {
  const { handleGenerateQRCode } = useQRCodeGeneration();

  useEffect(() => {
    // Gerar QR Code automaticamente quando sessionId existir mas qrCodeURL estiver vazio
    if (sessionId && !qrCodeURL) {
      console.log('🚀 AUTO QR GENERATION: SessionId exists but no QR URL, generating automatically');
      console.log(`📝 SessionId: ${sessionId}`);
      console.log(`🔗 Current QR URL: "${qrCodeURL}"`);
      
      // Pequeno delay para garantir que o estado está estável
      const timer = setTimeout(() => {
        console.log('🎯 AUTO QR GENERATION: Calling handleGenerateQRCode');
        handleGenerateQRCode(state);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [sessionId, qrCodeURL, handleGenerateQRCode, state]);
};