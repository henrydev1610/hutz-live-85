
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
    try {
      console.log("Generating QR Code via backend API...");
      console.log("API Base URL:", apiBaseUrl);
      
      const response = await fetch(`${apiBaseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Response Error:", response.status, response.statusText, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("QR Code data received:", data);
      
      state.setSessionId(data.roomId);
      state.setQrCodeURL(data.joinURL);
      state.setQrCodeSvg(data.qrDataUrl);
      state.setParticipantList([]);
      
      toast({
        title: "QR Code gerado",
        description: "QR Code gerado com sucesso via backend. Compartilhe com os participantes.",
      });
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      
      try {
        console.log("Backend failed, generating QR Code locally as fallback...");
        const fallbackSessionId = generateSessionId();
        const frontendUrl = window.location.origin;
        const fallbackUrl = `${frontendUrl}/participant/${fallbackSessionId}?mobile=true&qr=true&autostart=true`;
        console.log(`🔗 QR FALLBACK: Generated URL: ${fallbackUrl}`);
        
        const qrDataUrl = await QRCode.toDataURL(fallbackUrl, {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        state.setSessionId(fallbackSessionId);
        state.setQrCodeURL(fallbackUrl);
        state.setQrCodeSvg(qrDataUrl);
        state.setParticipantList([]);
        
        toast({
          title: "QR Code gerado localmente",
          description: "Gerado localmente devido a problema de conectividade com o servidor.",
          variant: "default"
        });
        
      } catch (fallbackError) {
        console.error('Fallback QR generation also failed:', fallbackError);
        toast({
          title: "Erro ao gerar QR Code",
          description: `Não foi possível gerar o QR Code: ${error.message}`,
          variant: "destructive"
        });
      }
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
