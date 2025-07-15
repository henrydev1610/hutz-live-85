
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import QRCode from 'qrcode';
import { generateSessionId } from '@/utils/sessionUtils';
import { getApiBaseURL } from '@/utils/connectionUtils';

export const useQRCodeGeneration = () => {
  const { toast } = useToast();
  const [apiBaseUrl] = useState(getApiBaseURL());

  const generateQRCode = async (url: string, setQrCodeSvg: (svg: string) => void) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      setQrCodeSvg(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar o QR Code.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateQRCode = async (state: any) => {
    console.log("🎯 ROOM CREATION: Starting room creation process...");
    console.log("🎯 ROOM CREATION: API Base URL:", apiBaseUrl);
    
    // Primeiro tentar fallback local SEMPRE (mais confiável)
    try {
      console.log("🎯 ROOM CREATION: Generating QR Code locally (primary method)...");
      const newSessionId = generateSessionId();
      const frontendUrl = window.location.origin;
      const participantUrl = `${frontendUrl}/participant/${newSessionId}?mobile=true&qr=true`;
      
      console.log(`🎯 ROOM CREATION: Generated URL: ${participantUrl}`);
      console.log(`🎯 ROOM CREATION: Session ID: ${newSessionId}`);
      
      const qrDataUrl = await QRCode.toDataURL(participantUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      
      console.log("🎯 ROOM CREATION: QR Code generated successfully");
      
      // Atualizar estado imediatamente
      state.setSessionId(newSessionId);
      state.setQrCodeURL(participantUrl);
      state.setQrCodeSvg(qrDataUrl);
      state.setParticipantList([]);
      
      console.log("🎯 ROOM CREATION: State updated successfully");
      
      toast({
        title: "✅ Nova Sala Criada",
        description: `Sala ${newSessionId.substring(0, 8)} criada com sucesso! Compartilhe o QR Code com os participantes.`,
      });
      
      // Tentar registrar no backend (opcional, não bloqueia)
      try {
        console.log("🎯 ROOM CREATION: Attempting backend registration...");
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch(`${apiBaseUrl}/api/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            roomId: newSessionId,
            joinURL: participantUrl 
          }),
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log("🎯 ROOM CREATION: Backend registration successful:", data);
        } else {
          console.warn("🎯 ROOM CREATION: Backend registration failed but continuing with local room");
        }
        
      } catch (backendError) {
        console.warn("🎯 ROOM CREATION: Backend registration failed but continuing with local room:", backendError);
      }
      
      return true;
      
    } catch (error) {
      console.error('🎯 ROOM CREATION: Critical error in room creation:', error);
      
      toast({
        title: "❌ Erro na Criação",
        description: `Não foi possível criar a sala: ${error.message}. Tente novamente.`,
        variant: "destructive"
      });
      
      return false;
    }
  };

  const handleQRCodeToTransmission = (setQrCodeVisible: (visible: boolean) => void) => {
    setQrCodeVisible(true);
    toast({
      title: "QR Code incluído",
      description: "O QR Code foi incluído na tela de transmissão e pode ser redimensionado."
    });
  };

  return {
    generateQRCode,
    handleGenerateQRCode,
    handleQRCodeToTransmission
  };
};
