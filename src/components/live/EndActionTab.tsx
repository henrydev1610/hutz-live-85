
import { useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const EndActionTab = () => {
  const { actionSettings, updateActionSettings } = useSettingsStore();
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleActionTypeChange = (value: string) => {
    updateActionSettings({ 
      type: value as 'none' | 'image' | 'coupon',
      // Reset other fields when changing type
      ...(value === 'none' && { imageUrl: undefined, couponCode: undefined, text: undefined, linkUrl: undefined })
    });
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive'
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter menos que 5MB.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setImageLoading(true);
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          updateActionSettings({ imageUrl: event.target.result });
          setImageLoading(false);
        }
      };
      
      reader.onerror = () => {
        toast({
          title: 'Erro ao carregar',
          description: 'Não foi possível carregar a imagem.',
          variant: 'destructive'
        });
        setImageLoading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: 'Erro ao processar',
        description: 'Houve um erro ao processar a imagem.',
        variant: 'destructive'
      });
      setImageLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">Tipo de ação de finalização</Label>
        <RadioGroup
          value={actionSettings.type}
          onValueChange={handleActionTypeChange}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="none" />
            <Label htmlFor="none">Nenhuma ação</Label>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="image" id="image" />
            <Label htmlFor="image">Mostrar imagem</Label>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="coupon" id="coupon" />
            <Label htmlFor="coupon">Mostrar cupom</Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* Image Upload Section */}
      {actionSettings.type === 'image' && (
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Imagem</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="action-image"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageLoading}
                className="flex gap-2 items-center"
              >
                <Upload className="h-4 w-4" />
                Carregar Imagem
              </Button>
            </div>
          </div>
          
          {actionSettings.imageUrl && (
            <div>
              <Label className="mb-2 block">Pré-visualização</Label>
              <div className="w-full max-h-40 bg-secondary/30 rounded-md overflow-hidden">
                <img 
                  src={actionSettings.imageUrl} 
                  alt="Action image preview" 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
          )}
          
          <div>
            <Label htmlFor="link-url">Link (opcional)</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={actionSettings.linkUrl || ''}
              onChange={(e) => updateActionSettings({ linkUrl: e.target.value })}
            />
          </div>
        </div>
      )}
      
      {/* Coupon Section */}
      {actionSettings.type === 'coupon' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="coupon-code">Código do cupom</Label>
            <Input
              id="coupon-code"
              placeholder="Ex: DESCONTO20"
              value={actionSettings.couponCode || ''}
              onChange={(e) => updateActionSettings({ couponCode: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="coupon-text">Descrição do cupom (opcional)</Label>
            <Textarea
              id="coupon-text"
              placeholder="Ex: 20% de desconto em todos os produtos"
              value={actionSettings.text || ''}
              onChange={(e) => updateActionSettings({ text: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="coupon-link">Link do cupom (opcional)</Label>
            <Input
              id="coupon-link"
              placeholder="https://example.com/redeem"
              value={actionSettings.linkUrl || ''}
              onChange={(e) => updateActionSettings({ linkUrl: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EndActionTab;
