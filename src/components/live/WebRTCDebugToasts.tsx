import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

// CORREÇÃO: Debounce para toasts para evitar spam
const toastDebounce = new Map<string, number>();
const TOAST_DEBOUNCE_TIME = 3000; // 3s entre toasts similares

export const WebRTCDebugToasts = () => {
  const { toast } = useToast();

  const showDebouncedToast = (key: string, title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    const now = Date.now();
    const lastShown = toastDebounce.get(key) || 0;
    
    if (now - lastShown > TOAST_DEBOUNCE_TIME) {
      toast({ 
        title,
        description,
        variant,
        duration: 2000 // Toasts mais curtos
      });
      toastDebounce.set(key, now);
    }
  };

  useEffect(() => {
    // FASE 6: CRÍTICO - Logs visuais detalhados do fluxo WebRTC
    
    // Handle participant join events
    const handleParticipantJoined = (event: CustomEvent) => {
      const { participantId } = event.detail;
      showDebouncedToast(
        `participant-joined-${participantId}`,
        "👤 PARTICIPANTE CONECTADO",
        `${participantId} se conectou via WebSocket`
      );
    };
    
    // Handle stream started events
    const handleStreamStarted = (event: CustomEvent) => {
      const { participantId, streamInfo } = event.detail;
      toast({
        title: "🎥 STREAM INICIADO",
        description: `${participantId}: Video: ${streamInfo?.hasVideo ? '✅' : '❌'}, Audio: ${streamInfo?.hasAudio ? '✅' : '❌'}`,
        duration: 3000,
      });
    };
    
    // Handle track received events
    const handleTrackReceived = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast({
        title: "🎵 TRACK RECEBIDO",
        description: `Stream chegou ao host via WebRTC de ${participantId.substring(0, 8)}`,
        duration: 3000,
      });
    };

    const handleStreamProcessed = (event: CustomEvent) => {
      const { participantId, streamId, trackCount } = event.detail;
      toast({
        title: "📹 Stream Processado",
        description: `Stream ${streamId.substring(0, 8)} com ${trackCount} tracks`,
        duration: 3000,
      });
    };

    const handleStreamCallbackExecuted = (event: CustomEvent) => {
      const { participantId, success } = event.detail;
      toast({
        title: success ? "✅ Callback Executado" : "❌ Callback Falhou",
        description: `Callback para ${participantId.substring(0, 8)} ${success ? 'executado' : 'falhou'}`,
        variant: success ? "default" : "destructive",
        duration: 3000,
      });
    };

    const handleStreamCallbackError = (event: CustomEvent) => {
      const { participantId, error } = event.detail;
      toast({
        title: "❌ Erro no Callback",
        description: `Falha para ${participantId.substring(0, 8)}: ${error}`,
        variant: "destructive",
        duration: 4000,
      });
    };

    // Handler para callback WebRTC executado no host
    const handleHostStreamReceived = (event: CustomEvent) => {
      const { participantId, streamId, trackCount } = event.detail;
      toast({
        title: "🖥️ Host Recebeu Stream",
        description: `${participantId.substring(0, 8)} com ${trackCount} tracks`,
        duration: 3000,
      });
    };

    // Handler para callback WebRTC executado
    const handleWebRTCCallbackExecuted = (event: CustomEvent) => {
      const { participantId, streamId, trackCount } = event.detail;
      toast({
        title: "🔄 WebRTC Callback",
        description: `Processando ${participantId.substring(0, 8)} - ${trackCount} tracks`,
        duration: 3000,
      });
    };

    const handleWebRTCStateChange = (event: CustomEvent) => {
      const { participantId, state } = event.detail;
      let emoji = "🔄";
      if (state === 'connected') emoji = "✅";
      if (state === 'failed') emoji = "❌";
      if (state === 'connecting') emoji = "🔗";
      
      showDebouncedToast(
        `webrtc-state-${participantId}-${state}`,
        `${emoji} Estado WebRTC`,
        `${participantId.substring(0, 8)}: ${state}`,
        state === 'failed' ? "destructive" : "default"
      );
    };

    // NOVOS HANDLERS PARA DEBUG DETALHADO
    const handleStreamCallback = (event: CustomEvent) => {
      const { participantId, streamId, trackCount } = event.detail;
      toast({
        title: "🚀 Stream Callback Disparado",
        description: `${participantId.substring(0, 8)} - ${trackCount} tracks`,
      });
    };

    const handleTrackAdded = (event: CustomEvent) => {
      const { participantId, trackKind } = event.detail;
      toast({
        title: "➕ Track Adicionada",
        description: `${trackKind} para ${participantId.substring(0, 8)}`,
      });
    };

    const handleOfferCreated = (event: CustomEvent) => {
      const { participantId, senderCount } = event.detail;
      toast({
        title: "📋 Oferta Criada",
        description: `${participantId.substring(0, 8)} - ${senderCount} senders`,
      });
    };

    const handleOntrackTimeout = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast({
        title: "⏰ Timeout OnTrack",
        description: `${participantId.substring(0, 8)} - stream não recebido em 5s`,
        variant: "destructive"
      });
    };

    const handleStreamMissing = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast({
        title: "❌ Stream Não Encontrado",
        description: `${participantId.substring(0, 8)} - localStream ausente`,
        variant: "destructive"
      });
    };

    // CORREÇÃO: Reduzir event listeners para evitar spam
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    // Outros eventos removidos para reduzir logs excessivos

    // CORREÇÃO: Cleanup simplificado
    return () => {
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    };
  }, [toast]);

  return null; // Este componente só gerencia event listeners
};