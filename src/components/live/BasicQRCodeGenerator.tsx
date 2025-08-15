import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, Eye, EyeOff, Copy } from 'lucide-react';
import QRCode from 'qrcode';

interface BasicQRCodeGeneratorProps {
  sessionId: string;
  onQRGenerated: (svg: string) => void;
  qrVisible: boolean;
  onToggleVisible: (visible: boolean) => void;
}

const BasicQRCodeGenerator: React.FC<BasicQRCodeGeneratorProps> = ({
  sessionId,
  onQRGenerated,
  qrVisible,
  onToggleVisible
}) => {
  const { toast } = useToast();
  const [qrDescription, setQrDescription] = useState('Participe da transmissão');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Generate participant URL
  const participantUrl = `${window.location.origin}/participant?session=${sessionId}`;

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const qrSvg = await QRCode.toString(participantUrl, {
        type: 'svg',
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      onQRGenerated(qrSvg);
      toast({
        title: "QR Code Gerado",
        description: "QR Code criado com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar QR Code.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(participantUrl);
      toast({
        title: "URL Copiada",
        description: "URL do participante copiada para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao copiar URL.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <QrCode className="w-5 h-5" />
        Gerador de QR Code
      </h3>
      
      <div className="space-y-4">
        {/* QR Description */}
        <div>
          <Label htmlFor="qr-description">Descrição do QR Code</Label>
          <Input
            id="qr-description"
            value={qrDescription}
            onChange={(e) => setQrDescription(e.target.value)}
            placeholder="Ex: Participe da transmissão"
          />
        </div>

        {/* Participant URL */}
        <div>
          <Label>URL do Participante</Label>
          <div className="flex gap-2 mt-1">
            <Input 
              value={participantUrl}
              readOnly
              className="text-sm"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={copyUrl}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={generateQRCode}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            {isGenerating ? 'Gerando...' : 'Gerar QR Code'}
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => onToggleVisible(!qrVisible)}
            className="flex items-center gap-2"
          >
            {qrVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {qrVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        </div>

        {/* QR Status */}
        <div className="flex items-center gap-2">
          <Badge variant={qrVisible ? "default" : "secondary"}>
            QR Code {qrVisible ? 'Visível' : 'Oculto'}
          </Badge>
        </div>

        {/* Session Info */}
        <div className="text-sm text-muted-foreground border-t pt-2">
          <p><strong>Session ID:</strong> {sessionId}</p>
          <p><strong>Descrição:</strong> {qrDescription}</p>
        </div>
      </div>
    </Card>
  );
};

export default BasicQRCodeGenerator;