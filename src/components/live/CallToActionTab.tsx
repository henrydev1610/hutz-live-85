
import { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLiveSession } from '@/hooks/useLiveSession';

const CallToActionTab = () => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { 
    callToAction,
    setCallToActionType,
    setCallToActionImage,
    setCallToActionText,
    setCallToActionLink
  } = useLiveSession();

  const handleImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCallToActionImage(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        Configure a ação que será exibida para os participantes quando a transmissão terminar.
      </p>
      
      <Tabs
        value={callToAction.type}
        onValueChange={setCallToActionType}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="image">Imagem</TabsTrigger>
          <TabsTrigger value="coupon">Cupom</TabsTrigger>
        </TabsList>
        
        <TabsContent value="image" className="space-y-4">
          <div>
            <Label className="mb-2 block">Imagem de Call to Action</Label>
            <Input 
              type="file" 
              ref={imageInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
            
            {callToAction.image ? (
              <div className="mt-2 relative">
                <img 
                  src={callToAction.image} 
                  alt="Call to Action Preview" 
                  className="w-full rounded-md max-h-52 object-contain bg-black/30"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={handleImageUpload}
                >
                  Trocar imagem
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                onClick={handleImageUpload} 
                className="w-full"
              >
                Carregar imagem
              </Button>
            )}
          </div>
          
          <div>
            <Label htmlFor="cta-link">Link (opcional)</Label>
            <Input 
              id="cta-link" 
              placeholder="https://" 
              value={callToAction.link || ''}
              onChange={e => setCallToActionLink(e.target.value)}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="coupon" className="space-y-4">
          <div>
            <Label htmlFor="coupon-text">Texto do Cupom</Label>
            <Textarea 
              id="coupon-text" 
              placeholder="Digite o texto do cupom promocional"
              value={callToAction.text || ''}
              onChange={e => setCallToActionText(e.target.value)}
              rows={3}
            />
          </div>
          
          <div>
            <Label htmlFor="coupon-link">Link do Cupom (opcional)</Label>
            <Input 
              id="coupon-link" 
              placeholder="https://" 
              value={callToAction.link || ''}
              onChange={e => setCallToActionLink(e.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CallToActionTab;
