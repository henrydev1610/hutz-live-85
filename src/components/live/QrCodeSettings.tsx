import { QrCode, ExternalLink, Check, Copy, Minus, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface QrCodeSettingsProps {
  qrCodeGenerated: boolean;
  qrCodeVisible: boolean;
  qrCodeURL: string;
  qrCodePosition: { x: number; y: number; width: number; height: number };
  setQrCodePosition: React.Dispatch<React.SetStateAction<{ x: number; y: number; width: number; height: number }>>;
  finalAction: 'none' | 'image' | 'coupon';
  setFinalAction: (action: 'none' | 'image' | 'coupon') => void;
  finalActionImage: string | null;
  setFinalActionImage: (url: string) => void;
  finalActionLink: string;
  setFinalActionLink: (url: string) => void;
  finalActionCoupon: string;
  setFinalActionCoupon: (code: string) => void;
  onGenerateQRCode: () => void;
  onQRCodeToTransmission: () => void;
}

const QrCodeSettings = ({
  qrCodeGenerated,
  qrCodeVisible,
  qrCodeURL,
  qrCodePosition,
  setQrCodePosition,
  finalAction,
  setFinalAction,
  finalActionImage,
  setFinalActionImage,
  finalActionLink,
  setFinalActionLink,
  finalActionCoupon,
  setFinalActionCoupon,
  onGenerateQRCode,
  onQRCodeToTransmission
}: QrCodeSettingsProps) => {
  const { toast } = useToast();

  const increaseQrSize = () => {
    const newSize = Math.min(qrCodePosition.width + 20, 300);
    setQrCodePosition(prev => ({
      ...prev,
      width: newSize,
      height: newSize
    }));
  };

  const decreaseQrSize = () => {
    const newSize = Math.max(qrCodePosition.width - 20, 80);
    setQrCodePosition(prev => ({
      ...prev,
      width: newSize,
      height: newSize
    }));
  };

  const copyQrCodeUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrCodeURL).then(() => {
        toast({
          title: "Link copiado",
          description: "URL do participante copiado para a área de transferência."
        });
      }).catch(err => {
        console.error("Clipboard error:", err);
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  };
  
  const fallbackCopy = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = qrCodeURL;
      
      // Avoid scrolling to bottom
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        toast({
          title: "Link copiado",
          description: "URL do participante copiado para a área de transferência."
        });
      } catch (err) {
        console.error("Fallback copy failed:", err);
        toast({
          title: "Erro ao copiar",
          description: "Por favor, selecione e copie o link manualmente.",
          variant: "destructive"
        });
      }
      
      document.body.removeChild(textArea);
    } catch (err) {
      console.error("Fallback copy error:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
      <div>
        <div className="flex gap-2">
          <Button 
            variant={qrCodeGenerated ? "outline" : "default"}
            onClick={() => {
              console.log("🔴 BOTAO CRIAR NOVA SALA CLICADO!");
              toast({
                title: "Botão clicado",
                description: "Iniciando geração de QR Code...",
              });
              onGenerateQRCode();
            }}
            className={qrCodeGenerated ? "border-white/20" : ""}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {qrCodeGenerated ? "Regenerar Sala" : "Criar Nova Sala"}
          </Button>
          
          <Button
            variant="outline"
            onClick={onQRCodeToTransmission}
            disabled={!qrCodeGenerated}
            className="border-white/20"
          >
            {qrCodeVisible ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                QR Code Ativo
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ativar QR Code
              </>
            )}
          </Button>
        </div>
        
        {qrCodeGenerated && (
          <div className="mt-4 p-4 bg-secondary/20 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-green-400">
                ✅ Sala Criada com Sucesso
              </Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs"
                onClick={copyQrCodeUrl}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar Link
              </Button>
            </div>
            
            <div className="text-xs break-all bg-black/40 p-3 rounded border font-mono">
              {qrCodeURL}
            </div>
            
            <div className="mt-2 text-xs text-muted-foreground">
              💡 Compartilhe este link ou o QR Code com os participantes
            </div>
            
            <div className="mt-4 space-y-4">
              <div>
                <Label className="mb-2 block">
                  Tamanho do QR Code
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={decreaseQrSize}
                    disabled={qrCodePosition.width <= 80}
                    className="border-white/20"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2 min-w-[60px] text-center">
                    {qrCodePosition.width}px
                  </span>
                  <Button
                    variant="outline"
                    onClick={increaseQrSize}
                    disabled={qrCodePosition.width >= 300}
                    className="border-white/20"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="block mb-2">
                  Ação ao Finalizar Transmissão
                </Label>
                <Select value={finalAction} onValueChange={(value: 'none' | 'image' | 'coupon') => setFinalAction(value)}>
                  <SelectTrigger className="hutz-input">
                    <SelectValue placeholder="Escolher ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma ação</SelectItem>
                    <SelectItem value="image">Mostrar Imagem Clicável</SelectItem>
                    <SelectItem value="coupon">Mostrar Cupom</SelectItem>
                  </SelectContent>
                </Select>
                
                {finalAction === 'image' && (
                  <div className="mt-2">
                    <Input
                      placeholder="Link da imagem (URL)"
                      value={finalActionImage || ''}
                      onChange={(e) => setFinalActionImage(e.target.value)}
                      className="mb-2 hutz-input"
                    />
                    <Input
                      placeholder="Link para redirecionamento"
                      value={finalActionLink}
                      onChange={(e) => setFinalActionLink(e.target.value)}
                      className="hutz-input"
                    />
                  </div>
                )}
                
                {finalAction === 'coupon' && (
                  <div className="mt-2">
                    <Input
                      placeholder="Código do cupom"
                      value={finalActionCoupon}
                      onChange={(e) => setFinalActionCoupon(e.target.value)}
                      className="mb-2 hutz-input"
                    />
                    <Input
                      placeholder="Link para redirecionamento (opcional)"
                      value={finalActionLink}
                      onChange={(e) => setFinalActionLink(e.target.value)}
                      className="hutz-input"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QrCodeSettings;
