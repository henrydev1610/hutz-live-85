
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Film, User, Image, Palette, Check, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const TelaoPage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [participantList, setParticipantList] = useState<{id: string, name: string, active: boolean, selected: boolean}[]>([]);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState("#000000");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [finalAction, setFinalAction] = useState<'none' | 'image' | 'coupon'>('image');
  const [finalActionLink, setFinalActionLink] = useState("");
  const [finalActionImage, setFinalActionImage] = useState<string | null>(null);
  const [finalActionCoupon, setFinalActionCouponCode] = useState("");
  const { toast } = useToast();
  
  // Reference for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Simulate some mock participants when QR code is generated
    if (qrCodeGenerated) {
      const mockParticipants = [
        { id: "1", name: "Participante 1", active: true, selected: true },
        { id: "2", name: "Participante 2", active: true, selected: true },
        { id: "3", name: "Participante 3", active: true, selected: true },
      ];
      setParticipantList(prev => {
        // Only add if not already there
        if (prev.length < 3) {
          return mockParticipants;
        }
        return prev;
      });
    }
  }, [qrCodeGenerated]);

  const handleGenerateQRCode = () => {
    // Generate a unique session ID
    const sessionId = Math.random().toString(36).substring(2, 15);
    const baseURL = window.location.origin;
    const participantURL = `${baseURL}/participant/${sessionId}`;
    
    setQrCodeURL(participantURL);
    setQrCodeGenerated(true);
    toast({
      title: "QR Code gerado",
      description: "QR Code gerado com sucesso. Compartilhe com os participantes.",
    });
  };

  const handleParticipantSelect = (id: string) => {
    setParticipantList(prev => 
      prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  };

  const handleParticipantRemove = (id: string) => {
    setParticipantList(prev => prev.filter(p => p.id !== id));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBackgroundImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const selectedParticipantsCount = participantList.filter(p => p.selected).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Telão</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 h-full">
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle>Controle de Transmissão</CardTitle>
                <CardDescription>
                  Gerencie participantes, layout e aparência da sua transmissão ao vivo
                </CardDescription>
              </div>
              <Button className="hutz-button-accent">
                <Film className="h-4 w-4 mr-2" />
                Iniciar Transmissão
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="participants" className="w-full">
                <TabsList className="grid grid-cols-4 mb-6">
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
                  <TabsTrigger value="preview">
                    <Film className="h-4 w-4 mr-2" />
                    Pré-visualização
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="participants" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {participantList.map((participant, i) => (
                      <Card key={participant.id} className={`bg-secondary/60 border ${participant.selected ? 'border-accent' : 'border-white/10'}`}>
                        <CardContent className="p-4 text-center">
                          <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                            <User className="h-8 w-8 text-white/30" />
                          </div>
                          <p className="text-sm font-medium truncate">
                            {participant.name}
                          </p>
                          <div className="flex justify-center gap-2 mt-2">
                            <Button 
                              variant={participant.selected ? "default" : "outline"} 
                              size="sm" 
                              className={`h-8 ${participant.selected ? 'bg-accent text-white' : 'border-white/20'}`}
                              onClick={() => handleParticipantSelect(participant.id)}
                            >
                              {participant.selected ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Selecionado
                                </>
                              ) : 'Selecionar'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-white/60 hover:text-white"
                              onClick={() => handleParticipantRemove(participant.id)}
                            >
                              Remover
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Empty participant slots */}
                    {Array(12 - participantList.length).fill(0).map((_, i) => (
                      <Card key={`empty-${i}`} className="bg-secondary/60 border border-white/10">
                        <CardContent className="p-4 text-center">
                          <div className="aspect-video bg-black/40 rounded-md flex items-center justify-center mb-2">
                            <User className="h-8 w-8 text-white/30" />
                          </div>
                          <p className="text-sm font-medium truncate">
                            Aguardando...
                          </p>
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
                        {[1, 2, 4, 6, 9, 12, 16, 24].map((num) => (
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
                            className={`w-full aspect-square rounded-md cursor-pointer hover:scale-110 transition-transform border ${selectedBackgroundColor === color ? 'border-accent' : 'border-white/20'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedBackgroundColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="bg-image-upload" className="mb-2 block">
                        Imagem de Fundo
                      </Label>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        id="bg-image-upload" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileSelect}
                      />
                      <Button 
                        onClick={triggerFileInput} 
                        className="w-full hutz-button-secondary"
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Carregar Imagem
                      </Button>
                      
                      {backgroundImage && (
                        <div className="mt-2 relative">
                          <img 
                            src={backgroundImage} 
                            alt="Background preview" 
                            className="w-full h-auto rounded-md border border-white/20" 
                          />
                          <p className="text-xs text-white/60 mt-1">
                            A imagem será redimensionável na transmissão
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="final-action" className="mb-2 block">
                        Ação ao Finalizar
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="no-action" 
                            name="finalAction" 
                            className="h-4 w-4" 
                            checked={finalAction === 'none'}
                            onChange={() => setFinalAction('none')}
                          />
                          <Label htmlFor="no-action">Nenhuma ação</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="show-image" 
                            name="finalAction" 
                            className="h-4 w-4" 
                            checked={finalAction === 'image'}
                            onChange={() => setFinalAction('image')}
                          />
                          <Label htmlFor="show-image">Mostrar imagem</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            id="show-coupon" 
                            name="finalAction" 
                            className="h-4 w-4"
                            checked={finalAction === 'coupon'}
                            onChange={() => setFinalAction('coupon')}
                          />
                          <Label htmlFor="show-coupon">Mostrar cupom</Label>
                        </div>
                        
                        {finalAction !== 'none' && (
                          <div className="mt-3 ml-6 space-y-3">
                            <div>
                              <Label htmlFor="action-link" className="mb-1 block text-sm">
                                Link Externo (URL)
                              </Label>
                              <Input
                                id="action-link"
                                placeholder="https://exemplo.com"
                                value={finalActionLink}
                                onChange={(e) => setFinalActionLink(e.target.value)}
                                className="hutz-input"
                              />
                            </div>
                            
                            {finalAction === 'image' && (
                              <div>
                                <Label htmlFor="action-image" className="mb-1 block text-sm">
                                  Imagem
                                </Label>
                                <Button 
                                  variant="outline" 
                                  className="w-full border-white/20"
                                  onClick={() => {
                                    // Image selection logic would go here
                                    // For now, mock it with a placeholder
                                    setFinalActionImage('https://via.placeholder.com/300x150')
                                  }}
                                >
                                  <Image className="h-4 w-4 mr-2" />
                                  Selecionar imagem
                                </Button>
                                
                                {finalActionImage && (
                                  <div className="mt-2">
                                    <img 
                                      src={finalActionImage} 
                                      alt="Final action" 
                                      className="w-full h-auto rounded-md border border-white/20" 
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {finalAction === 'coupon' && (
                              <div>
                                <Label htmlFor="coupon-code" className="mb-1 block text-sm">
                                  Código do Cupom
                                </Label>
                                <Input
                                  id="coupon-code"
                                  placeholder="DESCONTO20"
                                  value={finalActionCoupon}
                                  onChange={(e) => setFinalActionCouponCode(e.target.value)}
                                  className="hutz-input"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="space-y-4">
                  <div className="aspect-video relative bg-black rounded-lg overflow-hidden">
                    {/* Background color or image */}
                    <div 
                      className="absolute inset-0" 
                      style={{
                        backgroundColor: backgroundImage ? 'transparent' : selectedBackgroundColor,
                      }}
                    >
                      {backgroundImage && (
                        <img 
                          src={backgroundImage} 
                          alt="Background" 
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    {/* Participants grid */}
                    <div className="absolute inset-0 p-4">
                      <div className={`grid grid-cols-${Math.ceil(Math.sqrt(participantCount))} gap-2 h-full`}>
                        {participantList
                          .filter(p => p.selected)
                          .slice(0, participantCount)
                          .map((participant, i) => (
                            <div key={participant.id} className="bg-black/40 rounded overflow-hidden flex items-center justify-center">
                              <User className="h-8 w-8 text-white/70" />
                            </div>
                          ))}
                        
                        {/* Empty slots */}
                        {Array(Math.max(0, participantCount - selectedParticipantsCount)).fill(0).map((_, i) => (
                          <div key={`empty-preview-${i}`} className="bg-black/20 rounded overflow-hidden flex items-center justify-center">
                            <User className="h-8 w-8 text-white/30" />
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* QR Code overlay */}
                    {qrCodeGenerated && (
                      <div className="absolute left-4 bottom-4 bg-white p-2 rounded-lg resize-both overflow-auto min-w-[100px] min-h-[100px] cursor-se-resize">
                        <div className="w-full h-full bg-white flex items-center justify-center">
                          <QrCode className="w-full h-full text-black" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center text-sm text-white/60">
                    <p>Esta é a pré-visualização de como ficará sua transmissão</p>
                    <p className="mt-1">Selecionado: {selectedParticipantsCount} de {participantCount} participantes</p>
                  </div>
                  
                  {selectedParticipantsCount > participantCount && (
                    <div className="p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-md">
                      <p className="text-sm text-white">
                        Atenção: Você selecionou {selectedParticipantsCount} participantes, mas o layout atual comporta apenas {participantCount}.
                        Somente os primeiros {participantCount} selecionados serão exibidos.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
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
                  
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="default" className="w-full hutz-button-primary mt-2">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Incluir na tela de transmissão
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Incluir QR Code na transmissão</SheetTitle>
                        <SheetDescription>
                          O QR Code será adicionado na tela de transmissão com a possibilidade de redimensionamento.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6">
                        <p className="text-sm text-white/70 mb-4">
                          Participantes que escanearem este QR Code terão acesso à câmera ativada e transmitida para sua tela.
                        </p>
                        
                        <div className="p-4 bg-secondary/60 rounded-lg">
                          <p className="text-xs text-white/60 mb-2">Link do QR Code:</p>
                          <div className="flex items-center gap-2">
                            <Input 
                              readOnly 
                              value={qrCodeURL} 
                              className="text-xs" 
                            />
                            <Button variant="outline" size="sm" className="shrink-0">
                              Copiar
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                          <Button>
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TelaoPage;
