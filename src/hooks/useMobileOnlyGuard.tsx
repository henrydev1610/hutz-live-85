
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { detectMobileAggressively, clearDeviceCache } from '@/utils/media/deviceDetection';

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
      console.log('🔒 MOBILE GUARD: Starting ENHANCED validation for camera access');
      
      // Clear device cache for fresh detection
      clearDeviceCache();
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // FASE 3: MOBILE DETECTION ENHANCEMENT
      const urlParams = new URLSearchParams(window.location.search);
      const hasQRParam = urlParams.has('qr') || urlParams.get('qr') === 'true';
      const hasMobileParam = urlParams.has('mobile') || urlParams.get('mobile') === 'true';
      const hasCameraParam = urlParams.get('camera') === 'environment';
      const hasQRAccess = hasQRParam || hasMobileParam || hasCameraParam || 
        sessionStorage.getItem('accessedViaQR') === 'true';
      
      // Enhanced mobile detection
      const basicMobileDetection = detectMobileAggressively();
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileScreen = window.innerWidth <= 768 && window.innerHeight <= 1024;
      const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // CRITICAL: If QR access, bypass strict mobile detection
      const isMobileDevice = hasQRAccess ? true : (basicMobileDetection && hasTouch && (isMobileScreen || mobileUserAgent));
      
      setIsMobile(isMobileDevice);
      
      console.log('🔒 MOBILE GUARD: ENHANCED Detection result:', {
        isMobile: isMobileDevice,
        allowDesktop,
        hasQRAccess,
        hasQRParam,
        hasMobileParam,
        hasCameraParam,
        basicMobileDetection,
        hasTouch,
        isMobileScreen,
        mobileUserAgent,
        userAgent: navigator.userAgent.substring(0, 100),
        touchPoints: navigator.maxTouchPoints,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        finalDecision: isMobileDevice ? 'ALLOW' : 'BLOCK'
      });
      
      // FASE 3: STRICT MOBILE ENFORCEMENT
      if (!isMobileDevice && !allowDesktop) {
        console.log('🚫 MOBILE GUARD: NON-MOBILE DETECTED - BLOCKING ACCESS');
        
        if (showToast) {
          toast.error('🚫 Esta página é exclusiva para dispositivos móveis. Escaneie o QR Code com seu celular para acessar a câmera corretamente.');
        }
        
        // Small delay to show toast before redirect
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 2000);
        
        return;
      }
      
      // If validated as mobile, mark QR access
      if (isMobileDevice && hasQRAccess) {
        sessionStorage.setItem('accessedViaQR', 'true');
        sessionStorage.setItem('mobileValidated', 'true');
        console.log('✅ MOBILE GUARD: QR access validated and stored');
      }
      
      setIsValidated(true);
      console.log('✅ MOBILE GUARD: Mobile validation passed - camera access allowed');
    };

    validateMobileAccess();
  }, [navigate, redirectTo, allowDesktop, showToast, enforceQRAccess]);

  return {
    isMobile,
    isValidated,
    isBlocked: isMobile === false && !allowDesktop
  };
};
