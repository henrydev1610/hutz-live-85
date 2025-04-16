import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Film, User, Image, Palette, Check, ExternalLink, X, StopCircle, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  // Font and text styling options
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [qrCodeTextSize, setQrCodeTextSize] = useState(16);
  
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
  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({
    x: 20,
    y: 150,
    width: 200,
    height: 60
  });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [resizeHandleQR, setResizeHandleQR] = useState<string | null>(null);
  const [resizeHandleText, setResizeHandleText] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [calculatedFontSize, setCalculatedFontSize] = useState(16);
  
  const transmissionWindowRef = useRef<Window | null>(null);
  const [qrCodeDescription, setQrCodeDescription] = useState("Escaneie o QR Code para participar");

  // Background color options
  const backgroundColors = [
    "#000000", "#0F172A", "#18181B", "#292524", "#1E1E1E", "#1A1A1A",
    "#2E1065", "#4C1D95", "#6B21A8", "#7E22CE", "#9333EA", 
    "#581C87", "#701A75", "#831843", "#9D174D", "#BE185D",
    "#0C4A6E", "#0E7490", "#0F766E", "#047857", "#065F46", 
    "#064E3B", "#14532D", "#166534", "#15803D", "#16A34A",
    "#1E3A8A", "#1E40AF", "#1D4ED8", "#2563EB", "#3B82F6",
    "#881337", "#9F1239", "#BE123C", "#E11D48", "#F43F5E"
  ];

  // Font options
  const fontOptions = [
    "Inter", "Arial", "Helvetica", "Times New Roman", "Courier New", 
    "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Impact", 
    "Comic Sans MS", "Lucida Sans", "Palatino", "Garamond", "Bookman",
    "Copperplate", "Papyrus", "Brush Script MT", "Luminari", "Didot",
    "American Typewriter", "Andale Mono", "Bradley Hand", "Chalkduster", "Futura",
    "Marker Felt", "Optima", "Snell Roundhand", "Zapfino", "Baskerville"
  ];

  // Text color options
  const textColors = [
    "#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0", "#CBD5E1", "#94A3B8", 
    "#64748B", "#475569", "#334155", "#1E293B", "#0F172A", "#000000",
    "#FECACA", "#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#B91C1C",
    "#D9F99D", "#BEF264", "#A3E635", "#84CC16", "#65A30D", "#4D7C0F",
    "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8",
    "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#4338CA",
    "#F5D0FE", "#F0ABFC", "#E879F9", "#D946EF", "#C026D3", "#A21CAF"
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

  // Update font size based on text box width
  useEffect(() => {
    // Scale font size based on width, but keep it within reasonable bounds
    const baseFontSize = 16;
    const scaleFactor = qrDescriptionPosition.width / 200; // baseline width of 200px
    const newFontSize = Math.max(10, Math.min(32, baseFontSize * scaleFactor));
    setCalculatedFontSize(newFontSize);
  }, [qrDescriptionPosition.width]);

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
      if (handle && handle.startsWith('qr-')) {
        setResizeHandleQR(handle);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartSize({ 
          width: qrCodePosition.width, 
          height: qrCodePosition.height 
        });
      }
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
      if (handle && handle.startsWith('text-')) {
        setResizeHandleText(handle);
        setStartPos({ x: e.clientX, y: e.clientY });
        setStartSize({ 
          width: qrDescriptionPosition.width, 
          height: qrDescriptionPosition.height 
        });
      }
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
      
      if (resizeHandleQR.includes('r')) { // Right handles
        newWidth = Math.max(80, startSize.width + dx);
      }
      if (resizeHandleQR.includes('b')) { // Bottom handles
        newHeight = Math.max(80, startSize.height + dy);
      }
      
      // Keep QR code square by using the larger dimension
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
      
      if (resizeHandleText.includes('r')) { // Right handles
        newWidth = Math.max(80, startSize.width + dx);
      }
      if (resizeHandleText.includes('b')) { // Bottom handles
        newHeight = Math.max(30, startSize.height + dy);
      }
      
      setQrDescriptionPosition(prev => ({ 
        ...prev, 
        width: newWidth,
        height: newHeight
      }));
    }
  };

  const handleTextSizeChange = (direction: 'increase' | 'decrease') => {
    setQrCodeTextSize(prev => {
      if (direction === 'increase') {
        return Math.min(prev + 2, 36);
      } else {
        return Math.max(prev - 2, 10);
      }
    });
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
              @import url('https://fonts.googleapis.com/css2?family=${selectedFont.replace(' ', '+')}&display=swap');
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
              .qr-code-container {
                position: absolute;
                left: ${qrCodePosition.x}px;
                top: ${qrCodePosition.y}px;
                width: ${qrCodePosition.width}px;
                display: ${qrCodeVisible ? 'flex' : 'none'};
                flex-direction: column;
                align-items: center;
              }
              .qr-code {
                background-color: white;
                padding: 4px;
                border-radius: 8px;
                width: 100%;
                height: ${qrCodePosition.height}px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .qr-code svg {
                width: 100%;
                height: 100%;
              }
              .qr-description {
                position: absolute;
                left: ${qrDescriptionPosition.x}px;
                top: ${qrDescriptionPosition.y}px;
                width: ${qrDescriptionPosition.width}px;
                color: ${selectedTextColor};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: ${qrCodeTextSize}px;
                text-align: center;
                font-weight: bold;
                font-family: '${selectedFont}', sans-serif;
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
                <div class="qr-code-container">
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
                </div>
                <div class="qr-description">${qrCodeDescription}</div>
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
          <>
            <div className="absolute"
              style={{
                left: `${qrCodePosition.x}px`,
                top: `${qrCodePosition.y}px`,
                width: `${qrCodePosition.width}px`,
              }}
            >
              <div 
                ref={qrCodeRef}
                className="w-full bg-white p-1 rounded-lg cursor-move"
                style={{
                  height: `${qrCodePosition.height}px`,
                }}
                onMouseDown={startDraggingQR}
              >
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <QrCode className="w-full h-full text-black" />
                </div>
                
                {/* QR Code resize handles */}
                <div className="absolute right-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-ne-resize resize-handle" data-handle="qr-tr"></div>
                <div className="absolute right-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-se-resize resize-handle" data-handle="qr-br"></div>
                <div className="absolute left-0 bottom-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-sw-resize resize-handle" data-handle="qr-bl"></div>
                <div className="absolute left-0 top-0 w-4 h-4 bg-white border border-gray-300 rounded-full cursor-nw-resize resize-handle" data-handle="qr-tl"></div>
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
                fontFamily: `'${selectedFont}', sans-serif`,
                fontSize: `${calculatedFontSize}px`,
                fontWeight: 'bold',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: '4px',
              }}
              onMouseDown={startDraggingText}
            >
              {qrCodeDescription}
              
              {/* Text resize handles */}
              <div className="absolute right-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-ne-resize resize-handle" data-handle="text-tr"></div>
              <div className="absolute right-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-se-resize resize-handle" data-handle="text-br"></div>
              <div className="absolute left-0 bottom-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-sw-resize resize-handle" data-handle="text-bl"></div>
              <div className="absolute left-0 top-0 w-3 h-3 bg-white/40 border border-white/60 rounded-full cursor-nw-resize resize-handle" data-handle="text-tl"></div>
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
