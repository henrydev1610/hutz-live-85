import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode } from 'lucide-react';
import { useLiveSession } from '@/hooks/useLiveSession';
import { useToast } from '@/hooks/use-toast';

const QRCodeTab = () => {
  const { toast } = useToast();
  const { 
    generateSessionId,
    showQRCode,
    hideQRCode,
    setQRCodeText,
    setQrCodeFont,
    setQrCodeColor,
    sessionId,
    qrCode,
    qrCodeText,
    qrCodeFont,
    qrCodeColor
  } = useLiveSession();

  // Font options
  const fontOptions = [
    'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 
    'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Tahoma', 
    'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Lucida Sans', 'Lucida Console',
    'Monaco', 'Brush Script MT', 'Copperplate', 'Papyrus', 'Gill Sans',
    'Century Gothic', 'Candara', 'Optima', 'Calibri', 'Franklin Gothic',
    'Futura', 'Rockwell', 'Didot', 'Baskerville', 'Consolas'
  ];

  // Color options (same as in LayoutTab)
  const colorOptions = [
    '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666', 
    '#1E3A8A', '#1D4ED8', '#0EA5E9', '#06B6D4', '#14B8A6',
    '#10B981', '#22C55E', '#84CC16', '#EAB308', '#F59E0B',
    '#F97316', '#EF4444', '#DC2626', '#B91C1C', '#7F1D1D',
    '#9333EA', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F472B6', '#FB7185', '#FFFFFF', '#F3F4F6', '#D1D5DB'
  ];

  const handleGenerateQRCode = () => {
    generateSessionId();
    toast({
      title: "QR Code gerado",
      description: "Novo código de sessão criado com sucesso"
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQRCodeText(e.target.value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        {sessionId ? (
          <div className="bg-white p-4 rounded-lg">
            <img 
              src={qrCode.image} 
              alt="QR Code da sessão" 
              className="w-40 h-40"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-40 h-40 bg-secondary/60 rounded-lg">
            <QrCode className="w-16 h-16 text-white/30" />
          </div>
        )}
        
        <div className="flex gap-3 w-full">
          <Button 
            onClick={handleGenerateQRCode} 
            className="flex-1"
          >
            Gerar QR Code
          </Button>
          
          {sessionId && (
            <Button 
              onClick={qrCode.visible ? hideQRCode : showQRCode}
              variant={qrCode.visible ? "destructive" : "default"}
              className="flex-1"
            >
              {qrCode.visible ? "Remover da Tela" : "Inserir na Tela"}
            </Button>
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <Label htmlFor="qrcode-text">Texto do QR Code</Label>
          <Input 
            id="qrcode-text" 
            placeholder="Digite o texto para exibir junto ao QR Code" 
            value={qrCodeText.text}
            onChange={handleTextChange}
          />
        </div>
        
        <div>
          <Label htmlFor="qrcode-font">Fonte do texto</Label>
          <Select value={qrCodeFont} onValueChange={setQrCodeFont}>
            <SelectTrigger id="qrcode-font">
              <SelectValue placeholder="Selecione a fonte" />
            </SelectTrigger>
            <SelectContent>
              {fontOptions.map(font => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Cor do texto</Label>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {colorOptions.slice(0, 18).map((color) => (
              <button
                key={color}
                className={`w-full aspect-square rounded-md border ${qrCodeColor === color ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
                onClick={() => setQrCodeColor(color)}
                aria-label={`Selecionar cor ${color}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeTab;
