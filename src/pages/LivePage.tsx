import React, { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateSessionId } from '@/utils/sessionUtils';
import QRCode from 'qrcode';

interface Participant {
  id: string;
  name: string;
  joinedAt: number;
  lastActive: number;
  active: boolean;
  selected: boolean;
  hasVideo?: boolean;
  isMobile?: boolean;
}

const LivePage: React.FC = () => {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [streams, setStreams] = useState<{[id: string]: MediaStream}>({});

  // Auto-gerar sessionId ao carregar a página
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    console.log('🎯 LivePage: Session ID gerado:', newSessionId);
  }, []);

  const generateQRCodeHandler = async () => {
    if (!sessionId) {
      toast({
        title: "Erro",
        description: "Session ID não encontrado",
        variant: "destructive"
      });
      return;
    }

    try {
      const baseUrl = window.location.origin;
      const participantUrl = `${baseUrl}/participant/${sessionId}?forceMobile=true&camera=environment&qr=1`;
      
      const qrDataUrl = await QRCode.toDataURL(participantUrl, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      setQrCodeURL(participantUrl);
      setQrCodeSvg(qrDataUrl);

      toast({
        title: "QR Code gerado",
        description: "Sala criada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar o QR Code.",
        variant: "destructive"
      });
    }
  };

  // Quadrantes de participantes
  const ParticipantGrid = () => {
    const gridSlots = Array.from({ length: 4 }, (_, i) => {
      const participant = participants[i];
      const stream = participant ? streams[participant.id] : null;
      
      return (
        <div 
          key={i}
          className="aspect-video bg-gray-800 rounded-lg overflow-hidden relative border-2 border-gray-600"
          style={{ minHeight: '200px' }}
        >
          {/* Container para vídeo */}
          <div 
            id={`video-container-${participant?.id || `slot-${i}`}`}
            className="w-full h-full relative"
          />
          
          {participant ? (
            <>
              {/* Status do participante */}
              <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {participant.name}
              </div>
              
              {/* Indicador de vídeo */}
              {participant.hasVideo && (
                <div className="absolute top-2 right-2">
                  <div className="bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>
                </div>
              )}
              
              {/* Estado de conexão */}
              {participant.active && !participant.hasVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                  <div className="text-center text-white">
                    <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm">Conectando...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Slot vazio
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/40">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm">P{i + 1}</p>
                <p className="text-xs text-gray-500">Aguardando</p>
              </div>
            </div>
          )}
        </div>
      );
    });

    return (
      <div className="grid grid-cols-2 gap-4">
        {gridSlots}
      </div>
    );
  };

  return (
    <div className="min-h-screen container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Transmissão ao Vivo</h1>
        <p className="text-muted-foreground">Gerencie participantes e transmita ao vivo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controles */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Sessão</CardTitle>
              <CardDescription>
                Gere o QR Code para participantes se conectarem
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionId && (
                <div className="text-sm text-muted-foreground">
                  ID da Sessão: <code className="bg-secondary px-1 rounded">{sessionId}</code>
                </div>
              )}
              
              <Button 
                onClick={generateQRCodeHandler}
                className="w-full"
                disabled={!sessionId}
              >
                Gerar QR Code
              </Button>

              {qrCodeSvg && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCodeSvg} alt="QR Code" className="w-32 h-32" />
                </div>
              )}

              {qrCodeURL && (
                <div className="text-xs text-muted-foreground break-all">
                  URL: {qrCodeURL}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status da Transmissão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Participantes conectados:</span>
                  <span className="font-medium">{participants.filter(p => p.active).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Streams ativos:</span>
                  <span className="font-medium">{Object.keys(streams).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visualização */}
        <div>
          <Card className="min-h-[600px]">
            <CardHeader>
              <CardTitle>Quadrantes de Participantes</CardTitle>
              <CardDescription>
                Veja os participantes conectados em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ParticipantGrid />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LivePage;