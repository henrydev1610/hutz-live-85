
import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ParticipantsTab from '@/components/live/ParticipantsTab';
import LayoutTab from '@/components/live/LayoutTab';
import QRCodeTab from '@/components/live/QRCodeTab';
import EndActionTab from '@/components/live/EndActionTab';
import LivePreview from '@/components/live/LivePreview';
import { Button } from '@/components/ui/button';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useToast } from '@/hooks/use-toast';
import { Play, X } from 'lucide-react';

const LivePage = () => {
  const [broadcastWindow, setBroadcastWindow] = useState<Window | null>(null);
  const { sessionId, isSessionActive, createSession, endSession } = useSessionManager();
  const { toast } = useToast();
  
  // Start broadcast in a new window
  const startBroadcast = useCallback(() => {
    if (!sessionId) {
      toast({
        title: "Sessão não iniciada",
        description: "Inicie uma sessão antes de iniciar a transmissão.",
        variant: "destructive"
      });
      return;
    }
    
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      `/broadcast?sessionId=${sessionId}`, 
      'BroadcastWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (newWindow) {
      setBroadcastWindow(newWindow);
      toast({
        title: "Transmissão iniciada",
        description: "A janela de transmissão foi aberta."
      });
    } else {
      toast({
        title: "Erro ao abrir janela",
        description: "Verifique se o bloqueador de pop-ups está desativado.",
        variant: "destructive"
      });
    }
  }, [sessionId, toast]);
  
  // End broadcast and close the window
  const endBroadcast = useCallback(() => {
    if (broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.close();
    }
    
    setBroadcastWindow(null);
    endSession();
    
    toast({
      title: "Transmissão finalizada",
      description: "A sessão foi encerrada com sucesso."
    });
  }, [broadcastWindow, endSession, toast]);
  
  // Create a new session when the component mounts
  useEffect(() => {
    if (!isSessionActive) {
      createSession();
    }
    
    // Clean up when component unmounts
    return () => {
      if (broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.close();
      }
      if (isSessionActive) {
        endSession();
      }
    };
  }, [createSession, endSession, isSessionActive]);
  
  // Check if broadcast window was closed
  useEffect(() => {
    if (!broadcastWindow) return;
    
    const checkWindow = setInterval(() => {
      if (broadcastWindow.closed) {
        setBroadcastWindow(null);
        clearInterval(checkWindow);
      }
    }, 1000);
    
    return () => clearInterval(checkWindow);
  }, [broadcastWindow]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Momento Live</h1>
          <div className="flex gap-4">
            <Button 
              onClick={startBroadcast} 
              disabled={!sessionId || !!broadcastWindow}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" /> 
              Iniciar Transmissão
            </Button>
            <Button 
              variant="destructive" 
              onClick={endBroadcast} 
              disabled={!broadcastWindow}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" /> 
              Finalizar Transmissão
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-secondary/20 p-4 rounded-lg border border-border">
            <Tabs defaultValue="participants" className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="participants">Participantes</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="qrcode">QR Code</TabsTrigger>
                <TabsTrigger value="endaction">Ação Final</TabsTrigger>
              </TabsList>
              
              <TabsContent value="participants">
                <ParticipantsTab />
              </TabsContent>
              
              <TabsContent value="layout">
                <LayoutTab />
              </TabsContent>
              
              <TabsContent value="qrcode">
                <QRCodeTab sessionId={sessionId} />
              </TabsContent>
              
              <TabsContent value="endaction">
                <EndActionTab />
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="bg-secondary/20 p-4 rounded-lg border border-border flex items-center justify-center">
            <LivePreview />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
