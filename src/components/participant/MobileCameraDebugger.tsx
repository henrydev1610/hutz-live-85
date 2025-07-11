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
    const updateDebugInfo = async () => {
      const isMobile = /Android|iPhone|iPad|iPod|Mobile Safari|Mobile|Mobi/i.test(navigator.userAgent);
      const hasTouch = 'ontouchstart' in window;
      const urlParams = new URLSearchParams(window.location.search);
      const isQRAccess = urlParams.has('qr') || urlParams.has('mobile') || sessionStorage.getItem('accessedViaQR') === 'true';
      
      let streamInfo = { hasVideo: false, hasAudio: false, videoLabel: '', cameraType: 'unknown', facingMode: 'unknown' };
      let permissionInfo = { camera: 'unknown', microphone: 'unknown' };
      let deviceInfo = { videoInputs: 0, audioInputs: 0, backCamera: null, frontCamera: null };
      
      // 🔐 ENHANCED: Check permissions with better info
      try {
        if (navigator.permissions) {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          permissionInfo = {
            camera: cameraPermission.state,
            microphone: micPermission.state
          };
        }
      } catch (permError) {
        console.warn('Debug: Could not check permissions', permError);
      }
      
      // 📱 ENHANCED: Get device enumeration info
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          
          const backCamera = videoInputs.find(d => /back|rear|environment/i.test(d.label || ''));
          const frontCamera = videoInputs.find(d => /front|user|selfie/i.test(d.label || ''));
          
          deviceInfo = {
            videoInputs: videoInputs.length,
            audioInputs: audioInputs.length,
            backCamera: backCamera ? { label: backCamera.label || 'Unlabeled', id: backCamera.deviceId } : null,
            frontCamera: frontCamera ? { label: frontCamera.label || 'Unlabeled', id: frontCamera.deviceId } : null
          };
        }
      } catch (deviceError) {
        console.warn('Debug: Could not enumerate devices', deviceError);
      }
      
      // 🎯 ENHANCED: Get stream info with facingMode details
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];
          const settings = videoTrack.getSettings();
          
          streamInfo = {
            hasVideo: true,
            hasAudio: audioTracks.length > 0,
            videoLabel: videoTrack.label || 'Unknown',
            facingMode: settings.facingMode || 'unknown',
            cameraType: settings.facingMode === 'environment' ? '🎯 BACK' :
                       settings.facingMode === 'user' ? '👤 FRONT' :
                       videoTrack.label?.toLowerCase().includes('back') || 
                       videoTrack.label?.toLowerCase().includes('environment') ? '🎯 BACK' :
                       videoTrack.label?.toLowerCase().includes('front') || 
                       videoTrack.label?.toLowerCase().includes('user') ? '👤 FRONT' : '❓ UNKNOWN'
          };
        } else {
          streamInfo = {
            hasVideo: false,
            hasAudio: audioTracks.length > 0,
            videoLabel: 'No video track',
            facingMode: 'none',
            cameraType: 'none'
          };
        }
      }

      setDebugInfo({
        userAgent: navigator.userAgent,
        isMobile,
        hasTouch,
        isQRAccess,
        isHTTPS: window.location.protocol === 'https:',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        streamInfo,
        permissionInfo,
        deviceInfo,
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
          
          {/* 🔒 HTTPS Status */}
          <div className="flex items-center gap-2 ml-5 text-xs">
            {debugInfo.isHTTPS ? (
              <CheckCircle className="h-3 w-3 text-green-400" />
            ) : (
              <XCircle className="h-3 w-3 text-red-400" />
            )}
            <span>HTTPS: {debugInfo.isHTTPS ? 'SECURE' : 'INSECURE (Required for mobile)'}</span>
          </div>
          
          {/* 🔐 Enhanced permission info */}
          {debugInfo.permissionInfo && (
            <div className="text-gray-300 ml-5 text-xs">
              <div className="flex items-center gap-1">
                <span>Permissions:</span>
                <Badge variant={debugInfo.permissionInfo.camera === 'granted' ? 'default' : 'destructive'} className="text-xs">
                  📷 {debugInfo.permissionInfo.camera}
                </Badge>
                <Badge variant={debugInfo.permissionInfo.microphone === 'granted' ? 'default' : 'secondary'} className="text-xs">
                  🎤 {debugInfo.permissionInfo.microphone}
                </Badge>
              </div>
            </div>
          )}
          
          {/* 📱 Device enumeration info */}
          {debugInfo.deviceInfo && (
            <div className="text-gray-300 ml-5 text-xs space-y-1">
              <div>Devices: 📷 {debugInfo.deviceInfo.videoInputs} | 🎤 {debugInfo.deviceInfo.audioInputs}</div>
              {debugInfo.deviceInfo.backCamera && (
                <div className="text-green-300">🎯 Back: {debugInfo.deviceInfo.backCamera.label}</div>
              )}
              {debugInfo.deviceInfo.frontCamera && (
                <div className="text-blue-300">👤 Front: {debugInfo.deviceInfo.frontCamera.label}</div>
              )}
              {!debugInfo.deviceInfo.backCamera && !debugInfo.deviceInfo.frontCamera && debugInfo.deviceInfo.videoInputs > 0 && (
                <div className="text-yellow-300">⚠️ No labeled cameras found</div>
              )}
            </div>
          )}
          
          {/* 🎯 Active camera info */}
          {debugInfo.streamInfo?.hasVideo && (
            <div className="text-gray-300 ml-5 text-xs space-y-1">
              <div className="font-semibold">Active Camera: {debugInfo.streamInfo.cameraType}</div>
              <div>FacingMode: {debugInfo.streamInfo.facingMode}</div>
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