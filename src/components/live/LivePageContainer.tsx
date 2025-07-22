
import React, { useEffect, useState } from 'react';
import { toast } from "sonner";
import LivePageHeader from '@/components/live/LivePageHeader';
import LivePageContent from '@/components/live/LivePageContent';
import FinalActionDialog from '@/components/live/FinalActionDialog';
import { 
  clearConnectionCache, 
  forceRefreshConnections, 
  getEnvironmentInfo, 
  validateURLConsistency,
  createRoomIfNeeded 
} from '@/utils/connectionUtils';
import { clearDeviceCache } from '@/utils/media/deviceDetection';

interface LivePageContainerProps {
  state: any;
  participantManagement: any;
  transmissionOpen: boolean;
  sessionId: string | null;
  onStartTransmission: () => void;
  onFinishTransmission: () => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onGenerateQRCode: () => void;
  onQRCodeToTransmission: () => void;
  closeFinalAction: () => void;
}

const LivePageContainer: React.FC<LivePageContainerProps> = ({
  state,
  participantManagement,
  transmissionOpen,
  sessionId,
  onStartTransmission,
  onFinishTransmission,
  onFileSelect,
  onRemoveImage,
  onGenerateQRCode,
  onQRCodeToTransmission,
  closeFinalAction
}) => {
  const [roomStatus, setRoomStatus] = useState<'unknown' | 'creating' | 'ready' | 'error'>('unknown');

  // FASE 2: Enhanced cache management with URL sync validation
  useEffect(() => {
    console.log('🏠 LIVE CONTAINER: Inicializando com gestão de cache aprimorada e sincronização de URLs');
    
    // FASE 5: Verificação inicial de consistência de URL
    const isConsistent = validateURLConsistency();
    if (!isConsistent) {
      console.warn('⚠️ LIVE CONTAINER: Inconsistência de URL detectada na inicialização');
      forceRefreshConnections();
    }
    
    // Limpar cache periodicamente
    const cacheInterval = setInterval(() => {
      console.log('🧹 LIVE CONTAINER: Limpeza periódica de cache com validação de URL');
      clearConnectionCache();
      clearDeviceCache();
      
      const stillConsistent = validateURLConsistency();
      if (!stillConsistent) {
        console.warn('⚠️ LIVE CONTAINER: Deriva de URL detectada, forçando atualização');
        forceRefreshConnections();
      }
    }, 60000); // A cada minuto
    
    return () => {
      clearInterval(cacheInterval);
    };
  }, []);

  // FASE 1: Gerenciamento de sala quando sessionId muda
  useEffect(() => {
    const setupRoom = async () => {
      if (!sessionId) {
        setRoomStatus('unknown');
        return;
      }
      
      console.log(`🏠 SALA: Nova sessão detectada (${sessionId}), configurando sala`);
      setRoomStatus('creating');
      
      try {
        // FASE 1: Garantir que a sala exista quando a transmissão inicia
        const roomCreated = await createRoomIfNeeded(sessionId);
        
        if (roomCreated) {
          console.log(`✅ SALA ${sessionId}: Criada/Verificada com sucesso`);
          setRoomStatus('ready');
          
          // FASE 5: Mostrar status ao usuário
          toast.success(`Sala ${sessionId} pronta para conexões móveis`);
        } else {
          console.error(`❌ SALA ${sessionId}: Falha ao criar/verificar`);
          setRoomStatus('error');
          
          toast.error(`Falha ao preparar sala ${sessionId}. Tente gerar um novo QR code.`);
        }
      } catch (error) {
        console.error(`❌ SALA ${sessionId}: Erro durante setup:`, error);
        setRoomStatus('error');
      }
    };
    
    setupRoom();
  }, [sessionId]);

  // FASE 1: Gerenciador de QR Code aprimorado
  const handleEnhancedQRCode = async () => {
    // Chamar a função original
    onGenerateQRCode();
    
    // FASE 5: Aguardar até que sessionId esteja disponível
    const checkInterval = setInterval(() => {
      if (state.sessionId) {
        clearInterval(checkInterval);
        
        // Validar sala após criação do QR
        console.log(`🔍 VALIDAÇÃO: Verificando sala ${state.sessionId} após geração do QR`);
        createRoomIfNeeded(state.sessionId)
          .then(success => {
            if (success) {
              console.log(`✅ SALA ${state.sessionId}: Validada após geração do QR`);
              setRoomStatus('ready');
            } else {
              console.warn(`⚠️ SALA ${state.sessionId}: Não validada após geração do QR`);
            }
          })
          .catch(err => {
            console.error(`❌ VALIDAÇÃO ${state.sessionId}: Erro:`, err);
          });
      }
    }, 500);
    
    // Limpar interval após 10 segundos para evitar vazamentos
    setTimeout(() => clearInterval(checkInterval), 10000);
  };

  return (
    <div className="min-h-screen container mx-auto py-8 px-4 relative">
      <LivePageHeader />
      
      <LivePageContent
        state={state}
        participantManagement={participantManagement}
        transmissionOpen={transmissionOpen}
        sessionId={sessionId}
        onStartTransmission={onStartTransmission}
        onFinishTransmission={onFinishTransmission}
        onFileSelect={onFileSelect}
        onRemoveImage={onRemoveImage}
        onGenerateQRCode={handleEnhancedQRCode} // FASE 1: Usar handler aprimorado
        onQRCodeToTransmission={onQRCodeToTransmission}
      />
      
      <FinalActionDialog
        finalActionOpen={state.finalActionOpen}
        setFinalActionOpen={state.setFinalActionOpen}
        finalActionTimeLeft={state.finalActionTimeLeft}
        onCloseFinalAction={closeFinalAction}
      />
      
      {/* FASE 5: Status da sala */}
      {sessionId && (
        <div className="fixed top-4 right-4 z-50 p-2 rounded-md text-sm shadow-md bg-opacity-90 animate-pulse"
             style={{ 
               backgroundColor: roomStatus === 'ready' 
                               ? 'rgba(34, 197, 94, 0.2)' 
                               : roomStatus === 'creating' 
                               ? 'rgba(234, 179, 8, 0.2)' 
                               : roomStatus === 'error'
                               ? 'rgba(239, 68, 68, 0.2)'
                               : 'rgba(59, 130, 246, 0.2)',
               borderColor: roomStatus === 'ready' 
                          ? 'rgba(34, 197, 94, 0.5)' 
                          : roomStatus === 'creating' 
                          ? 'rgba(234, 179, 8, 0.5)' 
                          : roomStatus === 'error'
                          ? 'rgba(239, 68, 68, 0.5)'
                          : 'rgba(59, 130, 246, 0.5)',
               borderWidth: '1px'
             }}>
          {roomStatus === 'ready' && (
            <span className="text-green-500">✅ Sala {sessionId.substring(0, 8)}... pronta</span>
          )}
          {roomStatus === 'creating' && (
            <span className="text-yellow-500">⏳ Preparando sala {sessionId?.substring(0, 8)}...</span>
          )}
          {roomStatus === 'error' && (
            <span className="text-red-500">❌ Erro na sala {sessionId?.substring(0, 8)}...</span>
          )}
          {roomStatus === 'unknown' && (
            <span className="text-blue-500">ℹ️ Status da sala desconhecido</span>
          )}
        </div>
      )}
      
      {/* FASE 5: Debug Controls com info de consistência */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        <button
          onClick={() => {
            clearConnectionCache();
            clearDeviceCache();
            console.log('🧹 Limpeza manual de cache acionada');
            const envInfo = getEnvironmentInfo();
            console.log('🌐 Ambiente após limpeza:', envInfo);
            toast.success('Cache limpo');
          }}
          className="bg-red-500 text-white p-2 rounded text-xs"
          title="Limpar Cache"
        >
          🧹 Limpar Cache
        </button>
        
        <button
          onClick={() => {
            forceRefreshConnections();
            console.log('🔄 Atualização manual de conexões');
            const isConsistent = validateURLConsistency();
            console.log('🔍 Consistência de URL após atualização:', isConsistent ? '✅' : '❌');
            toast.success('Conexões atualizadas');
          }}
          className="bg-blue-500 text-white p-2 rounded text-xs"
          title="Atualizar Conexões"
        >
          🔄 Atualizar Conexões
        </button>
        
        {/* FASE 3: Validação de sala */}
        {sessionId && (
          <button
            onClick={async () => {
              toast.info(`Verificando sala ${sessionId}...`);
              
              try {
                const roomExists = await createRoomIfNeeded(sessionId);
                
                if (roomExists) {
                  setRoomStatus('ready');
                  toast.success(`Sala ${sessionId} verificada/criada com sucesso`);
                } else {
                  setRoomStatus('error');
                  toast.error(`Falha ao verificar/criar sala ${sessionId}`);
                }
              } catch (error) {
                setRoomStatus('error');
                toast.error(`Erro ao verificar sala: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            className="bg-green-500 text-white p-2 rounded text-xs"
            title="Verificar Sala"
          >
            🔍 Verificar Sala
          </button>
        )}
        
        {/* FASE 5: Debug URL */}
        <button
          onClick={() => {
            const envInfo = getEnvironmentInfo();
            const urlSyncStatus = validateURLConsistency() ? '✅ SINCRONIZADO' : '❌ NÃO_SINCRONIZADO';
            console.log(`🌐 Status Rápido: URLs ${urlSyncStatus}`);
            toast.info(`URLs: ${urlSyncStatus}\nBackend: ${envInfo.apiBaseUrl}\nWebSocket: ${envInfo.wsUrl}`);
          }}
          className="bg-purple-500 text-white p-2 rounded text-xs"
          title="Debug URL"
        >
          🌐 Debug URL
        </button>
      </div>
    </div>
  );
};

export default LivePageContainer;
