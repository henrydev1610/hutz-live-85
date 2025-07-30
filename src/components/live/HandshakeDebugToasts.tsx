import React, { useEffect } from 'react';
import { toast } from 'sonner';

const HandshakeDebugToasts: React.FC = () => {
  useEffect(() => {
    // Eventos de progresso do handshake
    const handleOfferCreated = (event: CustomEvent) => {
      const { participantId, senderCount } = event.detail;
      toast.success(`🚀 Oferta criada para ${participantId} (${senderCount} tracks)`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleOfferReceived = (event: CustomEvent) => {
      const { participantId, offerType } = event.detail;
      toast.info(`📥 Oferta recebida de ${participantId} (${offerType})`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleAnswerCreated = (event: CustomEvent) => {
      const { participantId, answerType } = event.detail;
      toast.success(`📝 Resposta criada para ${participantId} (${answerType})`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleAnswerReceived = (event: CustomEvent) => {
      const { participantId, answerType } = event.detail;
      toast.info(`📥 Resposta recebida de ${participantId} (${answerType})`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleAnswerSent = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast.success(`📤 Resposta enviada para ${participantId}`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleWebRTCStateChange = (event: CustomEvent) => {
      const { participantId, state } = event.detail;
      let message = '';
      let toastType = 'info' as 'success' | 'error' | 'info';
      
      switch (state) {
        case 'connected':
          message = `✅ WebRTC CONECTADO: ${participantId}`;
          toastType = 'success';
          break;
        case 'connecting':
          message = `🔄 WebRTC conectando: ${participantId}`;
          toastType = 'info';
          break;
        case 'failed':
          message = `❌ WebRTC falhou: ${participantId}`;
          toastType = 'error';
          break;
        case 'disconnected':
          message = `🔌 WebRTC desconectado: ${participantId}`;
          toastType = 'info';
          break;
        default:
          message = `🔄 WebRTC ${state}: ${participantId}`;
          toastType = 'info';
      }
      
      if (toastType === 'success') {
        toast.success(message, { duration: 5000, position: 'top-right' });
      } else if (toastType === 'error') {
        toast.error(message, { duration: 5000, position: 'top-right' });
      } else {
        toast.info(message, { duration: 3000, position: 'top-right' });
      }
    };

    const handleHandshakeComplete = (event: CustomEvent) => {
      const { participantId, phase } = event.detail;
      toast.success(`🎉 HANDSHAKE COMPLETO: ${participantId} (${phase})`, {
        duration: 5000,
        position: 'top-right'
      });
    };

    const handleHandshakeError = (event: CustomEvent) => {
      const { participantId, error, phase } = event.detail;
      toast.error(`❌ ERRO HANDSHAKE: ${participantId} - ${error} (${phase})`, {
        duration: 8000,
        position: 'top-right'
      });
    };

    const handleOfferProcessedSuccessfully = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast.success(`✅ Oferta processada: ${participantId}`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleAnswerProcessedSuccessfully = (event: CustomEvent) => {
      const { participantId } = event.detail;
      toast.success(`✅ Resposta processada: ${participantId}`, {
        duration: 3000,
        position: 'top-right'
      });
    };

    const handleIceCandidateError = (event: CustomEvent) => {
      const { participantId, error } = event.detail;
      toast.error(`❌ Erro ICE: ${participantId} - ${error}`, {
        duration: 5000,
        position: 'top-right'
      });
    };

    // Registrar todos os event listeners
    window.addEventListener('offer-created', handleOfferCreated);
    window.addEventListener('offer-received', handleOfferReceived);
    window.addEventListener('answer-created', handleAnswerCreated);
    window.addEventListener('answer-received', handleAnswerReceived);
    window.addEventListener('answer-sent', handleAnswerSent);
    window.addEventListener('webrtc-state-change', handleWebRTCStateChange);
    window.addEventListener('handshake-complete', handleHandshakeComplete);
    window.addEventListener('handshake-error', handleHandshakeError);
    window.addEventListener('offer-processed-successfully', handleOfferProcessedSuccessfully);
    window.addEventListener('answer-processed-successfully', handleAnswerProcessedSuccessfully);
    window.addEventListener('ice-candidate-error', handleIceCandidateError);

    return () => {
      // Cleanup todos os event listeners
      window.removeEventListener('offer-created', handleOfferCreated);
      window.removeEventListener('offer-received', handleOfferReceived);
      window.removeEventListener('answer-created', handleAnswerCreated);
      window.removeEventListener('answer-received', handleAnswerReceived);
      window.removeEventListener('answer-sent', handleAnswerSent);
      window.removeEventListener('webrtc-state-change', handleWebRTCStateChange);
      window.removeEventListener('handshake-complete', handleHandshakeComplete);
      window.removeEventListener('handshake-error', handleHandshakeError);
      window.removeEventListener('offer-processed-successfully', handleOfferProcessedSuccessfully);
      window.removeEventListener('answer-processed-successfully', handleAnswerProcessedSuccessfully);
      window.removeEventListener('ice-candidate-error', handleIceCandidateError);
    };
  }, []);

  return null; // Componente invisível, apenas para escutar eventos
};

export default HandshakeDebugToasts;