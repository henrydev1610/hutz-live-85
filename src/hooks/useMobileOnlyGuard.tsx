
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { detectMobileAggressively, clearDeviceCache } from '@/utils/media/deviceDetection';

interface MobileGuardOptions {
  redirectTo?: string;
  allowDesktop?: boolean;
  showToast?: boolean;
}

export const useMobileOnlyGuard = (options: MobileGuardOptions = {}) => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  
  const {
    redirectTo = '/',
    allowDesktop = false,
    showToast = true
  } = options;

  useEffect(() => {
    const validateMobileAccess = async () => {
      console.log('🔒 MOBILE GUARD: Starting validation');
      
      // Clear device cache for fresh detection
      clearDeviceCache();
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Aggressive mobile detection
      const isMobileDevice = detectMobileAggressively();
      setIsMobile(isMobileDevice);
      
      console.log('🔒 MOBILE GUARD: Detection result:', {
        isMobile: isMobileDevice,
        allowDesktop,
        userAgent: navigator.userAgent,
        touchPoints: navigator.maxTouchPoints,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        hasQRParam: new URLSearchParams(window.location.search).has('qr'),
        hasTouch: 'ontouchstart' in window
      });
      
      if (!isMobileDevice && !allowDesktop) {
        console.log('🚫 MOBILE GUARD: Desktop detected on mobile-only page, redirecting');
        
        if (showToast) {
          toast.error('🚫 Esta página é apenas para dispositivos móveis. Escaneie o QR Code com seu celular.');
        }
        
        // Small delay to show toast before redirect
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1500);
        
        return;
      }
      
      setIsValidated(true);
      console.log('✅ MOBILE GUARD: Validation passed');
    };

    validateMobileAccess();
  }, [navigate, redirectTo, allowDesktop, showToast]);

  return {
    isMobile,
    isValidated,
    isBlocked: isMobile === false && !allowDesktop
  };
};
