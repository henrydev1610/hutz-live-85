import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Camera, Mic, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { detectMobile } from '@/utils/media/deviceDetection';

interface MediaDiagnosticsProps {
  isVisible: boolean;
  onRetryMedia: () => Promise<void>;
  hasVideo: boolean;
  hasAudio: boolean;
  stream: MediaStream | null;
}

interface DeviceInfo {
  videoDevices: number;
  audioDevices: number;
  devices: MediaDeviceInfo[];
  permissions: {
    camera: string;
    microphone: string;
  };
}

const MediaDiagnostics: React.FC<MediaDiagnosticsProps> = ({
  isVisible,
  onRetryMedia,
  hasVideo,
  hasAudio,
  stream
}) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    videoDevices: 0,
    audioDevices: 0,
    devices: [],
    permissions: { camera: 'unknown', microphone: 'unknown' }
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const [diagnosticsComplete, setDiagnosticsComplete] = useState(false);

  const runDiagnostics = async () => {
    console.log('🔍 DIAGNOSTICS: Running comprehensive media diagnostics...');
    
    try {
      // Check permissions
      let cameraPermission = 'unknown';
      let micPermission = 'unknown';
      
      try {
        if (navigator.permissions) {
          const cameraQuery = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micQuery = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          cameraPermission = cameraQuery.state;
          micPermission = micQuery.state;
        }
      } catch (error) {
        console.warn('⚠️ DIAGNOSTICS: Permission check failed:', error);
      }

      // Enumerate devices
      let devices: MediaDeviceInfo[] = [];
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          devices = await navigator.mediaDevices.enumerateDevices();
        }
      } catch (error) {
        console.warn('⚠️ DIAGNOSTICS: Device enumeration failed:', error);
      }

      const videoDevices = devices.filter(d => d.kind === 'videoinput').length;
      const audioDevices = devices.filter(d => d.kind === 'audioinput').length;

      setDeviceInfo({
        videoDevices,
        audioDevices,
        devices,
        permissions: {
          camera: cameraPermission,
          microphone: micPermission
        }
      });

      setDiagnosticsComplete(true);
      
      console.log('✅ DIAGNOSTICS: Complete:', {
        videoDevices,
        audioDevices,
        permissions: { camera: cameraPermission, microphone: micPermission },
        isMobile: detectMobile(),
        userAgent: navigator.userAgent,
        protocol: window.location.protocol
      });
      
    } catch (error) {
      console.error('❌ DIAGNOSTICS: Failed:', error);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryMedia();
    } catch (error) {
      console.error('❌ DIAGNOSTICS: Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      runDiagnostics();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const isMobile = detectMobile();
  const hasMediaIssue = !hasVideo && !hasAudio;
  
  return (
    <Card className="mb-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5" />
          Diagnóstico de Mídia
          {diagnosticsComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status atual */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {hasVideo ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Vídeo: {hasVideo ? 'Ativo' : 'Indisponível'}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasAudio ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">Áudio: {hasAudio ? 'Ativo' : 'Indisponível'}</span>
          </div>
        </div>

        {/* Informações do dispositivo */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Dispositivos Detectados:</h4>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={deviceInfo.videoDevices > 0 ? "default" : "destructive"}>
              <Camera className="h-3 w-3 mr-1" />
              Câmeras: {deviceInfo.videoDevices}
            </Badge>
            <Badge variant={deviceInfo.audioDevices > 0 ? "default" : "destructive"}>
              <Mic className="h-3 w-3 mr-1" />
              Microfones: {deviceInfo.audioDevices}
            </Badge>
            <Badge variant="outline">
              {isMobile ? '📱 Mobile' : '🖥️ Desktop'}
            </Badge>
          </div>
        </div>

        {/* Permissões */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Permissões:</h4>
          <div className="flex gap-2 flex-wrap">
            <Badge variant={
              deviceInfo.permissions.camera === 'granted' ? 'default' : 
              deviceInfo.permissions.camera === 'denied' ? 'destructive' : 'secondary'
            }>
              Câmera: {deviceInfo.permissions.camera}
            </Badge>
            <Badge variant={
              deviceInfo.permissions.microphone === 'granted' ? 'default' : 
              deviceInfo.permissions.microphone === 'denied' ? 'destructive' : 'secondary'
            }>
              Microfone: {deviceInfo.permissions.microphone}
            </Badge>
          </div>
        </div>

        {/* Stream info */}
        {stream && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Stream Atual:</h4>
            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <div>ID: {stream.id}</div>
              <div>Ativo: {stream.active ? 'Sim' : 'Não'}</div>
              <div>Tracks: {stream.getTracks().length}</div>
              {stream.getTracks().map((track, i) => (
                <div key={i}>
                  - {track.kind}: {track.label || 'unlabeled'} ({track.readyState})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instruções específicas */}
        {hasMediaIssue && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-medium text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              Instruções para Resolver:
            </h4>
            <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
              {deviceInfo.permissions.camera === 'denied' && (
                <li>• Permita o acesso à câmera nas configurações do navegador</li>
              )}
              {deviceInfo.permissions.microphone === 'denied' && (
                <li>• Permita o acesso ao microfone nas configurações do navegador</li>
              )}
              {deviceInfo.videoDevices === 0 && (
                <li>• Verifique se há uma câmera conectada ao dispositivo</li>
              )}
              {isMobile && (
                <li>• No mobile, use HTTPS e certifique-se de que o navegador seja atualizado</li>
              )}
              <li>• Tente atualizar a página e permitir permissões novamente</li>
              <li>• Feche outros aplicativos que possam estar usando a câmera</li>
            </ul>
          </div>
        )}

        {/* Botão de retry */}
        <Button 
          onClick={handleRetry} 
          disabled={isRetrying}
          className="w-full"
          variant={hasMediaIssue ? "destructive" : "default"}
        >
          {isRetrying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Tentando Reconectar...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Reconectar Mídia
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MediaDiagnostics;