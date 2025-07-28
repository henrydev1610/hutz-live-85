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

    // Registrar event listeners
    window.addEventListener('track-received', handleTrackReceived as EventListener);
    window.addEventListener('stream-processed', handleStreamProcessed as EventListener);
    window.addEventListener('stream-callback-executed', handleStreamCallbackExecuted as EventListener);
    window.addEventListener('stream-callback-error', handleStreamCallbackExecuted as EventListener);
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('track-received', handleTrackReceived as EventListener);
      window.removeEventListener('stream-processed', handleStreamProcessed as EventListener);
      window.removeEventListener('stream-callback-executed', handleStreamCallbackExecuted as EventListener);
      window.removeEventListener('stream-callback-error', handleStreamCallbackExecuted as EventListener);
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange as EventListener);
    };
  }, [toast]);

  return null; // Este componente só gerencia event listeners
};