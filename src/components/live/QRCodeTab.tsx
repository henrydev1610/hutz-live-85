
import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import QRCode from 'qrcode';
import Draggable from 'react-draggable';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

// List of available fonts
const FONTS = [
  'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 
  'Times New Roman', 'Georgia', 'Garamond', 'Courier New', 'Brush Script MT',
  'Impact', 'Comic Sans MS', 'Lucida Sans', 'Palatino', 'Bookman',
  'Avant Garde', 'Didot', 'Optima', 'Futura', 'Franklin Gothic', 
  'Copperplate', 'Papyrus', 'Monaco', 'Rockwell', 'Century Gothic',
  'Candara', 'Consolas', 'Constantia', 'Corbel', 'Segoe UI'
];

// Same color palette from LayoutTab
const COLORS = [
  '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666',
  '#808080', '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6',
  '#FF0000', '#FF6600', '#FFCC00', '#33CC00', '#00CCFF',
  '#0066FF', '#3300FF', '#9900FF', '#FF00FF', '#FF0099',
  '#663300', '#996633', '#CCCC33', '#669900', '#00CC66',
  '#0099CC', '#3366CC', '#6633CC', '#993399', '#CC0066',
];

interface QRCodeTabProps {
  sessionId: string;
}

const QRCodeTab: React.FC<QRCodeTabProps> = ({ sessionId }) => {
  const { qrCodeSettings, updateQRCodeSettings } = useSettingsStore();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [hostUrl, setHostUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR Code when sessionId changes
  useEffect(() => {
    if (sessionId) {
      const generateQRCode = async () => {
        const url = `${window.location.origin}/participant?sessionId=${sessionId}`;
        setHostUrl(url);
        
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            width: 300,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          
          setQrCodeUrl(dataUrl);
        } catch (err) {
          console.error("Error generating QR code:", err);
        }
      };
      
      generateQRCode();
    }
  }, [sessionId]);

  // Toggle QR code visibility in the broadcast
  const toggleQrCodeVisibility = () => {
    updateQRCodeSettings({ visible: !qrCodeSettings.visible });
  };

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateQRCodeSettings({ text: e.target.value });
  };

  // Handle font family change
  const handleFontChange = (value: string) => {
    updateQRCodeSettings({ fontFamily: value });
  };

  // Handle font color change
  const handleColorChange = (color: string) => {
    updateQRCodeSettings({ fontColor: color });
  };

  // Handle size change
  const handleSizeChange = (values: number[]) => {
    updateQRCodeSettings({ size: values[0] });
  };

  // Generate new QR code (regenerates the sessionId)
  const regenerateQrCode = () => {
    // This functionality is handled in the parent component
    // by creating a new session
  };

  return (
    <div className="space-y-6">
      {/* QR Code Display */}
      <div className="p-4 bg-white rounded-lg flex justify-center">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="QR Code" className="max-w-full h-auto" />
        ) : (
          <div className="w-32 h-32 bg-gray-200 animate-pulse rounded"></div>
        )}
      </div>
      
      {/* Session URL */}
      <div className="flex space-x-2">
        <Input value={hostUrl} readOnly className="font-mono text-xs" />
        <Button
          variant="outline"
          onClick={() => navigator.clipboard.writeText(hostUrl)}
        >
          Copiar
        </Button>
      </div>
      
      {/* QR Code Controls */}
      <div className="flex space-x-2">
        <Button
          onClick={toggleQrCodeVisibility}
          variant={qrCodeSettings.visible ? "default" : "outline"}
          className="flex items-center gap-2"
        >
          {qrCodeSettings.visible ? (
            <>
              <EyeOff className="h-4 w-4" />
              Ocultar QR Code
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Mostrar QR Code
            </>
          )}
        </Button>
        <Button
          onClick={regenerateQrCode}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Gerar Novo
        </Button>
      </div>
      
      {/* QR Code Text Settings */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="qr-text">Texto do QR Code</Label>
          <Input
            id="qr-text"
            value={qrCodeSettings.text}
            onChange={handleTextChange}
            placeholder="Escaneie para participar"
          />
        </div>
        
        <div>
          <Label htmlFor="qr-font">Fonte do Texto</Label>
          <Select
            value={qrCodeSettings.fontFamily}
            onValueChange={handleFontChange}
          >
            <SelectTrigger id="qr-font">
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((font) => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Cor do Texto</Label>
          <div className="grid grid-cols-10 gap-2 mt-2">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`w-full aspect-square rounded-md border ${
                  color === qrCodeSettings.fontColor ? 'border-accent' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                aria-label={`Cor ${color}`}
              />
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex justify-between">
            <Label>Tamanho do QR Code</Label>
            <span className="text-sm font-medium">{qrCodeSettings.size}px</span>
          </div>
          <Slider 
            value={[qrCodeSettings.size]} 
            min={100} 
            max={300} 
            step={10} 
            onValueChange={handleSizeChange}
          />
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground mt-4">
        Nota: Na visualização da transmissão, você pode arrastar o QR code para posicioná-lo.
      </div>
    </div>
  );
};

export default QRCodeTab;
