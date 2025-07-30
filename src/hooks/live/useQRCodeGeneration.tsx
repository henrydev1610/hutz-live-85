
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import QRCode from 'qrcode';
import { generateSessionId } from '@/utils/sessionUtils';

// FASE 1: URL SYNC CRITICO - Forçar produção URLs com PARÂMETROS MOBILE OBRIGATÓRIOS
const RENDER_PRODUCTION_URL = 'https://hutz-live-85.onrender.com';
const RENDER_BACKEND_URL = 'https://server-hutz-live.onrender.com';

// FASE 1: PARÂMETROS MOBILE OBRIGATÓRIOS para todas as URLs participant
const FORCED_MOBILE_PARAMS = '?forceMobile=true&camera=environment&qr=1&mobile=true';

const getProductionURL = (): string => {
  const currentHost = window.location.host;
  
  // CRÍTICO: Sempre usar Render em produção, mesmo no Lovable
  if (currentHost.includes('lovableproject.com') || 
      currentHost.includes('localhost') || 
      currentHost.includes('127.0.0.1')) {
    console.log('🌐 QR URL OVERRIDE: Development detected, forcing production URL with MOBILE params');
    console.log(`📍 Override: ${currentHost} → ${RENDER_PRODUCTION_URL}`);
    return RENDER_PRODUCTION_URL;
  }
  
  // Se já está no Render, usar a URL atual
  if (currentHost.includes('hutz-live-85.onrender.com')) {
    const productionUrl = `https://${currentHost}`;
    console.log(`✅ QR URL: Using current Render URL: ${productionUrl}`);
    return productionUrl;
  }
  
  // Fallback para produção
  console.log(`🔄 QR URL FALLBACK: Unknown host ${currentHost}, using production`);
  return RENDER_PRODUCTION_URL;
};

const getBackendURL = (): string => {
  const frontendUrl = getProductionURL();
  
  // Se estamos forçando produção, usar backend de produção
  if (frontendUrl === RENDER_PRODUCTION_URL) {
    console.log(`🔗 BACKEND SYNC: Frontend ${frontendUrl} → Backend ${RENDER_BACKEND_URL}`);
    return RENDER_BACKEND_URL;
  }
  
  // Para outros casos, usar a mesma base
  const backendUrl = frontendUrl.replace('hutz-live-85', 'server-hutz-live');
  console.log(`🔗 BACKEND MAPPING: ${frontendUrl} → ${backendUrl}`);
  return backendUrl;
};

export const useQRCodeGeneration = () => {
  const { toast } = useToast();
  const [productionUrl] = useState(getProductionURL());
  const [backendUrl] = useState(getBackendURL());

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
    console.log("🎯 QR GENERATION: Starting QR Code generation...");
    console.log("📍 Frontend URL:", productionUrl);
    console.log("📱 MOBILE PARAMS:", FORCED_MOBILE_PARAMS);
    
    try {
      // CORREÇÃO CRÍTICA: Usar geração direta em vez de API backend problemática
      const sessionId = generateSessionId();
      const finalUrl = `${productionUrl}/participant/${sessionId}${FORCED_MOBILE_PARAMS}`;
      
      console.log(`🎯 QR URL GERADA: ${finalUrl}`);
      
      // Gerar QR Code usando a biblioteca qrcode
      const qrDataUrl = await QRCode.toDataURL(finalUrl, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      // Atualizar estado
      state.setSessionId(sessionId);
      state.setQrCodeURL(finalUrl);
      state.setQrCodeSvg(qrDataUrl);
      state.setParticipantList([]);
      
      console.log("✅ QR Code gerado com sucesso!");
      
      toast({
        title: "QR Code gerado",
        description: "Sala criada com sucesso! Compartilhe o link com os participantes.",
      });
      
    } catch (error) {
      console.error('❌ QR GENERATION ERROR:', error);
      toast({
        title: "Erro ao gerar QR Code",
        description: `Não foi possível gerar o QR Code: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleQRCodeToTransmission = (setQrCodeVisible: (visible: boolean) => void) => {
    setQrCodeVisible(true);
    toast({
      title: "QR Code incluído",
      description: "QR Code incluído na transmissão com parâmetros mobile FORÇADOS."
    });
  };

  return {
    generateQRCode,
    handleGenerateQRCode,
    handleQRCodeToTransmission,
    productionUrl,
    backendUrl
  };
};
