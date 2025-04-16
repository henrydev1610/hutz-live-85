import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Film, User, Image, Palette, Check, ExternalLink, X, StopCircle, Trash2, Type, Minus, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

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
  
  const [selectedFont, setSelectedFont] = useState("sans-serif");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(16);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [transmissionOpen, setTransmissionOpen] = useState(false);
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const [finalActionTimerId, setFinalActionTimerId] = useState<number | null>(null);
  
  const [qrCodePosition, setQrCodePosition] = useState({ 
    x: 20, 
    y: 20, 
    width: 100, 
    height: 100 
  });

  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({
    x: 20,
    y: 130,
    width: 200,
    height: 60
  });

  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [resizeHandleQR, setResizeHandleQR] = useState<string | null>(null);
  const [resizeHandleText, setResizeHandleText] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  
  const transmissionWindowRef = useRef<Window | null>(null);
  const [qrCodeDescription, setQrCodeDescription] = useState("Escaneie o QR Code para participar");

  const backgroundColors = [
    '#000000', '#0F172A', '#18181B', '#292524', '#1E1E1E', '#1A1A1A',
    '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF',
    '#111827', '#1E293B', '#334155', '#475569', '#64748B',
    '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444',
    '#14532D', '#166534', '#15803D', '#16A34A', '#22C55E',
    '#0C4A6E', '#0E7490', '#0891B2', '#06B6D4', '#22D3EE'
  ];

  const fontOptions = [
    { name: 'Sans-serif', value: 'sans-serif' },
    { name: 'Serif', value: 'serif' },
    { name: 'Monospace', value: 'monospace' },
    { name: 'Cursive', value: 'cursive' },
    { name: 'Fantasy', value: 'fantasy' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Tahoma', value: 'Tahoma, sans-serif' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Garamond', value: 'Garamond, serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Brush Script MT', value: 'Brush Script MT, cursive' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Impact', value: 'Impact, fantasy' },
    { name: 'Lucida Handwriting', value: 'Lucida Handwriting, cursive' },
    { name: 'Lucida Console', value: 'Lucida Console, monospace' },
    { name: 'Palatino', value: 'Palatino, serif' },
    { name: 'Book Antiqua', value: 'Book Antiqua, serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Arial Black', value: 'Arial Black, sans-serif' },
    { name: 'Copperplate', value: 'Copperplate, fantasy' },
    { name: 'Papyrus', value: 'Papyrus, fantasy' },
    { name: 'Rockwell', value: 'Rockwell, serif' },
    { name: 'Century Gothic', value: 'Century Gothic, sans-serif' },
    { name: 'Calibri', value: 'Calibri, sans-serif' },
    { name: 'Cambria', value: 'Cambria, serif' },
    { name: 'Consolas', value: 'Consolas, monospace' },
    { name: 'Franklin Gothic', value: 'Franklin Gothic, sans-serif' }
  ];

  const textColors = [
    '#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1', 
    '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', 
    '#0F172A', '#020617', '#000000', '#FEF2F2', '#FEE2E2', 
    '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626', 
    '#B91C1C', '#ECFDF5', '#D1FAE5', '#A7F3D0', '#6EE7B7', 
    '#34D399', '#10B981', '#059669', '#047857', '#FFEDD5', 
    '#FED7AA'
  ];

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

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    toast({
      title: "Imagem removida",
      description: "A imagem de fundo foi removida com sucesso."
    });
  };

  const startDraggingQR = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!qrCodeVisible) return;
    
    const target = e.target as HTMLElement;
    if (target.className && typeof target.className === 'string' && target.className.includes('resize-handle')) {
      const handle = target.getAttribute('data-handle');
      setResizeHandleQR(handle);
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

  const startDraggingText = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!qrCodeVisible) return;
    
    const target = e.target as HTMLElement;
    if (target.className && typeof target.className === 'string' && target.className.includes('resize-handle')) {
      const handle = target.getAttribute('data-handle');
      setResizeHandleText(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSize({ 
        width: qrDescriptionPosition.width, 
        height: qrDescriptionPosition.height 
      });
    } else {
      setIsDraggingText(true);
      setStartPos({ 
        x: e.clientX - qrDescriptionPosition.x, 
        y: e.clientY - qrDescriptionPosition.y 
      });
    }
  };

  const stopDragging = () => {
    setIsDraggingQR(false);
    setIsDraggingText(false);
    setResizeHandleQR(null);
    setResizeHandleText(null);
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
    } else if (isDraggingText) {
      const newX = e.clientX - startPos.x;
      const newY = e.clientY - startPos.y;
      
      const container = previewContainerRef.current?.getBoundingClientRect();
      
      if (container) {
        const x = Math.max(0, Math.min(newX, container.width - qrDescriptionPosition.width));
        const y = Math.max(0, Math.min(newY, container.height - qrDescriptionPosition.height));
        
        setQrDescriptionPosition(prev => ({ ...prev, x, y }));
      }
    } else if (resizeHandleQR) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      
      let newWidth = startSize.width;
      let newHeight = startSize.height;
      
      if (resizeHandleQR.includes('r')) { 
        newWidth = Math.max(40, startSize.width + dx);
      }
      if (resizeHandleQR.includes('b')) { 
        newHeight = Math.max(40, startSize.height + dy);
      }
      
      const size = Math.max(newWidth, newHeight);
      
      setQrCodePosition(prev => ({ 
        ...prev, 
        width: size,
        height: size
      }));
    } else if (resizeHandleText) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      
      let newWidth = startSize.width;
      let newHeight = startSize.height;
      
      if (resizeHandleText.includes('r')) { 
        newWidth = Math.max(50, startSize.width + dx);
      }
      if (resizeHandleText.includes('b')) { 
        newHeight = Math.max(20, startSize.height + dy);
      }
      
      setQrDescriptionPosition(prev => ({ 
        ...prev, 
        width: newWidth,
        height: newHeight
      }));
    }
  };

  const increaseFontSize = () => {
    setQrDescriptionFontSize(prev => Math.min(prev + 2, 32));
  };

  const decreaseFontSize = () => {
    setQrDescriptionFontSize(prev => Math.max(prev - 2, 10));
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
      
      const previewWidth = previewContainerRef.current?.clientWidth || 400;
      const previewHeight = previewContainerRef.current?.clientHeight || 225;
      
      const transmissionWidth = 800;
      const transmissionHeight = 600;
      
      const widthScale = transmissionWidth / previewWidth;
      const heightScale = transmissionHeight / previewHeight;
      const scale = Math.min(widthScale, heightScale);
      
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
                font-family: ${selectedFont};
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
                left: ${qrCodePosition.x * scale}px;
                top: ${qrCodePosition.y * scale}px;
                width: ${qrCodePosition.width * scale}px;
                height: ${qrCodePosition.height * scale}px;
                background-color: white;
                padding: 4px;
                border-radius: 8px;
                display: ${qrCodeVisible ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
              }
              .qr-code svg {
                width: 100%;
                height: 100%;
              }
              .qr-description {
                position: absolute;
                left: ${qrDescriptionPosition.x * scale}px;
                top: ${qrDescriptionPosition.y * scale}px;
                width: ${qrDescriptionPosition.width * scale}px;
                height: ${qrDescriptionPosition.height * scale}px;
                color: ${selectedTextColor};
                padding: 4px 8px;
                box-sizing: border-box;
                border-radius: 4px;
                font-size: ${qrDescriptionFontSize * scale}px;
                text-align: center;
                font-weight: bold;
                font-family: ${selectedFont};
                display: ${qrCodeVisible ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
                overflow: hidden;
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
              
              <div class="qr-code">
                <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              <div class="qr-description">${qrCodeDescription}</div>
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
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      setTransmissionOpen(false);
    }
    
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
          <>
            <div 
              className="absolute cursor-move"
              style={{
                left: `${qrCodePosition.x}px`,
                top: `${qrCodePosition.y}px`,
                width: `${qrCodePosition.width}px`,
              }}
              onMouseDown={startDraggingQR}
              ref={qrCodeRef}
            >
              <div 
                className="w-full bg-white p-1 rounded-lg"
                style={{
                  height: `${qrCodePosition.height}px`,
                }}
              >
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <QrCode className="w-full h-full text-black" />
                </div>
                
                <div className="absolute right-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-ne-resize resize-handle" data-handle="tr"></div>
                <div className="absolute right-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-se-resize resize-handle" data-handle="br"></div>
                <div className="absolute left-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-sw-resize resize-handle" data-handle="bl"></div>
                <div className="absolute left-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-nw-resize resize-handle" data-handle="tl"></div>
              </div>
            </div>
            
            <div 
              className="absolute cursor-move"
              style={{
                left: `${qrDescriptionPosition.x}px`,
                top: `${qrDescriptionPosition.y}px`,
                width: `${qrDescriptionPosition.width}px`,
                height: `${qrDescriptionPosition.height}px`,
                color: selectedTextColor,
                fontFamily: selectedFont,
                fontSize: `${qrDescriptionFontSize}px`,
                fontWeight: 'bold',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed rgba(255,255,255,0.3)',
                borderRadius: '4px',
                padding: '4px',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
              onMouseDown={startDraggingText}
              ref={textRef}
            >
              {qrCodeDescription}
              
              <div className="absolute right-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-ne-resize resize-handle" data-handle="tr"></div>
              <div className="absolute right-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-se-resize resize-handle" data-handle="br"></div>
              <div className="absolute left-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-sw-resize resize-handle" data-handle="bl"></div>
              <div className="absolute left-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-nw-resize resize-handle" data-handle="tl"></div>
            </div>
          </>
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
                  <TabsTrigger value="qrcode">
                    <QrCode className="h-4 w-4 mr-2" />
                    QR Code
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
                        value={qrCodeDescription}
                        onChange={(e) => setQrCodeDescription(e.target.value)}
                        className="hutz-input"
                      />
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Fonte do Texto</Label>
                      <Select value={selectedFont} onValueChange={setSelectedFont}>
                        <SelectTrigger className="hutz-input">
                          <SelectValue placeholder="Selecione a fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              <span style={{ fontFamily: font.value }}>{font.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Cor do Texto</Label>
                      <div className="grid grid-cols-9 gap-1">
                        {textColors.map((color) => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded-full border ${selectedTextColor === color ? 'border-white ring-2 ring-accent' : 'border-white/20'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedTextColor(color)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block">Tamanho do Texto</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={decreaseFontSize}
                          disabled={qrDescriptionFontSize <= 10}
                          className="border-white/20"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">{qrDescriptionFontSize}px</span>
                        <Button
                          variant="outline"
                          onClick={increaseFontSize}
                          disabled={qrDescriptionFontSize >= 32}
                          className="border-white/20"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="appearance" className="space-y-4">
                  <div className="space-y-6">
                    <div>
                      <Label className="mb-2 block">Cor de Fundo</Label>
                      <div className="grid grid-cols-9 gap-1">
                        {backgroundColors.map((color) => (
                          <button
                            key={color}
                            className={`w-6 h-6 rounded-full border ${selectedBackgroundColor === color ? 'border-white ring-2 ring-accent' : 'border-white/20'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedBackgroundColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Imagem de Fundo</Label>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={triggerFileInput} className="border-white/20">
                          <Image className="h-4 w-4 mr-2" />
                          Carregar Imagem
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={removeBackgroundImage} 
                          className="border-white/20"
                          disabled={!backgroundImage}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover Imagem
                        </Button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden" 
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="qrcode" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div>
                      <div className="flex gap-2">
                        <Button 
                          variant={qrCodeGenerated ? "outline" : "default"}
                          onClick={handleGenerateQRCode}
                          className={qrCodeGenerated ? "border-white/20" : ""}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          {qrCodeGenerated ? "Regenerar QR Code" : "Gerar QR Code"}
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={handleQRCodeToTransmission}
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
                                  onChange={(e) => setFinalActionCouponCode(e.target.value)}
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle>
                Pré-visualização
              </CardTitle>
              <CardDescription>
                Veja como sua transmissão será exibida
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderPreviewContent()}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Dialog open={finalActionOpen} onOpenChange={setFinalActionOpen}>
        <DialogContent className="text-center max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl mb-2">
              {finalAction === 'coupon' ? 'Seu cupom está disponível!' : 'Obrigado por participar!'}
            </DialogTitle>
            <DialogDescription>
              Esta janela será fechada em {finalActionTimeLeft} segundos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {finalAction === 'image' && (
              <AspectRatio ratio={16/9} className="bg-muted rounded-md overflow-hidden hover:opacity-90 transition-opacity cursor-pointer" onClick={handleFinalActionClick}>
                <img
                  src={finalActionImage || 'https://placehold.co/600x400/png?text=Imagem+Exemplo'}
                  alt="Final action"
                  className="object-cover w-full h-full"
                />
              </AspectRatio>
            )}
            
            {finalAction === 'coupon' && (
              <div className="border border-dashed border-white/30 rounded-md p-6 bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer" onClick={handleFinalActionClick}>
                <p className="text-sm mb-2">Seu cupom de desconto:</p>
                <p className="text-2xl font-bold mb-4">{finalActionCoupon || 'DESC20'}</p>
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Usar cupom agora
                </Button>
              </div>
            )}
          </div>
          
          <Button variant="ghost" className="absolute top-2 right-2" onClick={closeFinalAction}>
            <X className="h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TelaoPage;
