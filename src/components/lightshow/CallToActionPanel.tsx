
import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CallToActionType } from "@/types/lightshow";
import { ImageIcon, Link, Ticket, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface CallToActionPanelProps {
  callToAction: {
    type: CallToActionType;
    imageUrl?: string;
    buttonText?: string;
    externalUrl?: string;
    couponCode?: string;
  };
  onContentChange: (content: Partial<{
    type: CallToActionType;
    imageUrl?: string;
    buttonText?: string;
    externalUrl?: string;
    couponCode?: string;
  }>) => void;
  onAddToTimeline: () => void;
}

const CallToActionPanel = ({
  callToAction,
  onContentChange,
  onAddToTimeline
}: CallToActionPanelProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      
      onContentChange({ imageUrl });
      
      toast({
        title: "Imagem adicionada",
        description: "A imagem foi carregada com sucesso.",
      });
      
      // Reset the input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-black/30">
        <CardHeader>
          <CardTitle>Chamada para Ação</CardTitle>
          <CardDescription>
            Configure uma chamada para exibir ao fim da música
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={callToAction.type} onValueChange={(value) => onContentChange({ type: value as CallToActionType })}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="image">
                <ImageIcon className="h-4 w-4 mr-2" />
                Imagem
              </TabsTrigger>
              <TabsTrigger value="imageWithButton">
                <Link className="h-4 w-4 mr-2" />
                Link
              </TabsTrigger>
              <TabsTrigger value="coupon">
                <Ticket className="h-4 w-4 mr-2" />
                Cupom
              </TabsTrigger>
            </TabsList>
            
            {/* Hidden file input used by all tabs */}
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
            
            <TabsContent value="image" className="space-y-4">
              <div className="space-y-2">
                <Label>Imagem</Label>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleUploadClick} 
                    variant="outline" 
                    className="flex-1 border-dashed border-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Carregar Imagem
                  </Button>
                </div>
              </div>
              
              {callToAction.imageUrl && (
                <div className="mt-4 border border-white/10 rounded-md p-2 flex items-center justify-center h-40">
                  <img 
                    src={callToAction.imageUrl} 
                    alt="Prévia" 
                    className="max-h-full object-contain"
                    onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagem+Inválida'}
                  />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="imageWithButton" className="space-y-4">
              <div className="space-y-2">
                <Label>Imagem</Label>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleUploadClick} 
                    variant="outline" 
                    className="flex-1 border-dashed border-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Carregar Imagem
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="button-text">Texto do Botão</Label>
                <Input 
                  id="button-text" 
                  placeholder="Clique Aqui" 
                  value={callToAction.buttonText || ''}
                  onChange={(e) => onContentChange({ buttonText: e.target.value })}
                  className="bg-black/20 border-white/10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="external-url">URL Externa</Label>
                <Input 
                  id="external-url" 
                  placeholder="https://exemplo.com" 
                  value={callToAction.externalUrl || ''}
                  onChange={(e) => onContentChange({ externalUrl: e.target.value })}
                  className="bg-black/20 border-white/10"
                />
              </div>
              
              {callToAction.imageUrl && (
                <div className="mt-4 border border-white/10 rounded-md p-2 flex flex-col items-center justify-center h-48">
                  <img 
                    src={callToAction.imageUrl} 
                    alt="Prévia" 
                    className="max-h-32 object-contain mb-2"
                    onError={(e) => (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagem+Inválida'}
                  />
                  <Button size="sm" variant="secondary">
                    {callToAction.buttonText || "Clique Aqui"}
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="coupon" className="space-y-4">
              <div className="space-y-2">
                <Label>Imagem (opcional)</Label>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleUploadClick} 
                    variant="outline" 
                    className="flex-1 border-dashed border-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Carregar Imagem
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Código do Cupom</Label>
                <Input 
                  id="coupon-code" 
                  placeholder="CUPOM20" 
                  value={callToAction.couponCode || ''}
                  onChange={(e) => onContentChange({ couponCode: e.target.value })}
                  className="bg-black/20 border-white/10"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coupon-url">URL de Resgate</Label>
                <Input 
                  id="coupon-url" 
                  placeholder="https://exemplo.com/resgate" 
                  value={callToAction.externalUrl || ''}
                  onChange={(e) => onContentChange({ externalUrl: e.target.value })}
                  className="bg-black/20 border-white/10"
                />
              </div>
              
              <div className="mt-4 border border-white/10 rounded-md p-4 flex flex-col items-center justify-center">
                {callToAction.imageUrl && (
                  <img 
                    src={callToAction.imageUrl} 
                    alt="Prévia" 
                    className="max-h-20 object-contain mb-2"
                  />
                )}
                <div className="text-lg font-bold mb-2">Cupom de Desconto</div>
                <div className="bg-white/10 px-6 py-3 rounded-md font-mono text-xl font-bold mb-3">
                  {callToAction.couponCode || "CUPOM20"}
                </div>
                <Button size="sm" variant="secondary">
                  Resgatar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6">
            <Button 
              onClick={onAddToTimeline}
              className="w-full"
            >
              Adicionar Chamada ao Final da Música
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallToActionPanel;
