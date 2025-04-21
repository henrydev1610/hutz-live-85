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
import QRCode from 'qrcode';
import { initHostWebRTC, setOnParticipantTrackCallback, getParticipantConnection, cleanupWebRTC } from '@/utils/webrtc';
import WebRTCVideo from '@/components/telao/WebRTCVideo';

const TelaoPage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [participantList, setParticipantList] = useState<{id: string, name: string, active: boolean, selected: boolean, frameData?: string}[]>([]);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState("#000000");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [finalAction, setFinalAction] = useState<'none' | 'image' | 'coupon'>('image');
  const [finalActionLink, setFinalActionLink] = useState("");
  const [finalActionImage, setFinalActionImage] = useState<string | null>(null);
  const [finalActionCoupon, setFinalActionCouponCode] = useState("");
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [broadcastChannel, setBroadcastChannel] = useState<BroadcastChannel | null>(null);
  const [participantStreams, setParticipantStreams] = useState<{[key: string]: MediaStream}>({});
  
  const [qrCodePosition, setQrCodePosition] = useState({ 
    x: 20, 
    y: 20, 
    width: 80, 
    height: 80 
  });

  const [qrDescriptionPosition, setQrDescriptionPosition] = useState({
    x: 20,
    y: 110,
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
    if (participantList.length === 0) {
      const initialParticipants = Array(4).fill(0).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `Participante ${i + 1}`,
        active: false,
        selected: false
      }));
      setParticipantList(initialParticipants);
    }
    
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, []);

  useEffect(() => {
    if (sessionId) {
      console.log("Setting up broadcast channel for session:", sessionId);
      const channel = new BroadcastChannel(`telao-session-${sessionId}`);
      
      channel.onmessage = (event) => {
        const { data } = event;
        console.log("Received broadcast message:", data.type, data.id);
        
        if (data.type === 'participant-join') {
          console.log('Participant joined:', data.id);
          handleParticipantJoin(data.id);
        } 
        else if (data.type === 'participant-leave') {
          console.log('Participant left:', data.id);
          setParticipantList(prev => 
            prev.map(p => p.id === data.id ? { ...p, active: false } : p)
          );
          
          // Clean up WebRTC for this participant
          cleanupWebRTC(data.id);
          setParticipantStreams(prev => {
            const newStreams = {...prev};
            delete newStreams[data.id];
            return newStreams;
          });
        }
        else if (data.type === 'participant-heartbeat') {
          setParticipantList(prev => 
            prev.map(p => p.id === data.id ? { ...p, active: true } : p)
          );
        }
        else if (data.type === 'video-frame') {
          setParticipantList(prev => {
            return prev.map(p => {
              if (p.id === data.id) {
                return { ...p, frameData: data.frame, active: true };
              }
              return p;
            });
          });
        }
      };
      
      setBroadcastChannel(channel);
      
      // Initialize WebRTC for host
      initHostWebRTC(sessionId);
      
      // Set up callback for when we receive tracks from participants
      setOnParticipantTrackCallback((participantId, event) => {
        console.log(`Received ${event.track.kind} track from participant ${participantId}`);
        
        if (event.track.kind === 'video') {
          const [videoStream] = event.streams;
          if (videoStream) {
            console.log("Setting up stream for participant", participantId);
            setParticipantStreams(prev => ({
              ...prev,
              [participantId]: videoStream
            }));
          }
        }
      });
      
      // Also set up a localStorage listener as fallback
      const checkLocalStorageJoins = setInterval(() => {
        try {
          const keys = Object.keys(localStorage);
          const joinKeys = keys.filter(k => k.startsWith(`telao-join-${sessionId}`));
          
          joinKeys.forEach(key => {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              if (data.type === 'participant-join' && data.id) {
                console.log('Participant joined via localStorage:', data.id);
                handleParticipantJoin(data.id);
                localStorage.removeItem(key);
              }
            } catch (e) {
              console.error('Error parsing localStorage join data:', e);
            }
          });
        } catch (e) {
          console.warn('Error checking localStorage for joins:', e);
        }
      }, 1000);
      
      return () => {
        clearInterval(checkLocalStorageJoins);
        if (channel) {
          channel.close();
        }
        cleanupWebRTC(); // Clean up all WebRTC connections
      };
    }
  }, [sessionId, participantCount, toast]);

  useEffect(() => {
    if (qrCodeGenerated && qrCodeURL) {
      generateQRCode(qrCodeURL);
    }
  }, [qrCodeGenerated, qrCodeURL]);

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

  const generateQRCode = async (url: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      setQrCodeSvg(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar o QR Code.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateQRCode = () => {
    const newSessionId = Math.random().toString(36).substring(2, 15);
    console.log("Generated new session ID:", newSessionId);
    setSessionId(newSessionId);
    
    const baseURL = window.location.origin;
    const participantURL = `${baseURL}/participant/${newSessionId}`;
    
    setQrCodeURL(participantURL);
    setQrCodeGenerated(true);
    
    setParticipantList([]);
    
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
        newWidth = Math.max(20, startSize.width + dx);
      }
      if (resizeHandleQR.includes('b')) { 
        newHeight = Math.max(20, startSize.height + dy);
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
        newWidth = Math.max(30, startSize.width + dx);
      }
      if (resizeHandleText.includes('b')) { 
        newHeight = Math.max(15, startSize.height + dy);
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
    
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.9;
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
      
      const transmissionWidth = width;
      const transmissionHeight = height;
      
      const widthRatio = transmissionWidth / previewWidth;
      const heightRatio = transmissionHeight / previewHeight;
      
      const scale = Math.min(widthRatio, heightRatio) * 0.9;
      
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
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                width: 100vw;
              }
              .container {
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: ${backgroundImage ? 'transparent' : selectedBackgroundColor};
                width: 100%;
                height: 100%;
                aspect-ratio: 16 / 9;
                max-width: 100%;
                max-height: 100%;
              }
              .content-wrapper {
                position: relative;
                width: 100%;
                height: 100%;
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
              .participant video {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .participant img {
                width: 100%;
                height: 100%;
                object-fit: cover;
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
              .qr-code img {
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
                font-size: ${qrDescriptionFontSize * scale / 2}px;
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
              <div class="content-wrapper">
                ${backgroundImage ? `<img src="${backgroundImage}" class="bg-image" alt="Background" />` : ''}
                
                <div class="participants-grid">
                  ${participantList
                    .filter(p => p.selected)
                    .slice(0, participantCount)
                    .map((participant, i) => `
                      <div class="participant" id="participant-${participant.id}">
                        ${participant.frameData 
                          ? `<img src="${participant.frameData}" alt="${participant.name}" />`
                          : `<svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>`
                        }
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
                  ${qrCodeSvg ? `<img src="${qrCodeSvg}" alt="QR Code" />` : ''}
                </div>
                <div class="qr-description">${qrCodeDescription}</div>
              </div>
            </div>
            
            <script>
              const sessionId = "${sessionId}";
              console.log("Transmission window opened for session:", sessionId);
              let webrtcStreamElements = {}; // Store video elements for WebRTC streams
              
              // Legacy channel for backward compatibility
              const channel = new BroadcastChannel("telao-session-" + sessionId);
              
              // WebRTC channel for real-time communication
              const webrtcChannel = new BroadcastChannel("telao-webrtc-" + sessionId);
              
              channel.onmessage = (event) => {
                const data = event.data;
                
                if (data.type === 'video-frame') {
                  const participantId = data.id;
                  const participantElement = document.getElementById("participant-" + participantId);
                  
                  if (participantElement) {
                    let img = participantElement.querySelector('img');
                    if (!img) {
                      participantElement.innerHTML = '';
                      img = document.createElement('img');
                      participantElement.appendChild(img);
                    }
                    
                    img.src = data.frame;
                    img.alt = "Participant Video";
                  }
                } else if (data.type === 'participant-join') {
                  console.log('New participant joined in transmission window:', data.id);
                  channel.postMessage({
                    type: 'host-acknowledge',
                    participantId: data.id,
                    timestamp: Date.now()
                  });
                  
                  // Also acknowledge via WebRTC channel
                  webrtcChannel.postMessage({
                    type: 'host-acknowledge',
                    participantId: data.id,
                    timestamp: Date.now()
                  });
                }
              };
              
              // Handle WebRTC stream updates from the main window
              window.addEventListener('message', (event) => {
                if (event.data.type === 'webrtc-stream') {
                  const { participantId, stream } = event.data;
                  console.log('Received WebRTC stream for participant:', participantId);
                  
                  const participantElement = document.getElementById("participant-" + participantId);
                  if (participantElement && stream) {
                    // Remove existing content
                    participantElement.innerHTML = '';
                    
                    // Create video element for WebRTC stream
                    const video = document.createElement('video');
                    video.autoplay = true;
                    video.playsInline = true;
                    video.muted = true;
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'cover';
                    
                    participantElement.appendChild(video);
                    webrtcStreamElements[participantId] = video;
                    
                    // Set the stream as source
                    video.srcObject = stream;
                  }
                }
              });
              
              window.addEventListener('beforeunload', () => {
                console.log("Transmission window closing");
                channel.close();
                webrtcChannel.close();
                
                // Clean up video elements
                Object.values(webrtcStreamElements).forEach(video => {
                  if (video.srcObject) {
                    const stream = video.srcObject;
                    if (stream instanceof MediaStream) {
                      stream.getTracks().forEach(track => track.stop());
                    }
                    video.srcObject = null;
                  }
                });
              });
            </script>
          </body>
        </html>
      `);
      
      newWindow.document.close();
      setTransmissionOpen(true);
      
      newWindow.onbeforeunload = () => {
        setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      };
      
      // Forward WebRTC streams to the transmission window
      const sendStreamsToTransmissionWindow = () => {
        if (!transmissionWindowRef.current || transmissionWindowRef.current.closed) return;
        
        Object.entries(participantStreams).forEach(([participantId, stream]) => {
          transmissionWindowRef.current?.postMessage({
            type: 'webrtc-stream',
            participantId,
            stream
          }, '*');
        });
      };
      
      // Send streams initially and whenever they change
      sendStreamsToTransmissionWindow();
      const streamUpdateInterval = setInterval(sendStreamsToTransmissionWindow, 1000);
      
      return () => clearInterval(streamUpdateInterval);
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
