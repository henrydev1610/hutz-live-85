
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Film, User, Image, Palette, Check, ExternalLink, X, StopCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TelaoPage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [participantList, setParticipantList] = useState<{id: string, name: string, active: boolean, selected: boolean}[]>([]);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState("#000000");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [finalAction, setFinalAction] = useState<'none' | 'image' | 'coupon'>('image');
  const [finalActionLink, setFinalActionLink] = useState("");
  const [finalActionImage, setFinalActionImage] = useState<string | null>(null);
  const [finalActionCoupon, setFinalActionCouponCode] = useState("");
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [transmissionOpen, setTransmissionOpen] = useState(false);
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const [finalActionTimerId, setFinalActionTimerId] = useState<number | null>(null);
  
  const [qrCodePosition, setQrCodePosition] = useState({ 
    x: 20, 
    y: 20, 
    width: 120, 
    height: 120 
  });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const transmissionWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (qrCodeGenerated) {
      const mockParticipants = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Participante ${i + 1}`,
        active: true,
        selected: i < 4
      }));
      
      setParticipantList(prev => {
        if (prev.length < 15) {
          return mockParticipants;
        }
        return prev;
      });
    }
  }, [qrCodeGenerated]);

  // Timer effect for final action countdown
  useEffect(() => {
    if (finalActionOpen && finalActionTimeLeft > 0) {
      const timerId = window.setInterval(() => {
        setFinalActionTimeLeft((prev) => prev - 1);
      }, 1000);
      
      setFinalActionTimerId(timerId as unknown as number);
      
      return () => {
        if (timerId) clearInterval(timerId);
      };
    } else if (finalActionTimeLeft <= 0) {
      closeFinalAction();
    }
  }, [finalActionOpen, finalActionTimeLeft]);

  // Cleanup effect for the transmission window
  useEffect(() => {
    return () => {
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.close();
      }
    };
  }, []);

  const handleGenerateQRCode = () => {
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

  const handleQRCodeToTransmission = () => {
    setQrCodeVisible(true);
    toast({
      title: "QR Code incluído",
      description: "O QR Code foi incluído na tela de transmissão e pode ser redimensionado."
    });
  };

  const handleParticipantSelect = (id: string) => {
    setParticipantList(prev => 
      prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  };

  const handleParticipantRemove = (id: string) => {
    setParticipantList(prev => {
      const newList = prev.filter(p => p.id !== id);
      
      const nextId = String(prev.length + 1);
      const newParticipant = {
        id: nextId,
        name: `Participante ${nextId}`,
        active: true,
        selected: false
      };
      
      return [...newList, newParticipant];
    });
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

  const startDragging = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!qrCodeVisible) return;
    
    const target = e.target as HTMLElement;
    if (target.className && typeof target.className === 'string' && target.className.includes('resize-handle')) {
      const handle = target.getAttribute('data-handle');
      setResizeHandle(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ 
        width: qrCodePosition.width, 
        height: qrCodePosition.height 
      });
    } else {
      setIsDraggingQR(true);
      setStartPos({ 
        x: e.clientX - qrCodePosition.x, 
        y: e.clientY - qrCodePosition.y 
      });
    }
  };

  const stopDragging = () => {
    setIsDraggingQR(false);
    setResizeHandle(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingQR) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      
      const container = previewContainerRef.current?.getBoundingClientRect();
      
      if (container) {
        const x = Math.max(0, Math.min(newX, container.width - qrCodePosition.width));
        const y = Math.max(0, Math.min(newY, container.height - qrCodePosition.height));
        
        setQrCodePosition(prev => ({ ...prev, x, y }));
      }
    } else if (resizeHandle) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      
      let newWidth = startSize.width;
      let newHeight = startSize.height;
      
      if (resizeHandle.includes('r')) { // Right handles
        newWidth = Math.max(80, startSize.width + dx);
      }
      if (resizeHandle.includes('b')) { // Bottom handles
        newHeight = Math.max(80, startSize.height + dy);
      }
      
      const size = Math.max(newWidth, newHeight);
      
      setQrCodePosition(prev => ({ 
        ...prev, 
        width: size,
        height: size
      }));
    }
  };

  const openTransmissionWindow = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.focus();
      return;
    }
    
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      '',
      'TransmissionWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (newWindow) {
      transmissionWindowRef.current = newWindow;
      
      // Add content to the new window
      newWindow.document.write(`
        <html>
          <head>
            <title>Transmissão ao Vivo</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                background-color: #000;
                color: white;
                font-family: sans-serif;
              }
              .container {
                position: relative;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
                background-color: ${backgroundImage ? 'transparent' : selectedBackgroundColor};
              }
              .bg-image {
                position: absolute;
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .participants-grid {
                position: absolute;
                top: 15%;
                right: 15%;
                bottom: 15%;
                left: 33%;
                display: grid;
                grid-template-columns: repeat(${Math.ceil(Math.sqrt(participantCount))}, 1fr);
                gap: 8px;
              }
              .participant {
                background-color: rgba(0, 0, 0, 0.4);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              }
              .participant-icon {
                width: 32px;
                height: 32px;
                opacity: 0.7;
              }
              .qr-code {
                position: absolute;
                background-color: white;
                padding: 4px;
                border-radius: 8px;
                left: ${qrCodePosition.x}px;
                top: ${qrCodePosition.y}px;
                width: ${qrCodePosition.width}px;
                height: ${qrCodePosition.height}px;
                display: ${qrCodeVisible ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
              }
              .qr-code svg {
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${backgroundImage ? `<img src="${backgroundImage}" class="bg-image" alt="Background" />` : ''}
              
              <div class="participants-grid">
                ${Array.from({ length: Math.min(participantCount, participantList.filter(p => p.selected).length) }, (_, i) => `
                  <div class="participant">
                    <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                `).join('')}
                
                ${Array.from({ length: Math.max(0, participantCount - participantList.filter(p => p.selected).length) }, (_, i) => `
                  <div class="participant" style="background-color: rgba(0, 0, 0, 0.2);">
                    <svg class="participant-icon" style="opacity: 0.3;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                `).join('')}
              </div>
              
              ${qrCodeVisible ? `
                <div class="qr-code">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="16" height="16" x="4" y="4" rx="1"></rect>
                    <path d="M10 4v4"></path>
                    <path d="M4 10h4"></path>
                    <path d="M10 16v4"></path>
                    <path d="M16 4v4"></path>
                    <path d="M20 10h-4"></path>
                    <path d="M16 16v4"></path>
                    <path d="M4 16h4"></path>
                    <path d="M4 4v4"></path>
                    <path d="M16 16h4"></path>
                    <path d="M20 20v-4"></path>
                    <path d="M20 4v4"></path>
                    <path d="M4 20v-4"></path>
                  </svg>
                </div>
              ` : ''}
            </div>
          </body>
        </html>
      `);
      
      newWindow.document.close();
      setTransmissionOpen(true);
      
      newWindow.onbeforeunload = () => {
        setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      };
    }
  };
  
  const finishTransmission = () => {
    // Close the transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      setTransmissionOpen(false);
    }
    
    // Only show final action if it's not 'none'
    if (finalAction !== 'none') {
      setFinalActionTimeLeft(20);
      setFinalActionOpen(true);
    } else {
      toast({
        title: "Transmissão finalizada",
        description: "A transmissão foi encerrada com sucesso."
      });
    }
  };
  
  const closeFinalAction = () => {
    if (finalActionTimerId) {
      clearInterval(finalActionTimerId);
      setFinalActionTimerId(null);
    }
    setFinalActionOpen(false);
    setFinalActionTimeLeft(20);
    
    toast({
      title: "Transmissão finalizada",
      description: "A transmissão foi encerrada com sucesso."
    });
  };
  
  const handleFinalActionClick = () => {
    if (finalActionLink) {
      window.open(finalActionLink, '_blank');
    }
  };

  const renderPreviewContent = () => {
    return (
      <div 
        className="aspect-video relative bg-black rounded-lg overflow-hidden" 
        onMouseMove={handleMouseMove} 
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        ref={previewContainerRef}
      >
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
        
        <div className="absolute top-[15%] right-[15%] bottom-[15%] left-[33%]">
          <div className={`grid grid-cols-${Math.ceil(Math.sqrt(participantCount))} gap-2 h-full`}>
            {participantList
              .filter(p => p.selected)
              .slice(0, participantCount)
              .map((participant, i) => (
                <div key={participant.id} className="bg-black/40 rounded overflow-hidden flex items-center justify-center">
                  <User className="h-8 w-8 text-white/70" />
                </div>
              ))}
            
            {Array(Math.max(0, participantCount - selectedParticipantsCount)).fill(0).map((_, i) => (
              <div key={`empty-preview-${i}`} className="bg-black/20 rounded overflow-hidden flex items-center justify-center">
                <User className="h-8 w-8 text-white/30" />
              </div>
            ))}
          </div>
        </div>
        
        {qrCodeVisible && (
          <div 
            ref={qrCodeRef}
            className="absolute bg-white p-1 rounded-lg cursor-move"
            style={{
              left: `${qrCodePosition.x}px`,
              top: `${qrCodePosition.y}px`,
              width: `${qrCodePosition.width}px`,
              height: `${qrCodePosition.height}px`,
            }}
            onMouseDown={startDragging}
          >
            <div className="w-full h-full bg-white flex items-center justify-center">
              <QrCode className="w-full h-full text-black" />
            </div>
            
            <div className="absolute right-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-ne-resize resize-handle" data-handle="tr"></div>
            <div className="absolute right-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-se-resize resize-handle" data-handle="br"></div>
            <div className="absolute left-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-sw-resize resize-handle" data-handle="bl"></div>
            <div className="absolute left-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-nw-resize resize-handle" data-handle="tl"></div>
          </div>
        )}
      </div>
    );
  };

  const selectedParticipantsCount = participantList.filter(p => p.selected).length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Telão</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 h-full">
            <CardHeader className="flex flex-row justify-between items-center">
              <div className="flex items-center gap-4 w-full">
                <CardTitle className="flex items-center gap-2">
                  Controle de Transmissão
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    className="hutz-button-accent"
                    onClick={openTransmissionWindow}
                    disabled={transmissionOpen}
                  >
                    <Film className="h-4 w-4 mr-2" />
                    Iniciar Transmissão
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={finishTransmission}
                    disabled={!transmissionOpen}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Finalizar Transmissão
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Gerencie participantes, layout e aparência da sua transmissão ao vivo
              </CardDescription>
              
              <Tabs defaultValue="participants" className="w-full">
                <TabsList className="grid grid-cols-5 mb-6">
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
                    
                    {Array(Math.max(0, 12 - participantList.length)).fill(0).map((_, i) => (
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
                  
                  <p className="text-sm text-white/60 mt-4">
                    Limite de participantes: 100 (Ao remover um participante, outro será adicionado automaticamente)
                  </p>
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
                            A imagem será redimensionada na transmissão
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
                  {renderPreviewContent()}
                  
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
                  
                  <Button 
                    variant="default" 
                    className="w-full hutz-button-primary mt-2"
                    onClick={handleQRCodeToTransmission}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Incluir na tela de transmissão
                  </Button>
                  
                  <div className="p-4 bg-secondary/60 rounded-lg mt-4">
                    <p className="text-xs text-white/60 mb-2">Link do QR Code:</p>
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly 
                        value={qrCodeURL} 
                        className="text-xs" 
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(qrCodeURL);
                          toast({
                            title: "Link copiado",
                            description: "O link foi copiado para a área de transferência."
                          });
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transmission Dialog */}
      <Dialog open={transmissionOpen} onOpenChange={setTransmissionOpen}>
        <DialogContent className="max-w-4xl p-0 border-white/10 bg-black">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Transmissão ao Vivo</DialogTitle>
            <DialogDescription>
              Transmissão iniciada. Compartilhe o QR Code para que os participantes se conectem.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {renderPreviewContent()}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Final Action Dialog */}
      <Dialog open={finalActionOpen} onOpenChange={setFinalActionOpen}>
        <DialogContent className="max-w-3xl p-0 border-white/10 bg-black">
          <button 
            onClick={closeFinalAction} 
            className="absolute top-2 right-2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-10"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="relative">
            {finalAction === 'image' && finalActionImage && (
              <div 
                className="p-8 flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
                onClick={handleFinalActionClick}
              >
                <img 
                  src={finalActionImage} 
                  alt="Final action" 
                  className="max-w-full h-auto rounded-md"
                />
                {finalActionLink && (
                  <p className="mt-4 text-accent underline">Clique para acessar o link</p>
                )}
              </div>
            )}
            
            {finalAction === 'coupon' && (
              <div 
                className="p-8 flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
                onClick={handleFinalActionClick}
              >
                <div className="bg-white/5 border border-accent p-8 rounded-lg text-center">
                  <h3 className="text-2xl font-bold mb-4">Cupom de Desconto</h3>
                  <div className="text-4xl font-bold py-4 px-8 bg-accent/20 border border-dashed border-accent rounded-md">
                    {finalActionCoupon || "DESCONTO20"}
                  </div>
                  {finalActionLink && (
                    <p className="mt-6 text-accent underline">Clique para resgatar</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="absolute bottom-4 right-4 bg-black/60 px-3 py-1 rounded-full text-sm">
              Fechando em: {finalActionTimeLeft}s
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelaoPage;
