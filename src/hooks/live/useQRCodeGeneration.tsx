
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import QRCode from 'qrcode';
import { generateSessionId } from '@/utils/sessionUtils';
import { getBackendBaseURL } from '@/utils/connectionUtils';

// FASE 2: URL SYNC CRÍTICO - Usar APENAS server-hutz-live.onrender.com
const getProductionBackendURL = (): string => {
  // CRÍTICO: Sempre usar server-hutz-live para backend
  const backendUrl = 'https://server-hutz-live.onrender.com';
  console.log(`🌐 QR BACKEND: Forced production backend URL: ${backendUrl}`);
  return backendUrl;
};

const getProductionFrontendURL = (): string => {
  // CRÍTICO: Sempre usar hutz-live-85 para frontend
  const frontendUrl = 'https://hutz-live-85.onrender.com';
  console.log(`🌐 QR FRONTEND: Forced production frontend URL: ${frontendUrl}`);
  return frontendUrl;
};

export const useQRCodeGeneration = () => {
  const { toast } = useToast();
  const [productionBackendUrl] = useState(getProductionBackendURL());
  const [productionFrontendUrl] = useState(getProductionFrontendURL());

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

  // FASE 1: Room creation ANTES de gerar QR Code
  const handleGenerateQRCode = async (state: any) => {
    try {
      console.log("🏠 ROOM CREATION: Starting room creation BEFORE QR generation");
      console.log("📍 Backend URL:", productionBackendUrl);
      console.log("📱 Frontend URL:", productionFrontendUrl);
      
      // FASE 1: Criar sala ANTES de gerar QR Code
      console.log("🚀 ROOM CREATION: Creating room on server");
      
      const response = await fetch(`${productionBackendUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ ROOM API Error:", response.status, response.statusText, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("✅ ROOM CREATED:", data);
      
      // FASE 2: Validação da URL retornada para garantir consistência
      const returnedUrl = data.joinURL;
      
      // CRÍTICO: Validar se URL contém o domínio correto
      if (returnedUrl && !returnedUrl.includes('hutz-live-85.onrender.com')) {
        console.warn(`⚠️ URL INCONSISTENCY: Expected hutz-live-85.onrender.com, got ${returnedUrl}`);
        
        // FASE 1: Corrigir URL se necessário (CRITICAL FIX)
        console.log("🔄 URL CORRECTION: Fixing inconsistent URL");
        
        // Extrair roomId da URL retornada
        const roomIdMatch = returnedUrl.match(/\/participant\/([^/?]+)/);
        const roomId = roomIdMatch ? roomIdMatch[1] : data.roomId;
        
        // Construir URL correta com domínio de produção
        const correctedUrl = `${productionFrontendUrl}/participant/${roomId}?mobile=true&qr=true&camera=environment`;
        
        console.log(`🔧 URL CORRECTED: ${returnedUrl} → ${correctedUrl}`);
        
        // Usar URL corrigida
        state.setSessionId(roomId);
        state.setQrCodeURL(correctedUrl);
        
        // Gerar QR code com URL corrigida
        const qrDataUrl = await QRCode.toDataURL(correctedUrl, {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        state.setQrCodeSvg(qrDataUrl);
        
      } else {
        // URL está correta, usar valores retornados pela API
        state.setSessionId(data.roomId);
        state.setQrCodeURL(data.joinURL);
        state.setQrCodeSvg(data.qrDataUrl);
      }
      
      state.setParticipantList([]);
      
      // FASE 3: Validação adicional da sala criada
      console.log(`🔍 ROOM VALIDATION: Validating room ${data.roomId} exists`);
      try {
        const validationResponse = await fetch(`${productionBackendUrl}/api/rooms/${data.roomId}`, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (validationResponse.ok) {
          console.log("✅ ROOM VALIDATED: Room exists and is ready");
          toast({
            title: "Sala criada e QR Code gerado",
            description: "Sala validada e pronta para conexão.",
          });
        } else {
          console.warn("⚠️ ROOM VALIDATION: Room may not be ready yet");
        }
      } catch (validationError) {
        console.warn("⚠️ ROOM VALIDATION: Failed to validate room", validationError);
      }
      
    } catch (error) {
      console.error('❌ QR BACKEND ERROR:', error);
      
      try {
        console.log("🔄 FALLBACK: Room creation failed, generating emergency QR code");
        const fallbackSessionId = generateSessionId();
        
        // FASE 2: NUNCA usar window.location.origin - sempre forçar produção
        const fallbackUrl = `${productionFrontendUrl}/participant/${fallbackSessionId}?mobile=true&qr=true&camera=environment`;
        console.log(`🎯 FALLBACK URL: ${fallbackUrl}`);
        
        // FASE 5: Validar consistência da URL fallback
        if (!fallbackUrl.includes('hutz-live-85.onrender.com')) {
          console.error('❌ CRITICAL URL ERROR: Invalid production URL generated');
        }
        
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
          title: "QR Code de emergência gerado",
          description: "Tentativa de conexão direta (sem criação de sala).",
          variant: "default"
        });
        
        // FASE 3: Tentar criar sala em segundo plano
        fetch(`${productionBackendUrl}/api/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Room-Id': fallbackSessionId, // Solicitando ID específico
          },
          body: JSON.stringify({ roomId: fallbackSessionId }),
          mode: 'cors',
          credentials: 'omit'
        }).then(response => {
          if (response.ok) {
            console.log("✅ BACKGROUND ROOM CREATION: Success");
          } else {
            console.warn("⚠️ BACKGROUND ROOM CREATION: Failed");
          }
        }).catch(err => {
          console.error("❌ BACKGROUND ROOM CREATION:", err);
        });
        
      } catch (fallbackError) {
        console.error('❌ FALLBACK FAILED:', fallbackError);
        toast({
          title: "Erro ao gerar QR Code",
          description: `Falha total na geração: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  };

  const handleQRCodeToTransmission = (setQrCodeVisible: (visible: boolean) => void) => {
    setQrCodeVisible(true);
    toast({
      title: "QR Code incluído",
      description: "QR Code incluído na transmissão com URL de produção."
    });
  };

  return {
    generateQRCode,
    handleGenerateQRCode,
    handleQRCodeToTransmission,
    productionBackendUrl,
    productionFrontendUrl
  };
};
