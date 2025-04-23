
import { useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Image, Link, Ticket } from "lucide-react";

const ImageAction = () => {
  const { actionSettings, updateActionSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    
    // Create a URL for the image file
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateActionSettings({
          type: 'image',
          imageUrl: event.target.result.toString()
        });
      }
      setIsLoading(false);
    };
    
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="action-image">Imagem Final</Label>
        <Input 
          id="action-image" 
          type="file" 
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isLoading}
        />
      </div>
      
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="action-link">Link (opcional)</Label>
        <div className="flex gap-2">
          <Input 
            id="action-link"
            type="url"
            placeholder="https://exemplo.com"
            value={actionSettings.linkUrl || ''}
            onChange={(e) => updateActionSettings({ linkUrl: e.target.value })}
          />
        </div>
      </div>
      
      {actionSettings.imageUrl && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center">
              <div className="w-40 h-40 overflow-hidden rounded-md">
                <img 
                  src={actionSettings.imageUrl} 
                  alt="Imagem final" 
                  className="w-full h-full object-contain"
                />
              </div>
              {actionSettings.linkUrl && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Link className="h-3 w-3" />
                  <span className="truncate">{actionSettings.linkUrl}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const CouponAction = () => {
  const { actionSettings, updateActionSettings } = useSettingsStore();

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="coupon-code">Código do Cupom</Label>
        <Input 
          id="coupon-code"
          value={actionSettings.couponCode || ''}
          onChange={(e) => updateActionSettings({ 
            type: 'coupon',
            couponCode: e.target.value 
          })}
          placeholder="EX: PROMO20"
        />
      </div>
      
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="coupon-text">Texto do Cupom</Label>
        <Input 
          id="coupon-text"
          value={actionSettings.text || ''}
          onChange={(e) => updateActionSettings({ text: e.target.value })}
          placeholder="Ex: 20% de desconto em sua próxima compra!"
        />
      </div>
      
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="coupon-link">Link do Cupom (opcional)</Label>
        <Input 
          id="coupon-link"
          type="url"
          value={actionSettings.linkUrl || ''}
          onChange={(e) => updateActionSettings({ linkUrl: e.target.value })}
          placeholder="https://exemplo.com/cupom"
        />
      </div>
      
      {actionSettings.couponCode && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center">
              <div className="bg-muted p-4 rounded-md flex items-center gap-2">
                <Ticket className="h-5 w-5 text-accent" />
                <span className="font-mono font-bold">{actionSettings.couponCode}</span>
              </div>
              {actionSettings.text && (
                <p className="mt-2 text-sm text-center">{actionSettings.text}</p>
              )}
              {actionSettings.linkUrl && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Link className="h-3 w-3" />
                  <span className="truncate">{actionSettings.linkUrl}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const NoAction = () => {
  const { updateActionSettings } = useSettingsStore();
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <p className="text-center text-muted-foreground mb-4">
        Nenhuma ação será exibida ao finalizar a transmissão.
      </p>
      <Button 
        variant="outline"
        onClick={() => updateActionSettings({ type: 'none' })}
      >
        Confirmar
      </Button>
    </div>
  );
};

const ActionTab = () => {
  const { actionSettings } = useSettingsStore();
  
  return (
    <div className="space-y-4">
      <Tabs defaultValue={actionSettings.type || "none"}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="image">
            <Image className="mr-2 h-4 w-4" /> Imagem
          </TabsTrigger>
          <TabsTrigger value="coupon">
            <Ticket className="mr-2 h-4 w-4" /> Cupom
          </TabsTrigger>
          <TabsTrigger value="none">Nenhuma</TabsTrigger>
        </TabsList>
        <TabsContent value="image" className="mt-4">
          <ImageAction />
        </TabsContent>
        <TabsContent value="coupon" className="mt-4">
          <CouponAction />
        </TabsContent>
        <TabsContent value="none" className="mt-4">
          <NoAction />
        </TabsContent>
      </Tabs>
      
      <div className="p-4 bg-muted rounded-md mt-6">
        <p className="text-sm text-muted-foreground">
          Esta ação será exibida para os participantes após finalizar a transmissão ou quando eles saírem da sessão.
        </p>
      </div>
    </div>
  );
};

export default ActionTab;
