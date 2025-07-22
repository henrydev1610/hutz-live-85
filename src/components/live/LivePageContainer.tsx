import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from "sonner";
import { Participant } from './ParticipantGrid';
import ParticipantGrid from './ParticipantGrid';
import ParticipantVideoPreview from '@/components/participant/ParticipantVideoPreview';
import { useParticipantMedia } from '@/hooks/participant/useParticipantMedia';
import { useParticipantManagement } from '@/hooks/live/useParticipantManagement';
import { useTransmissionWindow } from '@/hooks/live/useTransmissionWindow';
import { useForceVideoDisplay } from '@/hooks/live/useForceVideoDisplay';
import { clearConnectionCache, clearDeviceCache } from '@/utils/connectionUtils';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StreamRecoveryPanel } from '@/components/debug/StreamRecoveryPanel';

interface LivePageContainerProps {
  sessionId: string | null;
}

const LivePageContainer: React.FC<LivePageContainerProps> = ({ sessionId }) => {
  const [participantList, setParticipantList] = useState<Participant[]>([]);
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [isTransmitting, setIsTransmitting] = useState(false);
  const transmissionWindowRef = useRef<Window | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const {
    hasVideo,
    hasAudio,
    hasScreenShare,
    isVideoEnabled,
    isAudioEnabled,
    localVideoRef,
    localStreamRef,
    initializeMedia,
    retryMediaInitialization,
    switchCamera,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare
  } = useParticipantMedia();

  const {
    handleParticipantSelect,
    handleParticipantRemove,
    handleParticipantJoin,
    handleParticipantStream,
    testConnection,
    transferStreamToTransmission,
    forceReconnectParticipant,
    getStreamHealth,
    areCallbacksSet,
    getDebugInfo
  } = useParticipantManagement({
    participantList,
    setParticipantList,
    participantStreams,
    setParticipantStreams,
    sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

  const {
    openTransmissionWindow,
    closeTransmissionWindow,
    updateTransmissionParticipants
  } = useTransmissionWindow({
    participantList,
    participantStreams,
    transmissionWindowRef,
    isTransmitting
  });

  useForceVideoDisplay({ participantList, participantStreams });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (sessionId) {
      console.log('🏠 LIVE: Initializing media for session:', sessionId);
      initializeMedia();
    }

    return () => {
      console.log('🏠 LIVE: Cleaning up media');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      closeTransmissionWindow();
    };
  }, [sessionId, initializeMedia, closeTransmissionWindow]);

  const handleStartTransmission = () => {
    setIsTransmitting(true);
    openTransmissionWindow();
  };

  const handleStopTransmission = () => {
    setIsTransmitting(false);
    closeTransmissionWindow();
  };

  const handleAddParticipant = () => {
    if (newParticipantName.trim() !== '') {
      const newParticipant: Participant = {
        id: Date.now().toString(),
        name: newParticipantName,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: true,
        selected: false,
        hasVideo: false,
        isMobile: isMobile
      };
      setParticipantList(prev => [...prev, newParticipant]);
      setNewParticipantName('');
      setIsDialogOpen(false);
    }
  };

  // Recovery actions for StreamRecoveryPanel
  const handleForceStreamCapture = async () => {
    console.log('🔥 FORCE STREAM CAPTURE: Triggering mobile stream capture...');
    
    // Send force capture signal to mobile devices
    if (sessionId) {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'force-stream-capture',
        timestamp: Date.now()
      });
      channel.close();
    }
    
    // Also trigger test connection
    testConnection();
  };

  const handleDiagnosticReset = () => {
    console.log('🧹 DIAGNOSTIC RESET: Clearing all diagnostic data...');
    
    // Reset stream tracker
    (window as any).streamTracker?.exportDebugReport && 
    console.log('Previous state:', (window as any).streamTracker.exportDebugReport());
    
    // Clear caches
    clearConnectionCache();
    clearDeviceCache();
    
    // Force refresh
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <header className="bg-black/50 py-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Sessão ao vivo: {sessionId}</h1>
          <div className="space-x-2">
            <Button variant="outline" onClick={testConnection}>
              Testar Conexão
            </Button>
            <Button onClick={handleStartTransmission} disabled={isTransmitting}>
              Iniciar Transmissão
            </Button>
            <Button variant="destructive" onClick={handleStopTransmission} disabled={!isTransmitting}>
              Parar Transmissão
            </Button>
          </div>
        </div>
      </header>

      <main className="py-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
          <div className="md:col-span-1">
            <ParticipantVideoPreview
              localVideoRef={localVideoRef}
              hasVideo={hasVideo}
              hasAudio={hasAudio}
              hasScreenShare={hasScreenShare}
              isVideoEnabled={isVideoEnabled}
              isAudioEnabled={isAudioEnabled}
              localStream={localStreamRef.current}
              onRetryMedia={retryMediaInitialization}
            />
            
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Button onClick={() => switchCamera('user')} disabled={!hasVideo || isMobile === false}>
                Mudar para Frontal
              </Button>
              <Button onClick={() => switchCamera('environment')} disabled={!hasVideo || isMobile === false}>
                Mudar para Traseira
              </Button>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Button onClick={toggleVideo} disabled={!hasVideo}>
                {isVideoEnabled ? 'Desligar Câmera' : 'Ligar Câmera'}
              </Button>
              <Button onClick={toggleAudio} disabled={!hasAudio}>
                {isAudioEnabled ? 'Desligar Microfone' : 'Ligar Microfone'}
              </Button>
              <Button onClick={hasScreenShare ? stopScreenShare : startScreenShare}>
                {hasScreenShare ? 'Parar Tela' : 'Compartilhar Tela'}
              </Button>
            </div>
          </div>

          <div className="md:col-span-2">
            <ParticipantGrid
              participantList={participantList}
              participantStreams={participantStreams}
              onParticipantSelect={handleParticipantSelect}
              onParticipantRemove={handleParticipantRemove}
            />
          </div>
        </div>
      </main>

      <footer className="bg-black/50 py-4 shadow-md">
        <div className="max-w-7xl mx-auto px-4 text-white text-center">
          <p>&copy; 2024 Live Session. Todos os direitos reservados.</p>
        </div>
      </footer>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Adicionar Participante</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Participante</DialogTitle>
            <DialogDescription>
              Adicione um novo participante à lista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input id="name" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <Button type="submit" onClick={handleAddParticipant}>Salvar</Button>
        </DialogContent>
      </Dialog>
      
      {/* Add Stream Recovery Panel */}
      <div className="max-w-4xl mx-auto px-4">
        <StreamRecoveryPanel
          onForceReconnect={forceReconnectParticipant}
          onForceStreamCapture={handleForceStreamCapture}
          onDiagnosticReset={handleDiagnosticReset}
        />
      </div>
    </div>
  );
};

export default LivePageContainer;
