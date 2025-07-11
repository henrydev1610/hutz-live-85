import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, CameraOff, AlertTriangle, RefreshCw, Smartphone, Monitor } from "lucide-react";
import { detectMobileAggressively, forceDeviceType } from '@/utils/media/deviceDetection';

interface MobileCameraDebuggerProps {
  localStream?: MediaStream | null;
  onForceRetry?: () => Promise<void>;
  isVisible?: boolean;
}

export const MobileCameraDebugger: React.FC<MobileCameraDebuggerProps> = ({
  localStream,
  onForceRetry,
  isVisible = false
}) => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDesktopAlert, setShowDesktopAlert] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const videoTrack = videoTracks[0];
        const settings = videoTrack.getSettings();
        const isMobile = detectMobileAggressively();
        
        setDebugInfo({
          trackLabel: videoTrack.label,
          deviceId: settings.deviceId,
          facingMode: settings.facingMode,
          width: settings.width,
          height: settings.height,
          isMobile,
          isDesktopCameraOnMobile: isMobile && !settings.facingMode
        });

        // Show alert if desktop camera detected on mobile
        if (isMobile && !settings.facingMode) {
          setShowDesktopAlert(true);
        }
      }
    }
  }, [localStream]);

  useEffect(() => {
    // Listen for desktop camera detected events
    const handleDesktopCameraDetected = (event: CustomEvent) => {
      console.error('🚨 DESKTOP CAMERA DETECTED ON MOBILE:', event.detail);
      setShowDesktopAlert(true);
    };

    window.addEventListener('mobileDesktopCameraDetected' as any, handleDesktopCameraDetected);
    
    return () => {
      window.removeEventListener('mobileDesktopCameraDetected' as any, handleDesktopCameraDetected);
    };
  }, []);

  const handleForceRetry = async () => {
    if (!onForceRetry) return;
    
    setIsRetrying(true);
    try {
      await onForceRetry();
      setShowDesktopAlert(false);
    } catch (error) {
      console.error('Force retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleForceMobile = () => {
    forceDeviceType('mobile');
    window.location.reload();
  };

  if (!isVisible && !showDesktopAlert && !debugInfo?.isDesktopCameraOnMobile) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Desktop Camera Alert */}
      {showDesktopAlert && (
        <Alert className="bg-red-900/20 border-red-500/50 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <strong>Câmera Desktop Detectada!</strong>
              <br />
              Foi detectada uma câmera de desktop em um dispositivo móvel. 
              Isso pode indicar que você está acessando de um computador ou que a câmera móvel não foi ativada corretamente.
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleForceRetry}
                disabled={isRetrying}
                size="sm" 
                variant="destructive"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Tentando...
                  </>
                ) : (
                  <>
                    <Camera className="h-3 w-3 mr-1" />
                    Forçar Câmera Móvel
                  </>
                )}
              </Button>
              <Button 
                onClick={handleForceMobile}
                size="sm" 
                variant="outline"
                className="bg-orange-900/20 border-orange-500/50 text-orange-100"
              >
                <Smartphone className="h-3 w-3 mr-1" />
                Forçar Modo Móvel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Debug Info Card */}
      {debugInfo && isVisible && (
        <Card className="bg-black/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Debug da Câmera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-white/70">Dispositivo:</div>
              <div className="text-white flex items-center gap-1">
                {debugInfo.isMobile ? (
                  <>
                    <Smartphone className="h-3 w-3" />
                    Móvel
                  </>
                ) : (
                  <>
                    <Monitor className="h-3 w-3" />
                    Desktop
                  </>
                )}
              </div>
              
              <div className="text-white/70">FacingMode:</div>
              <div className="text-white">
                {debugInfo.facingMode ? (
                  <Badge variant="default" className="text-xs">
                    {debugInfo.facingMode}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    Ausente
                  </Badge>
                )}
              </div>
              
              <div className="text-white/70">Resolução:</div>
              <div className="text-white">
                {debugInfo.width}x{debugInfo.height}
              </div>
              
              <div className="text-white/70">Câmera:</div>
              <div className="text-white">
                {debugInfo.isDesktopCameraOnMobile ? (
                  <Badge variant="destructive" className="text-xs">
                    <CameraOff className="h-3 w-3 mr-1" />
                    Desktop no Móvel
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs">
                    <Camera className="h-3 w-3 mr-1" />
                    Correto
                  </Badge>
                )}
              </div>
            </div>
            
            {debugInfo.trackLabel && (
              <div className="text-xs text-white/50 truncate">
                Label: {debugInfo.trackLabel}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};