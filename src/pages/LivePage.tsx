
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Video } from 'lucide-react';
import ParticipantsTab from '@/components/live/ParticipantsTab';
import LayoutTab from '@/components/live/LayoutTab';
import QRCodeTab from '@/components/live/QRCodeTab';
import CallToActionTab from '@/components/live/CallToActionTab';
import StreamPreview from '@/components/live/StreamPreview';
import { useLiveSession } from '@/contexts/LiveSessionContext';

const LivePage = () => {
  const [initialized, setInitialized] = useState(false);
  const { 
    startBroadcast, 
    stopBroadcast, 
    isLive, 
    selectedParticipants,
    layout,
    backgroundColor,
    backgroundImage,
    qrCode,
    qrCodeText,
    qrCodeFont,
    qrCodeColor,
    sessionId,
    isParticipantVisible,
    generateSessionId
  } = useLiveSession();

  // Filter participants by visibility for preview
  const visibleParticipants = selectedParticipants.map(p => ({
    ...p,
    isVisible: isParticipantVisible(p.id)
  }));

  if (!initialized && !sessionId) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold hutz-gradient-text">Momento Live</h1>
          <p className="text-white/70 mt-2">
            Transmissão em tempo real para seus eventos com interação via QR Code.
          </p>
        </header>
        
        <div className="flex flex-col items-center justify-center space-y-4 mt-12">
          <p className="text-lg text-white/80">
            Clique no botão abaixo para iniciar uma nova sessão ao vivo
          </p>
          <Button 
            onClick={() => {
              generateSessionId();
              setInitialized(true);
            }}
            size="lg"
            className="hutz-button-accent"
          >
            Iniciar Nova Sessão
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold hutz-gradient-text">Momento Live</h1>
        <p className="text-white/70 mt-2">
          Transmissão em tempo real para seus eventos com interação via QR Code.
        </p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: Preview */}
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white/90">Pré-visualização</h2>
          </div>
          <div className="bg-black/50 rounded-lg overflow-hidden shadow-lg h-[500px] relative">
            <StreamPreview 
              participants={visibleParticipants}
              layout={layout}
              backgroundColor={backgroundColor}
              backgroundImage={backgroundImage}
              qrCode={qrCode}
              qrCodeText={qrCodeText}
              qrCodeFont={qrCodeFont}
              qrCodeColor={qrCodeColor}
            />
          </div>
          <div className="mt-4 flex justify-between">
            {!isLive ? (
              <Button 
                onClick={startBroadcast}
                className="hutz-button-accent gap-2"
              >
                <Video className="h-5 w-5" />
                Iniciar Transmissão
              </Button>
            ) : (
              <Button 
                onClick={stopBroadcast}
                variant="destructive"
              >
                Finalizar Transmissão
              </Button>
            )}
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="flex items-center">
                  <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full mr-2"></span>
                  Ao vivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side: Tabs */}
        <div className="bg-secondary/40 backdrop-blur-lg rounded-lg p-5 shadow-lg border border-white/10">
          <Tabs defaultValue="participants" className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="participants">Participantes</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
              <TabsTrigger value="calltoaction">Ação Final</TabsTrigger>
            </TabsList>
            <TabsContent value="participants">
              <ParticipantsTab />
            </TabsContent>
            <TabsContent value="layout">
              <LayoutTab />
            </TabsContent>
            <TabsContent value="qrcode">
              <QRCodeTab />
            </TabsContent>
            <TabsContent value="calltoaction">
              <CallToActionTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
