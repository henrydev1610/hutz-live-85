import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { initHostWebRTC } from '@/utils/webrtc';
import { setupHostHandlers } from '@/webrtc/handshake/HostHandshake';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface UseWebRTCInitializerProps {
  sessionId: string | null;
  onWebRTCReady?: () => void;
}

export const useWebRTCInitializer = ({ sessionId, onWebRTCReady }: UseWebRTCInitializerProps) => {
  const { toast } = useToast();
  const initializationRef = useRef(false);

  useEffect(() => {
    console.log('🔍 WEBRTC INITIALIZER: Effect triggered', { sessionId, isInitialized: initializationRef.current });
    
    if (!sessionId) {
      console.warn('⚠️ WEBRTC INITIALIZER: SessionId is null/undefined, skipping initialization');
      return;
    }
    
    if (initializationRef.current) {
      console.log('✅ WEBRTC INITIALIZER: Already initialized, skipping');
      return;
    }

    const initializeWebRTC = async () => {
      try {
        console.log('🚀 WEBRTC INITIALIZER: STARTING initialization process');
        console.log('🚀 WEBRTC INITIALIZER: SessionId:', sessionId);
        initializationRef.current = true;

        // PASSO 1: Conectar WebSocket primeiro
        if (!unifiedWebSocketService.isConnected()) {
          console.log('🔗 WEBRTC INITIALIZER: Conectando WebSocket...');
          await unifiedWebSocketService.connect();
          console.log('✅ WEBRTC INITIALIZER: WebSocket conectado');
        }

        // PASSO 2: Inicializar como Host
        console.log('🎯 WEBRTC INITIALIZER: Inicializando Host WebRTC...');
        const result = await initHostWebRTC(sessionId);
        console.log('✅ WEBRTC INITIALIZER: Host WebRTC inicializado:', !!result.webrtc);

        // PASSO 3: Setup Host Handlers
        console.log('📞 WEBRTC INITIALIZER: Configurando Host Handlers...');
        setupHostHandlers();
        console.log('✅ WEBRTC INITIALIZER: Host Handlers configurados');

        // PASSO 4: Entrar na sala
        console.log('🚪 WEBRTC INITIALIZER: Entrando na sala...');
        await unifiedWebSocketService.joinRoom(sessionId, 'host');
        console.log('✅ WEBRTC INITIALIZER: Host entrou na sala');

        // PASSO 5: Callback de sucesso
        onWebRTCReady?.();
        
        toast({
          title: "WebRTC Inicializado",
          description: "Sistema WebRTC conectado e pronto para receber participantes",
        });

        console.log('🎉 WEBRTC INITIALIZER: Inicialização completa com sucesso!');

      } catch (error) {
        console.error('❌ WEBRTC INITIALIZER: CRITICAL ERROR during initialization:', error);
        console.error('❌ WEBRTC INITIALIZER: Error details:', {
          message: error.message,
          stack: error.stack,
          sessionId,
          timestamp: new Date().toISOString()
        });
        initializationRef.current = false;
        
        toast({
          title: "Erro WebRTC",
          description: `Falha na inicialização: ${error.message}`,
          variant: "destructive",
        });

        // Retry after 5 seconds with more robust retry
        setTimeout(() => {
          console.log('🔄 WEBRTC INITIALIZER: Retrying initialization after error...');
          initializationRef.current = false;
        }, 5000);
      }
    };

    console.log('🚀 WEBRTC INITIALIZER: Calling initializeWebRTC function...');
    initializeWebRTC().catch(error => {
      console.error('❌ WEBRTC INITIALIZER: Unhandled error in initialization:', error);
    });

    return () => {
      console.log('🧹 WEBRTC INITIALIZER: Cleanup - resetting initialization flag');
      initializationRef.current = false;
    };
  }, [sessionId, onWebRTCReady, toast]);

  return {
    isInitialized: initializationRef.current
  };
};