
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Film, User, Image, Palette } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const TelaoPage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const { toast } = useToast();

  const handleGenerateQRCode = () => {
    setQrCodeGenerated(true);
    toast({
      title: "QR Code gerado",
      description: "QR Code gerado com sucesso. Compartilhe com os participantes.",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Telão</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 h-full">
            <CardHeader>
              <CardTitle>Controle de Transmissão</CardTitle>
              <CardDescription>
                Gerencie participantes, layout e aparência da sua transmissão ao vivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="participants" className="w-full">
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="participants">
                    <Users className="h-4 w-4 mr-2" />
                    Participantes
                  </TabsTrigger>
                  <TabsTrigger value="layout">
                    <MonitorPlay className="h-4 w-4 mr-2" />
                    Layout
                  </TabsTrigger>
                  <TabsTrigger value="appearance">
                    <Palette className="h-4 w-4 mr-2" />
                    Aparência
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="participants" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Array(12).fill(0).map((_, i) => (
                      <Card key={i} className={`bg-secondary/60 border border-white/10 ${i < 3 ? 'border-accent' : ''}`}>
                        <CardContent className="p-4 text-center">
                          <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                            <User className="h-8 w-8 text-white/30" />
                          </div>
                          <p className="text-sm font-medium truncate">
                            {i < 3 ? `Participante ${i + 1}` : 'Aguardando...'}
                          </p>
                          {i < 3 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-1 h-6 text-xs text-white/60 hover:text-white"
                            >
                              Remover
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="layout" className="space-y-4">
                  <div className="space-y-6">
                    <div>
                      <Label className="mb-2 block">
                        Número de participantes na tela
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 4, 6, 9, 12].map((num) => (
                          <Button
                            key={num}
                            variant={participantCount === num ? "default" : "outline"}
                            onClick={() => setParticipantCount(num)}
                            className={participantCount === num ? "bg-accent text-white" : "border-white/20"}
                          >
                            {num}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">
                        Posição do QR Code
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          className="bg-accent text-white"
                        >
                          Esquerda
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/20"
                        >
                          Direita
                        </Button>
                        <Button
                          variant="outline"
                          className="border-white/20"
                        >
                          Sem QR Code
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description-text" className="mb-2 block">
                        Texto de Descrição
                      </Label>
                      <Input
                        id="description-text"
                        placeholder="Escaneie o QR Code para participar"
                        className="hutz-input"
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="appearance" className="space-y-4">
                  <div className="space-y-6">
                    <div>
                      <Label className="mb-2 block">Cor de Fundo</Label>
                      <div className="grid grid-cols-6 gap-2">
                        {['#000000', '#0F172A', '#18181B', '#292524', '#1E1E1E', '#1A1A1A'].map(color => (
                          <div
                            key={color}
                            className="w-full aspect-square rounded-md cursor-pointer hover:scale-110 transition-transform border border-white/20"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="bg-image-upload" className="mb-2 block">
                        Imagem de Fundo
                      </Label>
                      <Button id="bg-image-upload" className="w-full hutz-button-secondary">
                        <Image className="h-4 w-4 mr-2" />
                        Carregar Imagem
                      </Button>
                    </div>
                    
                    <div>
                      <Label htmlFor="final-action" className="mb-2 block">
                        Ação ao Finalizar
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="no-action" name="finalAction" className="h-4 w-4" />
                          <Label htmlFor="no-action">Nenhuma ação</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="show-image" name="finalAction" className="h-4 w-4" defaultChecked />
                          <Label htmlFor="show-image">Mostrar imagem</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="show-coupon" name="finalAction" className="h-4 w-4" />
                          <Label htmlFor="show-coupon">Mostrar cupom</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between pt-4 border-t border-white/10">
              <Button variant="outline" className="border-white/20">
                Cancelar
              </Button>
              <Button className="hutz-button-accent">
                <Film className="h-4 w-4 mr-2" />
                Iniciar Transmissão
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>QR Code da Sessão</CardTitle>
              <CardDescription>
                Gere um QR Code para os participantes se conectarem
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="w-full aspect-square bg-secondary/60 rounded-lg flex items-center justify-center mb-4">
                {qrCodeGenerated ? (
                  <div className="w-3/4 h-3/4 bg-white p-4 rounded-lg flex items-center justify-center">
                    <QrCode className="h-full w-full text-black" />
                  </div>
                ) : (
                  <QrCode className="h-16 w-16 text-white/30" />
                )}
              </div>
              
              {!qrCodeGenerated ? (
                <Button 
                  onClick={handleGenerateQRCode} 
                  className="w-full hutz-button-primary"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </Button>
              ) : (
                <div className="space-y-2 w-full">
                  <Button className="w-full hutz-button-secondary">
                    Compartilhar QR Code
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full border-white/20"
                    onClick={() => setQrCodeGenerated(false)}
                  >
                    Gerar Novo QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Separator className="my-6 bg-white/10" />
          
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Veja como ficará sua transmissão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black/50 rounded-lg p-4 flex items-center justify-center">
                <div className="text-white/40 text-center">
                  <MonitorPlay className="h-12 w-12 mx-auto mb-2" />
                  <p>Pré-visualização da transmissão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TelaoPage;
