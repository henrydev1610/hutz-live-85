
// Simplified LivePage - Focus on participant grid functionality
import React, { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import SimpleLivePreview from '@/components/live/SimpleLivePreview';
import BasicQRCodeGenerator from '@/components/live/BasicQRCodeGenerator';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Video, Wifi } from 'lucide-react';

const LivePage: React.FC = () => {
  const { toast } = useToast();
  
  // Simplified state management
  const [sessionId] = useState(`session-${Date.now()}`);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string>('');
  const [transmissionActive, setTransmissionActive] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  
  // Mock participants with different states - typed correctly
  const [participants] = useState<{id: string; name: string; status: 'waiting' | 'connecting' | 'active'; hasVideo: boolean}[]>([
    { id: 'P1', name: 'Participante 1', status: 'waiting' as const, hasVideo: false },
    { id: 'P2', name: 'Participante 2', status: 'connecting' as const, hasVideo: false },
    { id: 'P3', name: 'Participante 3', status: 'active' as const, hasVideo: true },
    { id: 'P4', name: 'Participante 4', status: 'waiting' as const, hasVideo: false }
  ]);

  const handleStartTransmission = () => {
    setTransmissionActive(true);
    toast({
      title: "Transmissão Iniciada",
      description: "A transmissão ao vivo foi iniciada com sucesso.",
    });
  };

  const handleStopTransmission = () => {
    setTransmissionActive(false);
    toast({
      title: "Transmissão Finalizada",
      description: "A transmissão ao vivo foi finalizada.",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    toast({
      title: "Imagem removida",
      description: "A imagem de fundo foi removida com sucesso."
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Live Streaming Studio</h1>
          <div className="flex items-center gap-4">
            <Badge variant={transmissionActive ? "default" : "secondary"} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${transmissionActive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              {transmissionActive ? 'AO VIVO' : 'OFFLINE'}
            </Badge>
            <span className="text-sm text-muted-foreground">Session ID: {sessionId}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-4">
            {/* Transmission Controls */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Video className="w-5 h-5" />
                Controles de Transmissão
              </h3>
              <div className="flex gap-2">
                <Button 
                  onClick={handleStartTransmission}
                  disabled={transmissionActive}
                  className="flex items-center gap-2"
                >
                  <Wifi className="w-4 h-4" />
                  Iniciar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleStopTransmission}
                  disabled={!transmissionActive}
                >
                  Parar
                </Button>
              </div>
            </Card>

            {/* QR Code Generator */}
            <BasicQRCodeGenerator 
              sessionId={sessionId}
              onQRGenerated={setQrCodeSvg}
              qrVisible={qrCodeVisible}
              onToggleVisible={setQrCodeVisible}
            />

            {/* Background Settings */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">Configurações de Fundo</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bg-color">Cor de Fundo</Label>
                  <Input
                    id="bg-color"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-20 h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="bg-image">Imagem de Fundo</Label>
                  <Input
                    id="bg-image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  {backgroundImage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={removeBackgroundImage}
                      className="mt-2"
                    >
                      Remover Imagem
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Participants List */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participantes ({participants.length})
              </h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        participant.status === 'active' ? 'bg-green-500' :
                        participant.status === 'connecting' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`} />
                      <span className="font-medium">{participant.name}</span>
                    </div>
                    <Badge variant="outline">
                      {participant.status === 'active' ? 'Ativo' :
                       participant.status === 'connecting' ? 'Conectando' :
                       'Aguardando'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Panel - Live Preview */}
          <div>
            <SimpleLivePreview 
              participants={participants}
              backgroundColor={backgroundColor}
              backgroundImage={backgroundImage}
              qrCodeVisible={qrCodeVisible}
              qrCodeSvg={qrCodeSvg}
              transmissionActive={transmissionActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
