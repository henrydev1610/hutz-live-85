import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export const WebRTCDebugToasts = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Event listeners para logs visuais do WebRTC
    const handleTrackReceived = (event: CustomEvent) => {
      const { participantId, trackKind } = event.detail;
      toast({
        title: "🎵 Track Recebido",
        description: `Track ${trackKind} de ${participantId.substring(0, 8)}`,
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
      
      toast({
        title: `${emoji} Estado WebRTC`,
        description: `${participantId.substring(0, 8)}: ${state}`,
        variant: state === 'failed' ? "destructive" : "default",
        duration: 4000,
      });
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

    // Registrar event listeners existentes
    window.addEventListener('track-received', handleTrackReceived as EventListener);
    window.addEventListener('stream-processed', handleStreamProcessed as EventListener);
    window.addEventListener('stream-callback-executed', handleStreamCallbackExecuted as EventListener);
    window.addEventListener('stream-callback-error', handleStreamCallbackError as EventListener);
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    window.addEventListener('host-stream-received', handleHostStreamReceived as EventListener);
    window.addEventListener('webrtc-callback-executed', handleWebRTCCallbackExecuted as EventListener);
    
    // Registrar novos event listeners
    window.addEventListener('stream-callback-triggered', handleStreamCallback as EventListener);
    window.addEventListener('track-added-to-pc', handleTrackAdded as EventListener);
    window.addEventListener('offer-created', handleOfferCreated as EventListener);
    window.addEventListener('ontrack-timeout', handleOntrackTimeout as EventListener);
    window.addEventListener('stream-missing-error', handleStreamMissing as EventListener);

    // Cleanup existente
    return () => {
      window.removeEventListener('track-received', handleTrackReceived as EventListener);
      window.removeEventListener('stream-processed', handleStreamProcessed as EventListener);
      window.removeEventListener('stream-callback-executed', handleStreamCallbackExecuted as EventListener);
      window.removeEventListener('stream-callback-error', handleStreamCallbackError as EventListener);
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
      window.removeEventListener('host-stream-received', handleHostStreamReceived as EventListener);
      window.removeEventListener('webrtc-callback-executed', handleWebRTCCallbackExecuted as EventListener);
      
      // Novo cleanup
      window.removeEventListener('stream-callback-triggered', handleStreamCallback as EventListener);
      window.removeEventListener('track-added-to-pc', handleTrackAdded as EventListener);
      window.removeEventListener('offer-created', handleOfferCreated as EventListener);
      window.removeEventListener('ontrack-timeout', handleOntrackTimeout as EventListener);
      window.removeEventListener('stream-missing-error', handleStreamMissing as EventListener);
    };
  }, [toast]);

  return null; // Este componente só gerencia event listeners
};