import { useEffect, useRef, useState } from 'react';
import { toast } from "sonner";

export const useMobileCameraForcer = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [hasStream, setHasStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 1. Detectar se é mobile
    const detectMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsMobile(detectMobile);

    if (detectMobile) {
      console.log('📱 MOBILE DETECTED: Forcing camera initialization');
      initializeMobileCamera();
    }

    return () => {
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initializeMobileCamera = async () => {
    try {
      console.log('🎬 MOBILE CAMERA: Starting forced initialization');
      
      // 2. Ativar imediatamente a câmera traseira
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Câmera traseira
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      console.log('✅ MOBILE CAMERA: Stream obtained successfully');
      
      streamRef.current = stream;
      setHasStream(true);
      setError(null);

      // 3. Exibir o vídeo localmente no celular
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('📺 MOBILE CAMERA: Video element connected');
      }

      toast.success('📱 Câmera móvel ativada com sucesso!');

    } catch (error) {
      console.error('❌ MOBILE CAMERA: Failed to initialize:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMsg);
      toast.error(`Erro ao ativar câmera: ${errorMsg}`);
    }
  };

  const retryCamera = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setHasStream(false);
    }
    await initializeMobileCamera();
  };

  return {
    isMobile,
    hasStream,
    error,
    stream: streamRef.current,
    videoRef,
    retryCamera
  };
};