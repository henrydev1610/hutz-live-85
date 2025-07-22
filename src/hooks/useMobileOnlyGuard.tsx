
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { detectMobileAggressively, clearDeviceCache, validateParticipantAccess } from '@/utils/media/deviceDetection';

interface MobileGuardOptions {
  redirectTo?: string;
  allowDesktop?: boolean;
  showToast?: boolean;
  enforceQRAccess?: boolean;
}

export const useMobileOnlyGuard = (options: MobileGuardOptions = {}) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  
  const {
    redirectTo = '/',
    allowDesktop = false,
    showToast = true,
    enforceQRAccess = true
  } = options;

  useEffect(() => {
    const validateMobileAccess = async () => {
      console.log('🔒 MOBILE GUARD: Starting ENHANCED validation with FORCE OVERRIDE support');
      
      // Clear device cache for fresh detection
      clearDeviceCache();
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // FASE 1: Enhanced mobile detection with force parameters
      const urlParams = new URLSearchParams(window.location.search);
      const forceMobile = urlParams.get('forceMobile') === 'true' || urlParams.get('mobile') === 'true';
      const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
      const hasCameraParam = urlParams.get('camera') === 'environment' || urlParams.get('camera') === 'user';
      const isParticipantRoute = window.location.pathname.includes('/participant/');
      
      // CRITICAL: Force mobile if any override parameters are present
      const hasForceOverride = forceMobile || hasQRParam || hasCameraParam || isParticipantRoute;
      
      console.log('🔒 MOBILE GUARD: Force override check:', {
        forceMobile,
        hasQRParam,
        hasCameraParam,
        isParticipantRoute,
        hasForceOverride,
        currentURL: window.location.href
      });
      
      // Enhanced mobile detection (now includes force override logic)
      const enhancedMobileDetection = detectMobileAggressively();
      
      // Use participant access validation
      const participantValidation = validateParticipantAccess();
      
      const isMobileDevice = hasForceOverride || enhancedMobileDetection || participantValidation.isValid;
      
      setIsMobile(isMobileDevice);
      
      console.log('🔒 MOBILE GUARD: ENHANCED Detection result:', {
        enhancedMobileDetection,
        hasForceOverride,
        participantValidation,
        allowDesktop,
        finalDecision: isMobileDevice ? 'ALLOW' : 'BLOCK',
        userAgent: navigator.userAgent.substring(0, 100),
        touchPoints: navigator.maxTouchPoints,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        hasTouch: 'ontouchstart' in window
      });
      
      // ENHANCED MOBILE ENFORCEMENT
      if (!isMobileDevice && !allowDesktop) {
        console.log('🚫 MOBILE GUARD: NON-MOBILE DETECTED - BLOCKING ACCESS');
        console.log('🚫 Block reason:', participantValidation.reason);
        
        if (showToast) {
          toast.error(`🚫 Acesso bloqueado: ${participantValidation.reason}. Escaneie o QR Code com seu celular.`);
        }
        
        // Small delay to show toast before redirect
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 3000);
        
        return;
      }
      
      // If validated as mobile, mark QR access and store validation
      if (isMobileDevice) {
        if (hasForceOverride) {
          sessionStorage.setItem('accessedViaQR', 'true');
          sessionStorage.setItem('forcedMobile', 'true');
          console.log('✅ MOBILE GUARD: Force override applied and stored');
        }
        
        sessionStorage.setItem('mobileValidated', 'true');
        console.log('✅ MOBILE GUARD: Mobile validation passed - camera access allowed');
        
        if (showToast && hasForceOverride) {
          toast.success('📱 Acesso móvel forçado - câmera do celular será ativada');
        }
      }
      
      setIsValidated(true);
    };

    validateMobileAccess();
  }, [navigate, redirectTo, allowDesktop, showToast, enforceQRAccess]);

  return {
    isMobile,
    isValidated,
    isBlocked: isMobile === false && !allowDesktop
  };
};
