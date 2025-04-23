
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ParticipantsTab from "@/components/live/tabs/ParticipantsTab";
import LayoutTab from "@/components/live/tabs/LayoutTab";
import QrCodeTab from "@/components/live/tabs/QrCodeTab";
import ActionTab from "@/components/live/tabs/ActionTab";
import PreviewPanel from "@/components/live/PreviewPanel";
import { useSessionManager } from "@/hooks/useSessionManager";
import { Button } from "@/components/ui/button";
import { Play, StopCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const LivePage = () => {
  const { sessionId, createSession, endSession, isSessionActive } = useSessionManager();
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [broadcastWindow, setBroadcastWindow] = useState<Window | null>(null);

  useEffect(() => {
    // Close broadcast window when session ends or component unmounts
    return () => {
      if (broadcastWindow && !broadcastWindow.closed) {
        broadcastWindow.close();
      }
    };
  }, [broadcastWindow]);

  const startTransmission = () => {
    if (!isSessionActive) {
      toast({
        title: "Sessão não iniciada",
        description: "Você precisa gerar um QR Code para iniciar a sessão.",
        variant: "destructive",
      });
      return;
    }

    const bWindow = window.open(
      `/broadcast?sessionId=${sessionId}`,
      "BroadcastWindow",
      "width=1280,height=720,resizable=yes"
    );
    
    if (bWindow) {
      setBroadcastWindow(bWindow);
      setIsTransmitting(true);
      
      bWindow.onbeforeunload = () => {
        setIsTransmitting(false);
        setBroadcastWindow(null);
      };
    } else {
      toast({
        title: "Bloqueio de pop-up detectado",
        description: "Por favor, permita pop-ups para este site para iniciar a transmissão.",
        variant: "destructive",
      });
    }
  };

  const stopTransmission = () => {
    if (broadcastWindow && !broadcastWindow.closed) {
      broadcastWindow.close();
    }
    setIsTransmitting(false);
    setBroadcastWindow(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2">
          <Tabs defaultValue="participants" className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="participants">Participantes</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              <TabsTrigger value="action">Ação Final</TabsTrigger>
            </TabsList>
            <div className="border rounded-md p-4 min-h-[500px]">
              <TabsContent value="participants">
                <ParticipantsTab />
              </TabsContent>
              <TabsContent value="layout">
                <LayoutTab />
              </TabsContent>
              <TabsContent value="qrcode">
                <QrCodeTab />
              </TabsContent>
              <TabsContent value="action">
                <ActionTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
        
        <div className="w-full lg:w-1/2">
          <div className="mb-4 flex justify-between">
            <h2 className="text-2xl font-bold">Pré-visualização</h2>
            <div className="flex gap-2">
              {!isTransmitting ? (
                <Button 
                  onClick={startTransmission} 
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="mr-2 h-4 w-4" /> 
                  Iniciar Transmissão
                </Button>
              ) : (
                <Button 
                  onClick={stopTransmission} 
                  variant="destructive"
                >
                  <StopCircle className="mr-2 h-4 w-4" /> 
                  Finalizar Transmissão
                </Button>
              )}
            </div>
          </div>
          
          <PreviewPanel isActive={isSessionActive} />
        </div>
      </div>
    </div>
  );
};

export default LivePage;
