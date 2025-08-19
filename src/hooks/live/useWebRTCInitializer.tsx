import { useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
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
    if (!sessionId || initializationRef.current) return;

    const initializeWebRTC = async () => {
      try {
        initializationRef.current = true;
        console.log('🚀 WEBRTC INITIALIZER: Forçando inicialização completa');
        console.log('🚀 WEBRTC INITIALIZER: SessionId:', sessionId);

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
        console.error('❌ WEBRTC INITIALIZER: Erro na inicialização:', error);
        initializationRef.current = false;
        
        toast({
          title: "Erro WebRTC",
          description: "Falha na inicialização do WebRTC. Tentando novamente...",
          variant: "destructive",
        });

        // Retry after 3 seconds
        setTimeout(() => {
          initializationRef.current = false;
        }, 3000);
      }
    };

    initializeWebRTC();

    return () => {
      console.log('🧹 WEBRTC INITIALIZER: Cleanup');
    };
  }, [sessionId, onWebRTCReady, toast]);

  return {
    isInitialized: initializationRef.current
  };
};