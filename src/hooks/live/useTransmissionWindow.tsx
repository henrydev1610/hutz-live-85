import { useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";

export const useTransmissionWindow = () => {
  const { toast } = useToast();
  const transmissionWindowRef = useRef<Window | null>(null);

  const openTransmissionWindow = (state: any, updateTransmissionParticipants: () => void) => {
    console.log('🎬 HOST: Tentando abrir janela de transmissão');
    
    const width = 1920;
    const height = 1080;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    // FASE 1: Usar rota React ao invés de arquivo HTML estático
    const sessionId = state.sessionId || 'default';
    const newWindow = window.open(
      `/transmission?sessionId=${sessionId}`,
      'LiveTransmissionWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (newWindow) {
      transmissionWindowRef.current = newWindow;
      state.setTransmissionOpen(true);

      console.log('✅ FASE 1: Transmission window opened successfully');

      // Aguardar o carregamento da nova janela antes de expor funções e configurações
      setTimeout(() => {
        if (newWindow && !newWindow.closed) {
          // A função getParticipantStream deve estar no window host (opener), não na transmission window
          console.log('🎬 Host: Transmission window carregada, garantindo acesso aos streams');
          
          // Verificar se a função existe no host
          if (typeof window.getParticipantStream !== 'function') {
            console.warn('⚠️ Host: window.getParticipantStream não encontrada, criando fallback...');
            window.getParticipantStream = (participantId: string) => {
              console.log('🎬 Host: getParticipantStream fallback solicitado para:', participantId);
              const stream = state.participantStreams?.[participantId] || window.__mlStreams__?.get(participantId) || null;
              console.log('🎬 Host: stream encontrado via fallback:', !!stream, stream?.id);
              return stream;
            };
          } else {
            console.log('✅ Host: window.getParticipantStream já existe');
          }
          
          // Enviar configurações iniciais para replicar interface LivePreview
          newWindow.postMessage({
            type: 'update-participants',
            participants: state.participantList || []
          }, '*');
          
          newWindow.postMessage({
            type: 'update-qr-positions',
            qrCodeVisible: true, // Sempre forçar visível
            qrCodeSvg: state.qrCodeSvg,
            qrCodePosition: state.qrCodePosition,
            qrDescriptionPosition: state.qrDescriptionPosition,
            qrCodeDescription: state.qrCodeDescription,
            selectedFont: state.selectedFont,
            selectedTextColor: state.selectedTextColor,
            qrDescriptionFontSize: state.qrDescriptionFontSize,
            backgroundImage: state.backgroundImage,
            selectedBackgroundColor: state.selectedBackgroundColor,
            participantCount: state.participantCount // Incluir participantCount
          }, '*');
          
          console.log('✅ FASE 1: Functions and initial configurations sent to transmission window');
        }
      }, 1500);

      // Handler de mensagens vindas da popup
      const handleTransmissionMessage = (event: MessageEvent) => {
        if (event.data.type === 'request-initial-config') {
          console.log('🔄 HOST: Recebeu solicitação de configuração inicial da janela de transmissão');
          
          // Enviar todas as configurações atuais
          if (newWindow && !newWindow.closed) {
            newWindow.postMessage({
              type: 'update-participants',
              participants: state.participantList || []
            }, '*');
            
            newWindow.postMessage({
              type: 'update-qr-positions',
              qrCodeVisible: true, // Sempre forçar visível
              qrCodeSvg: state.qrCodeSvg,
              qrCodePosition: state.qrCodePosition,
              qrDescriptionPosition: state.qrDescriptionPosition,
              qrCodeDescription: state.qrCodeDescription,
              selectedFont: state.selectedFont,
              selectedTextColor: state.selectedTextColor,
              qrDescriptionFontSize: state.qrDescriptionFontSize,
              backgroundImage: state.backgroundImage,
              selectedBackgroundColor: state.selectedBackgroundColor,
              participantCount: state.participantCount // Incluir participantCount
            }, '*');
            
            console.log('✅ HOST: Configurações iniciais enviadas');
          }
        }
        
        if (event.data.type === 'participant-stream-ready') {
          const participantId = event.data.participantId;
          console.log(`🎬 HOST: Processing participant stream for: ${participantId}`);
          
          // Opcional: logs/metrics ou processamento adicional
        }
        
        if (event.data.type === 'transmission-ready') {
          console.log('✅ HOST: Transmission window is ready');
          setTimeout(() => {
            updateTransmissionParticipants();
          }, 500);
        }
      };

      window.addEventListener('message', handleTransmissionMessage);

      // Cleanup ao fechar a popup
      const beforeUnloadHandler = () => {
        state.setTransmissionOpen(false);
        transmissionWindowRef.current = null;
        window.removeEventListener('message', handleTransmissionMessage);
        newWindow.removeEventListener('beforeunload', beforeUnloadHandler);
      };
      newWindow.addEventListener('beforeunload', beforeUnloadHandler);
    } else {
      console.error('❌ TRANSMISSION: Falha ao abrir janela de transmissão');
      toast({
        title: "Erro na Transmissão",
        description: "Não foi possível abrir a janela de transmissão. Verifique se pop-ups estão habilitados.",
        variant: "destructive"
      });
    }
  };

  const finishTransmission = (state: any, handleFinalAction?: () => void) => {
    console.log('🛑 FINALIZANDO TRANSMISSÃO: Iniciando processo de finalização');
    console.log('🛑 Estado antes da finalização:', { 
      transmissionOpen: state.transmissionOpen,
      windowExists: !!transmissionWindowRef.current,
      windowClosed: transmissionWindowRef.current?.closed 
    });
    
    // Fechar a janela de transmissão se estiver aberta
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      console.log('🛑 FINALIZANDO: Fechando janela de transmissão');
      try {
        transmissionWindowRef.current.close();
        transmissionWindowRef.current = null;
        console.log('🛑 FINALIZANDO: Janela fechada com sucesso');
      } catch (error) {
        console.error('🛑 ERRO ao fechar janela:', error);
      }
    } else {
      console.log('🛑 FINALIZANDO: Nenhuma janela ativa para fechar');
    }
    
    // CRÍTICO: Sempre definir transmissionOpen como false
    console.log('🛑 FINALIZANDO: Definindo transmissionOpen como false');
    try {
      state.setTransmissionOpen(false);
      console.log('🛑 FINALIZANDO: Estado atualizado com sucesso');
    } catch (error) {
      console.error('🛑 ERRO ao atualizar estado:', error);
    }

    // Forçar re-render se necessário
    setTimeout(() => {
      if (state.transmissionOpen === true) {
        console.log('🛑 CRÍTICO: Estado ainda é true, forçando nova atualização');
        state.setTransmissionOpen(false);
      }
    }, 100);

    // Processar ação final se configurada
    if (state.finalAction !== 'none') {
      console.log('🛑 FINALIZANDO: Executando ação final:', state.finalAction);
      state.setFinalActionTimeLeft(20);
      state.setFinalActionOpen(true);
      
      // Executar callback se fornecido
      if (handleFinalAction) {
        console.log('🛑 FINALIZANDO: Executando handleFinalAction');
        try {
          handleFinalAction();
        } catch (error) {
          console.error('🛑 ERRO ao executar handleFinalAction:', error);
        }
      }
    } else {
      console.log('🛑 FINALIZANDO: Sem ação final configurada');
      toast({
        title: "Transmissão finalizada",
        description: "A transmissão foi encerrada com sucesso."
      });
    }
    
    console.log('🛑 FINALIZAÇÃO COMPLETA: Estado transmissionOpen deve estar false');
    console.log('🛑 Estado final:', { transmissionOpen: state.transmissionOpen });
  };

  return {
    transmissionWindowRef,
    openTransmissionWindow,
    finishTransmission
  };
};