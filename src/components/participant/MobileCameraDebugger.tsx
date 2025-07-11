import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Smartphone,
  Monitor,
  EyeOff,
  Bug
} from "lucide-react";
import { toast } from "sonner";

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
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isDebugVisible, setIsDebugVisible] = useState(isVisible);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const updateDebugInfo = () => {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile Safari|Mobile|Mobi/i.test(navigator.userAgent);
      const hasTouch = 'ontouchstart' in window;
      const urlParams = new URLSearchParams(window.location.search);
      const isQRAccess = urlParams.has('qr') || urlParams.has('mobile') || sessionStorage.getItem('accessedViaQR') === 'true';
      
      let streamInfo = { hasVideo: false, hasAudio: false, videoLabel: '', cameraType: 'unknown' };
      
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        
        streamInfo = {
          hasVideo: videoTracks.length > 0,
          hasAudio: audioTracks.length > 0,
          videoLabel: videoTracks[0]?.label || 'Unknown',
          cameraType: videoTracks[0]?.label?.toLowerCase().includes('front') || 
                     videoTracks[0]?.label?.toLowerCase().includes('user') ? 'front' :
                     videoTracks[0]?.label?.toLowerCase().includes('back') || 
                     videoTracks[0]?.label?.toLowerCase().includes('environment') ? 'back' : 'unknown'
        };
      }

      setDebugInfo({
        userAgent: navigator.userAgent,
        isMobile,
        hasTouch,
        isQRAccess,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        streamInfo,
        retryCount,
        lastError
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  }, [localStream, retryCount, lastError]);

  const handleForceRetry = async () => {
    if (!onForceRetry || isRetrying) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    setLastError(null);
    
    try {
      toast.info(`Retry ${retryCount + 1} - Getting ${debugInfo.isMobile ? 'mobile' : 'desktop'} camera...`);
      await onForceRetry();
      toast.success('Camera retry completed!');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setLastError(errorMsg);
      toast.error(`Retry failed: ${errorMsg}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const toggleDebugVisibility = () => {
    setIsDebugVisible(!isDebugVisible);
  };

  if (!isDebugVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleDebugVisibility}
        className="fixed top-4 right-4 z-50 bg-black/50 text-white hover:bg-black/70"
      >
        <Bug className="h-4 w-4" />
      </Button>
    );
  }

  const getStatusColor = () => {
    if (lastError) return 'destructive';
    if (debugInfo.streamInfo?.hasVideo) return 'default';
    return 'destructive';
  };

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 max-h-96 overflow-y-auto bg-black/90 text-white border-white/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Camera Debug
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={toggleDebugVisibility}>
            <EyeOff className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant={debugInfo.isMobile ? 'default' : 'secondary'}>
            {debugInfo.isMobile ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
            {debugInfo.isMobile ? 'MOBILE' : 'DESKTOP'}
          </Badge>
          <Badge variant={debugInfo.isQRAccess ? 'default' : 'secondary'}>
            {debugInfo.isQRAccess ? 'QR' : 'Direct'}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {debugInfo.streamInfo?.hasVideo ? (
              <CheckCircle className="h-3 w-3 text-green-400" />
            ) : (
              <XCircle className="h-3 w-3 text-red-400" />
            )}
            <span>Camera: {debugInfo.streamInfo?.hasVideo ? 'ACTIVE' : 'NOT FOUND'}</span>
          </div>
          
          {debugInfo.streamInfo?.hasVideo && (
            <div className="text-gray-300 ml-5">
              <div>Type: {debugInfo.streamInfo.cameraType}</div>
              <div className="truncate">Device: {debugInfo.streamInfo.videoLabel}</div>
            </div>
          )}
        </div>

        {lastError && (
          <div className="bg-red-900/50 p-2 rounded text-red-200">
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-semibold">Error:</span>
            </div>
            <div className="text-xs mt-1">{lastError}</div>
          </div>
        )}

        <div className="flex gap-2">
          {onForceRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleForceRetry}
              disabled={isRetrying}
              className="text-xs"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              Retry {retryCount > 0 && `(${retryCount})`}
            </Button>
          )}
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-gray-400">Device Info</summary>
          <div className="mt-2 space-y-1 text-gray-300">
            <div>UA: {debugInfo.userAgent?.substring(0, 40)}...</div>
            <div>Viewport: {debugInfo.viewport}</div>
            <div>Touch: {debugInfo.hasTouch ? 'Yes' : 'No'}</div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
};