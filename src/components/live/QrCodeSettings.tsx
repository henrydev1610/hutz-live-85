
import { QrCode, ExternalLink, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QrCodeSettingsProps {
  qrCodeGenerated: boolean;
  qrCodeVisible: boolean;
  qrCodeURL: string;
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
      <div>
        <div className="flex gap-2">
          <Button 
            variant={qrCodeGenerated ? "outline" : "default"}
            onClick={onGenerateQRCode}
            className={qrCodeGenerated ? "border-white/20" : ""}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {qrCodeGenerated ? "Regenerar QR Code" : "Gerar QR Code"}
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
                QR Code Inserido
              </>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Inserir QR Code
              </>
            )}
          </Button>
        </div>
        
        {qrCodeGenerated && (
          <div className="mt-2">
            <Label className="block mb-1 text-xs">
              Link do QR Code:
            </Label>
            <div className="text-xs break-all bg-secondary/40 p-2 rounded">
              {qrCodeURL}
            </div>
            
            <div className="mt-4">
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
        )}
      </div>
    </div>
  );
};

export default QrCodeSettings;
