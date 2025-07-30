import { useEffect } from 'react';

interface UseAutoHandshakeProps {
  isHost: boolean;
  sessionId: string | null;
  onHandshakeRequest: (participantId: string) => void;
}

export const useAutoHandshake = ({
  isHost,
  sessionId,
  onHandshakeRequest
}: UseAutoHandshakeProps) => {
  
  useEffect(() => {
    if (!isHost || !sessionId) return;

    const handleAutoHandshake = (event: CustomEvent) => {
      const { participantId, streamInfo } = event.detail;
      console.log('🤝 AUTO-HANDSHAKE: Recebendo solicitação para', participantId);
      
      // Chamar callback para iniciar handshake
      onHandshakeRequest(participantId);
    };

    // Escutar evento de auto-handshake
    window.addEventListener('auto-handshake-request', handleAutoHandshake as EventListener);
    
    console.log('🎯 AUTO-HANDSHAKE: Listener registrado para host');

    return () => {
      window.removeEventListener('auto-handshake-request', handleAutoHandshake as EventListener);
      console.log('🧹 AUTO-HANDSHAKE: Listener removido');
    };
  }, [isHost, sessionId, onHandshakeRequest]);
};