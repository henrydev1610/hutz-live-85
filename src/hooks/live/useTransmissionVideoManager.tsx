import { useEffect, useCallback, useRef } from 'react';
import { useUnifiedVideoCreation } from './useUnifiedVideoCreation';
import { useContainerManagement } from './useContainerManagement';

interface UseTransmissionVideoManagerProps {
  participantStreams: {[id: string]: MediaStream};
  setParticipantStreams: React.Dispatch<React.SetStateAction<{[id: string]: MediaStream}>>;
}

export const useTransmissionVideoManager = ({ 
  participantStreams, 
  setParticipantStreams 
}: UseTransmissionVideoManagerProps) => {
  const { createVideoElementUnified, cleanup } = useUnifiedVideoCreation();
  const { findVideoContainers } = useContainerManagement();
  const processedStreamsRef = useRef(new Set<string>());

  const createVideoForStream = useCallback(async (participantId: string, stream: MediaStream) => {
    const streamKey = `${participantId}-${stream.id}`;
    
    // Evitar processamento duplicado
    if (processedStreamsRef.current.has(streamKey)) {
      console.log(`🎯 TRANSMISSION MANAGER: Stream já processado para ${participantId}`);
      return;
    }

    try {
      console.log(`🎯 TRANSMISSION MANAGER: Processando stream para ${participantId}`);
      
      // Aguardar DOM estar completamente pronto
      await new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(void 0);
        } else {
          const handler = () => {
            if (document.readyState === 'complete') {
              document.removeEventListener('readystatechange', handler);
              resolve(void 0);
            }
          };
          document.addEventListener('readystatechange', handler);
        }
      });

      // Aguardar mais um pouco para garantir que React renderizou
      await new Promise(resolve => setTimeout(resolve, 300));

      // Encontrar containers
      const containers = await findVideoContainers(participantId);
      
      if (containers.length === 0) {
        console.warn(`⚠️ TRANSMISSION MANAGER: Nenhum container encontrado para ${participantId}`);
        return;
      }

      console.log(`📦 TRANSMISSION MANAGER: Encontrados ${containers.length} containers para ${participantId}`);

      // Criar vídeo em cada container
      for (const container of containers) {
        try {
          const videoElement = await createVideoElementUnified(container, stream, participantId);
          
          if (videoElement) {
            console.log(`✅ TRANSMISSION MANAGER: Vídeo criado para ${participantId}`);
            
            // Configurações essenciais para transmissão
            videoElement.playsInline = true;
            videoElement.muted = true;
            videoElement.autoplay = true;
            videoElement.controls = false;
            
            // Aguardar metadados e tentar reproduzir
            videoElement.addEventListener('loadedmetadata', async () => {
              try {
                await videoElement.play();
                console.log(`🎬 TRANSMISSION MANAGER: Vídeo reproduzindo para ${participantId}`);
                
                // Marcar como processado após sucesso
                processedStreamsRef.current.add(streamKey);
                
                // Disparar evento de sucesso
                window.dispatchEvent(new CustomEvent('transmission-video-ready', {
                  detail: { participantId, streamId: stream.id, videoElement }
                }));
                
              } catch (playError) {
                console.error(`❌ TRANSMISSION MANAGER: Erro ao reproduzir ${participantId}:`, playError);
              }
            });

            // Fallback para metadados já carregados
            if (videoElement.readyState >= 1) {
              try {
                await videoElement.play();
                console.log(`🎬 TRANSMISSION MANAGER: Vídeo reproduzindo para ${participantId} (fallback)`);
                processedStreamsRef.current.add(streamKey);
              } catch (playError) {
                console.error(`❌ TRANSMISSION MANAGER: Erro no fallback ${participantId}:`, playError);
              }
            }
          }
        } catch (error) {
          console.error(`❌ TRANSMISSION MANAGER: Erro ao criar vídeo para ${participantId}:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ TRANSMISSION MANAGER: Erro geral para ${participantId}:`, error);
    }
  }, [createVideoElementUnified, findVideoContainers]);

  // Processar streams existentes quando o hook é inicializado
  useEffect(() => {
    console.log('🎯 TRANSMISSION MANAGER: Inicializando com streams existentes:', Object.keys(participantStreams));
    
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      if (stream && stream.active) {
        createVideoForStream(participantId, stream);
      }
    });
  }, []); // Executar apenas uma vez na inicialização

  // Monitorar novos streams
  useEffect(() => {
    const streamEntries = Object.entries(participantStreams);
    console.log('🎯 TRANSMISSION MANAGER: Streams atualizados:', streamEntries.length);
    
    streamEntries.forEach(([participantId, stream]) => {
      if (stream && stream.active) {
        const streamKey = `${participantId}-${stream.id}`;
        if (!processedStreamsRef.current.has(streamKey)) {
          console.log(`🆕 TRANSMISSION MANAGER: Novo stream detectado para ${participantId}`);
          createVideoForStream(participantId, stream);
        }
      }
    });
  }, [participantStreams, createVideoForStream]);

  // Limpar referências quando streams são removidos
  useEffect(() => {
    const currentStreamKeys = Object.entries(participantStreams)
      .filter(([_, stream]) => stream && stream.active)
      .map(([participantId, stream]) => `${participantId}-${stream.id}`);
    
    // Remover referências de streams que não existem mais
    const keysToRemove = Array.from(processedStreamsRef.current).filter(
      key => !currentStreamKeys.includes(key)
    );
    
    keysToRemove.forEach(key => {
      processedStreamsRef.current.delete(key);
      console.log(`🧹 TRANSMISSION MANAGER: Removida referência de stream: ${key}`);
    });
  }, [participantStreams]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      console.log('🧹 TRANSMISSION MANAGER: Limpando recursos');
      processedStreamsRef.current.clear();
      cleanup();
    };
  }, [cleanup]);

  return {
    createVideoForStream,
    processedStreams: processedStreamsRef.current
  };
};