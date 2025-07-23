
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
    try {
      console.log("🎯 QR GENERATION FASE 1: Starting with FORCED MOBILE PARAMS...");
      console.log("📍 Frontend URL:", productionUrl);
      console.log("📡 Backend URL:", backendUrl);
      console.log("📱 FORCED MOBILE PARAMS:", FORCED_MOBILE_PARAMS);
      
      const response = await fetch(`${backendUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ QR API Error:", response.status, response.statusText, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("✅ QR API Success:", data);
      
      // FASE 1: FORÇAR PARÂMETROS MOBILE na URL retornada
      let finalUrl = data.joinURL;
      if (finalUrl && !finalUrl.includes('forceMobile=true')) {
        // Se a URL não tem os parâmetros mobile, adicionar
        const hasExistingParams = finalUrl.includes('?');
        if (hasExistingParams) {
          finalUrl = finalUrl + '&forceMobile=true&camera=environment&qr=1&mobile=true';
        } else {
          finalUrl = finalUrl + FORCED_MOBILE_PARAMS;
        }
        console.log('📱 QR FASE 1: FORCED mobile params added to API URL:', finalUrl);
      }
      
      // FASE 1: URL VALIDATION - Verificar se URL final tem parâmetros mobile
      if (!finalUrl.includes('forceMobile=true') || !finalUrl.includes('camera=environment')) {
        console.error('❌ QR FASE 1: CRITICAL - URL missing forced mobile params!');
      } else {
        console.log('✅ QR FASE 1: URL validated with mobile params');
      }
      
      state.setSessionId(data.roomId);
      state.setQrCodeURL(finalUrl);
      state.setQrCodeSvg(data.qrDataUrl);
      state.setParticipantList([]);
      
      toast({
        title: "QR Code gerado",
        description: "QR Code gerado com parâmetros mobile FORÇADOS.",
      });
      
    } catch (error) {
      console.error('❌ QR BACKEND ERROR:', error);
      
      try {
        console.log("🔄 QR FALLBACK FASE 1: Generating with FORCED mobile params...");
        const fallbackSessionId = generateSessionId();
        
        // FASE 1: CRÍTICO - SEMPRE incluir parâmetros mobile no fallback
        const fallbackUrl = `${productionUrl}/participant/${fallbackSessionId}${FORCED_MOBILE_PARAMS}`;
        console.log(`🎯 QR FALLBACK URL with MOBILE PARAMS: ${fallbackUrl}`);
        
        // FASE 1: URL VALIDATION CRÍTICA
        if (!fallbackUrl.includes('forceMobile=true') || !fallbackUrl.includes('camera=environment')) {
          console.error('❌ QR FALLBACK FASE 1: CRITICAL - Fallback URL missing mobile params!');
        } else {
          console.log('✅ QR FALLBACK FASE 1: URL validated with mobile params');
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
          title: "QR Code gerado (fallback)",
          description: "Gerado com parâmetros mobile FORÇADOS.",
          variant: "default"
        });
        
      } catch (fallbackError) {
        console.error('❌ QR FALLBACK FAILED:', fallbackError);
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
