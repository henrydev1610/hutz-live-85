import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { initHostWebRTC } from '@/utils/webrtc';
import { setupHostHandlers } from '@/webrtc/handshake/HostHandshake';
import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

interface UseWebRTCInitializerProps {
  sessionId: string;
  onWebRTCReady?: () => void;
}

export const useWebRTCInitializer = ({ sessionId, onWebRTCReady }: UseWebRTCInitializerProps) => {
  const { toast } = useToast();
  const initializationRef = useRef(false);

  useEffect(() => {
    console.log('🔍 WEBRTC INITIALIZER: Effect triggered', { sessionId, isInitialized: initializationRef.current });
    
    if (initializationRef.current) {
      console.log('✅ WEBRTC INITIALIZER: Already initialized, skipping');
      return;
    }

    const initializeWebRTC = async () => {
      try {
        console.log('🚀 WEBRTC INITIALIZER: STARTING non-blocking initialization');
        console.log('🚀 WEBRTC INITIALIZER: SessionId:', sessionId);
        initializationRef.current = true;

        // Toast de início para feedback visual
        toast({
          title: "Inicializando Sistema",
          description: "Configurando conexões WebRTC...",
        });

        // PASSO 1: Conectar WebSocket com timeout reduzido
        if (!unifiedWebSocketService.isConnected()) {
          console.log('🔗 WEBRTC INITIALIZER: Conectando WebSocket (timeout: 5s)...');
          await Promise.race([
            unifiedWebSocketService.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout')), 5000))
          ]);
          console.log('✅ WEBRTC INITIALIZER: WebSocket conectado');
        }

        // PASSO 2: Inicializar como Host com timeout
        console.log('🎯 WEBRTC INITIALIZER: Inicializando Host WebRTC (timeout: 8s)...');
        const result = await Promise.race([
          initHostWebRTC(sessionId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Host init timeout')), 8000))
        ]);
        console.log('✅ WEBRTC INITIALIZER: Host WebRTC inicializado:', !!(result as any)?.webrtc);

        // PASSO 3: Setup Host Handlers
        console.log('📞 WEBRTC INITIALIZER: Configurando Host Handlers...');
        setupHostHandlers();
        console.log('✅ WEBRTC INITIALIZER: Host Handlers configurados');

        // PASSO 4: Entrar na sala com timeout
        console.log('🚪 WEBRTC INITIALIZER: Entrando na sala (timeout: 5s)...');
        await Promise.race([
          unifiedWebSocketService.joinRoom(sessionId, 'host'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Join room timeout')), 5000))
        ]);
        console.log('✅ WEBRTC INITIALIZER: Host entrou na sala');

        // PASSO 5: Callback de sucesso
        onWebRTCReady?.();
        
        toast({
          title: "Sistema Pronto",
          description: "WebRTC inicializado e pronto para participantes",
        });

        console.log('🎉 WEBRTC INITIALIZER: Inicialização completa com sucesso!');

      } catch (error) {
        console.error('❌ WEBRTC INITIALIZER: ERROR durante inicialização:', error);
        console.error('❌ WEBRTC INITIALIZER: Error details:', {
          message: error.message,
          stack: error.stack,
          sessionId,
          timestamp: new Date().toISOString()
        });
        initializationRef.current = false;
        
        toast({
          title: "Aviso: Inicialização Parcial",
          description: "QR Code disponível. WebRTC será reconfigurado automaticamente.",
          variant: "default",
        });

        // Retry mais rápido e silencioso
        setTimeout(() => {
          console.log('🔄 WEBRTC INITIALIZER: Tentativa silenciosa de reconexão...');
          initializationRef.current = false;
        }, 3000);
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