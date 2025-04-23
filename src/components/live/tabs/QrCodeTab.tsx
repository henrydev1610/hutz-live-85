
import { useState } from "react";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useSettingsStore } from "@/hooks/use-settings-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const fontOptions = [
  "Arial", "Verdana", "Helvetica", "Tahoma", "Trebuchet MS", 
  "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT",
  "Impact", "Comic Sans MS", "Lucida Sans", "Palatino", "Bookman", 
  "Copperplate", "Papyrus", "Monaco", "Consolas", "Lucida Console",
  "Calibri", "Candara", "Franklin Gothic", "Century Gothic", "Segoe UI",
  "Open Sans", "Roboto", "Lato", "Montserrat", "Raleway"
];

const colorOptions = [
  "#FFFFFF", "#F3F4F6", "#E5E7EB", "#D1D5DB", "#9CA3AF",
  "#6B7280", "#4B5563", "#374151", "#1F2937", "#111827",
  "#8B5CF6", "#A78BFA", "#C4B5FD", "#EDE9FE", "#DDD6FE", 
  "#EF4444", "#F87171", "#FCA5A5", "#FEE2E2", "#3B82F6", 
  "#60A5FA", "#93C5FD", "#DBEAFE", "#10B981", "#34D399", 
  "#6EE7B7", "#D1FAE5", "#F59E0B", "#FBBF24", "#FCD34D"
];

const QrCodeTab = () => {
  const { sessionId, createSession, isSessionActive } = useSessionManager();
  const { qrCode, updateQrCode, toggleQrCodeVisibility } = useSettingsStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const newSessionId = createSession();
      
      if (newSessionId) {
        toast({
          title: "QR Code gerado",
          description: `Sessão criada com ID: ${newSessionId.substring(0, 8)}...`,
        });
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Erro ao gerar QR Code",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
        <Button 
          onClick={generateQRCode} 
          disabled={isGenerating}
          className="flex-1"
        >
          <QrCode className="mr-2 h-4 w-4" /> 
          {isSessionActive ? "Gerar Novo QR Code" : "Gerar QR Code"}
        </Button>
        
        <Button 
          variant={qrCode.isVisible ? "default" : "outline"} 
          onClick={toggleQrCodeVisibility}
          disabled={!isSessionActive}
        >
          {qrCode.isVisible ? (
            <>
              <EyeOff className="mr-2 h-4 w-4" /> Ocultar QR Code
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" /> Exibir QR Code
            </>
          )}
        </Button>
      </div>
      
      <div>
        <Label htmlFor="qrSize">Tamanho do QR Code</Label>
        <Slider 
          id="qrSize"
          defaultValue={[qrCode.size]}
          min={80}
          max={300}
          step={10}
          disabled={!isSessionActive}
          onValueChange={(value) => updateQrCode({ size: value[0] })}
          className="my-4"
        />
        <div className="flex justify-between text-xs">
          <span>Pequeno</span>
          <span>Grande</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="qrText">Texto do QR Code</Label>
          <Input 
            id="qrText" 
            value={qrCode.text} 
            onChange={(e) => updateQrCode({ text: e.target.value })}
            disabled={!isSessionActive}
            placeholder="Digite o texto a ser exibido junto ao QR Code"
            className="mt-1"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qrFont">Fonte do Texto</Label>
            <Select 
              disabled={!isSessionActive}
              value={qrCode.fontFamily}
              onValueChange={(value) => updateQrCode({ fontFamily: value })}
            >
              <SelectTrigger id="qrFont" className="mt-1">
                <SelectValue placeholder="Selecione uma fonte" />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((font) => (
                  <SelectItem key={font} value={font}>
                    <span style={{ fontFamily: font }}>{font}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Cor do Texto</Label>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {colorOptions.slice(0, 10).map((color) => (
                <button
                  key={color}
                  className={`w-full aspect-square rounded-md cursor-pointer transition-all ${
                    qrCode.textColor === color ? "ring-2 ring-white scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => updateQrCode({ textColor: color })}
                  disabled={!isSessionActive}
                  aria-label={`Cor ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        {isSessionActive && (
          <div className="p-3 bg-muted rounded-md text-sm">
            <p className="text-muted-foreground">
              Dica: O QR Code pode ser movido arrastando-o na pré-visualização.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrCodeTab;
