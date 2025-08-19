import { useEffect, useRef } from 'react';

interface UseAutoQRGenerationProps {
  sessionId: string;
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
    if (qrGeneratedRef.current || state.qrCodeSvg) return;

    console.log('🔍 AUTO QR: Iniciando geração automática do QR Code...');
    console.log('🔍 AUTO QR: SessionId:', sessionId);
    console.log('🔍 AUTO QR: QR já existe:', !!state.qrCodeSvg);

    // ✅ CORREÇÃO CRÍTICA: Gerar QR Code independente do WebRTC
    const generateAutoQR = async () => {
      try {
        qrGeneratedRef.current = true;
        console.log('🎯 AUTO QR: Gerando QR Code automaticamente (independente do WebRTC)...');
        
        await handleGenerateQRCode(state);
        
        console.log('✅ AUTO QR: QR Code gerado automaticamente');
      } catch (error) {
        console.error('❌ AUTO QR: Erro na geração automática:', error);
        qrGeneratedRef.current = false;
      }
    };

    // Geração imediata - não depende de WebRTC
    const timer = setTimeout(generateAutoQR, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionId, handleGenerateQRCode, state]);

  return {
    qrGenerated: qrGeneratedRef.current
  };
};