import { useEffect, useRef } from 'react';

interface UseAutoQRGenerationProps {
  sessionId: string | null;
  handleGenerateQRCode: (state: any) => void;
  state: any;
}

export const useAutoQRGeneration = ({ 
  sessionId, 
  handleGenerateQRCode, 
  state 
}: UseAutoQRGenerationProps) => {
  const qrGeneratedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || qrGeneratedRef.current || state.qrCodeSvg) return;

    console.log('🔍 AUTO QR: SessionId disponível, gerando QR Code automaticamente...');
    console.log('🔍 AUTO QR: SessionId:', sessionId);
    console.log('🔍 AUTO QR: QR já existe:', !!state.qrCodeSvg);

    // Gerar QR Code automaticamente quando sessionId estiver disponível
    const generateAutoQR = async () => {
      try {
        qrGeneratedRef.current = true;
        console.log('🎯 AUTO QR: Iniciando geração automática...');
        
        await handleGenerateQRCode(state);
        
        console.log('✅ AUTO QR: QR Code gerado automaticamente');
      } catch (error) {
        console.error('❌ AUTO QR: Erro na geração automática:', error);
        qrGeneratedRef.current = false;
      }
    };

    // Delay pequeno para garantir que o state está pronto
    const timer = setTimeout(generateAutoQR, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionId, handleGenerateQRCode, state]);

  return {
    qrGenerated: qrGeneratedRef.current
  };
};