
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, MonitorPlay, Users, Palette, Check, ExternalLink, X, StopCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCode from 'qrcode';
import ParticipantGrid from '@/components/live/ParticipantGrid';
import LivePreview from '@/components/live/LivePreview';
import AppearanceSettings from '@/components/live/AppearanceSettings';
import TextSettings from '@/components/live/TextSettings';
import QrCodeSettings from '@/components/live/QrCodeSettings';
import { generateSessionId, addParticipantToSession } from '@/utils/sessionUtils';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';

const LivePage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [participantList, setParticipantList] = useState<{id: string, name: string, active: boolean, selected: boolean, hasVideo: boolean, connectedAt?: number}[]>([]);
  const [selectedBackgroundColor, setSelectedBackgroundColor] = useState("#000000");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [finalAction, setFinalAction] = useState<'none' | 'image' | 'coupon'>('none');
  const [finalActionLink, setFinalActionLink] = useState("");
  const [finalActionImage, setFinalActionImage] = useState<string | null>(null);
  const [finalActionCoupon, setFinalActionCouponCode] = useState("");
  const { toast } = useToast();
  
  const [selectedFont, setSelectedFont] = useState("sans-serif");
  const [selectedTextColor, setSelectedTextColor] = useState("#FFFFFF");
  const [qrDescriptionFontSize, setQrDescriptionFontSize] = useState(16);
  const [qrCodeDescription, setQrCodeDescription] = useState("Escaneie o QR Code para participar");
  
  const [transmissionOpen, setTransmissionOpen] = useState(false);
  const [finalActionOpen, setFinalActionOpen] = useState(false);
  const [finalActionTimeLeft, setFinalActionTimeLeft] = useState(20);
  const [finalActionTimerId, setFinalActionTimerId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoJoin, setAutoJoin] = useState(true);
  
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
  
  const transmissionWindowRef = useRef<Window | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (participantList.length === 0) {
      const initialParticipants = Array(4).fill(0).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `Participante ${i + 1}`,
        active: false,
        selected: false,
        hasVideo: false
      }));
      setParticipantList(initialParticipants);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      const cleanup = initializeHostSession(sessionId, {
        onParticipantJoin: handleParticipantJoin,
        onParticipantLeave: (id) => {
          setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: false } : p)
          );
        },
        onParticipantHeartbeat: (id) => {
          setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: true } : p)
          );
        }
      });

      return () => {
        cleanup();
      };
    }
  }, [sessionId]);

  useEffect(() => {
    if (qrCodeURL) {
      generateQRCode(qrCodeURL);
    }
  }, [qrCodeURL]);

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
      if (sessionId) {
        cleanupSession(sessionId);
      }
    };
  }, [sessionId]);

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
    const newSessionId = generateSessionId();
    console.log("Generated new session ID:", newSessionId);
    setSessionId(newSessionId);
    
    const baseURL = window.location.origin;
    const participantURL = `${baseURL}/participant/${newSessionId}`;
    
    setQrCodeURL(participantURL);
    
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
      
      const nextId = `placeholder-${prev.length}`;
      const newParticipant = {
        id: nextId,
        name: `Participante ${newList.length + 1}`,
        active: false,
        selected: false,
        hasVideo: false
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

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    toast({
      title: "Imagem removida",
      description: "A imagem de fundo foi removida com sucesso."
    });
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
      'LiveTransmissionWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (newWindow) {
      transmissionWindowRef.current = newWindow;
      
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Transmissão ao Vivo - Momento Live</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                top: 5%;
                right: 5%;
                bottom: 5%;
                left: 30%;
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
                transform: translateZ(0);
                backface-visibility: hidden;
                will-change: transform;
                transition: none;
              }
              .participant-icon {
                width: 32px;
                height: 32px;
                opacity: 0.7;
              }
              .qr-code {
                position: absolute;
                left: ${qrCodePosition.x}px;
                top: ${qrCodePosition.y}px;
                width: ${qrCodePosition.width}px;
                height: ${qrCodePosition.height}px;
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
                left: ${qrDescriptionPosition.x}px;
                top: ${qrDescriptionPosition.y}px;
                width: ${qrDescriptionPosition.width}px;
                height: ${qrDescriptionPosition.height}px;
                color: ${selectedTextColor};
                padding: 4px 8px;
                box-sizing: border-box;
                border-radius: 4px;
                font-size: ${qrDescriptionFontSize}px;
                text-align: center;
                font-weight: bold;
                font-family: ${selectedFont};
                display: ${qrCodeVisible ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
                overflow: hidden;
              }
              .live-indicator {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
              }
              .live-dot {
                width: 8px;
                height: 8px;
                background-color: #ff0000;
                border-radius: 50%;
                margin-right: 5px;
                animation: pulse 1.5s infinite;
              }
              @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 1; }
                100% { opacity: 0.6; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content-wrapper">
                ${backgroundImage ? `<img src="${backgroundImage}" class="bg-image" alt="Background" />` : ''}
                
                <div class="participants-grid" id="participants-container">
                  ${Array.from({ length: participantCount }, (_, i) => `
                    <div class="participant" id="participant-slot-${i}" data-participant-index="${i}">
                      <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
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
                
                <div class="live-indicator">
                  <div class="live-dot"></div>
                  AO VIVO
                </div>
              </div>
            </div>
            
            <script>
              const sessionId = "${sessionId}";
              console.log("Live transmission window opened for session:", sessionId);
              
              const channel = new BroadcastChannel("live-session-" + sessionId);
              const backupChannel = new BroadcastChannel("telao-session-" + sessionId);
              
              let participantSlots = {};
              let availableSlots = Array.from({ length: ${participantCount} }, (_, i) => i);
              let participantStreams = {};
              let activeVideoElements = {};
              let assignedParticipants = new Set();
              
              function createVideoElement(slotElement, stream) {
                const existingVideo = slotElement.querySelector('video');
                if (existingVideo) {
                  console.log('Video element already exists in slot, not creating a new one');
                  return;
                }
                
                slotElement.innerHTML = '';
                const videoElement = document.createElement('video');
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.muted = true;
                
                videoElement.style.transform = 'translateZ(0)';
                videoElement.style.backfaceVisibility = 'hidden';
                videoElement.style.webkitBackfaceVisibility = 'hidden';
                videoElement.style.willChange = 'transform';
                videoElement.style.transition = 'none';
                
                slotElement.appendChild(videoElement);
                
                let playAttempted = false;
                
                setTimeout(() => {
                  if (!playAttempted) {
                    playAttempted = true;
                    console.log('Setting video source and playing');
                    videoElement.srcObject = stream;
                    
                    videoElement.play().catch(err => {
                      console.warn('Error playing video:', err);
                      // We won't auto-retry to avoid continuous retries
                    });
                  }
                }, 100);
                
                videoElement.addEventListener('loadeddata', () => {
                  console.log('Video loaded successfully');
                });
                
                videoElement.addEventListener('error', (err) => {
                  console.error('Video error:', err);
                  // Only retry once
                  if (!playAttempted) {
                    playAttempted = true;
                    setTimeout(() => {
                      videoElement.srcObject = stream;
                      videoElement.play().catch(err => console.warn('Error playing video after recovery:', err));
                    }, 1000);
                  }
                });
                
                activeVideoElements[slotElement.id] = videoElement;
              }
              
              channel.addEventListener('message', (event) => {
                const data = event.data;
                if (data.type === 'video-stream-info' && data.hasStream) {
                  console.log('Received video stream info for:', data.id);
                  participantStreams[data.id] = {
                    hasStream: true,
                    lastUpdate: Date.now(),
                    info: data
                  };
                }
              });
              
              backupChannel.addEventListener('message', (event) => {
                const data = event.data;
                if (data.type === 'video-stream-info' && data.hasStream) {
                  console.log('Received video stream info for (backup):', data.id);
                  participantStreams[data.id] = {
                    hasStream: true,
                    lastUpdate: Date.now(),
                    info: data
                  };
                }
              });
              
              function updateParticipantDisplay() {
                window.addEventListener('message', (event) => {
                  if (event.data.type === 'update-participants') {
                    const { participants } = event.data;
                    console.log('Got participants update:', participants);
                    
                    const currentParticipantIds = new Set(participants.map(p => p.id));
                    
                    // First, handle removed participants
                    [...assignedParticipants].forEach(id => {
                      if (!currentParticipantIds.has(id)) {
                        const slotIndex = participantSlots[id];
                        if (slotIndex !== undefined) {
                          console.log('Removing participant', id, 'from slot', slotIndex);
                          
                          // Clean up the slot
                          const slotElement = document.getElementById("participant-slot-" + slotIndex);
                          if (slotElement) {
                            if (activeVideoElements[slotElement.id]) {
                              const videoElement = activeVideoElements[slotElement.id];
                              if (videoElement.srcObject) {
                                const tracks = videoElement.srcObject.getTracks();
                                tracks.forEach(track => track.stop());
                                videoElement.srcObject = null;
                              }
                              delete activeVideoElements[slotElement.id];
                            }
                            
                            slotElement.innerHTML = \`
                              <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            \`;
                          }
                          
                          // Free up the slot
                          delete participantSlots[id];
                          availableSlots.push(slotIndex);
                          assignedParticipants.delete(id);
                        }
                      }
                    });
                    
                    // Find participants that are selected
                    const selectedParticipants = participants.filter(p => p.selected);
                    
                    // Then assign slots to new selected participants
                    selectedParticipants.forEach(p => {
                      if (!assignedParticipants.has(p.id)) {
                        if (availableSlots.length > 0) {
                          const slotIndex = availableSlots.shift();
                          participantSlots[p.id] = slotIndex;
                          assignedParticipants.add(p.id);
                          
                          console.log('Assigned slot', slotIndex, 'to participant', p.id);
                          
                          const slotElement = document.getElementById("participant-slot-" + slotIndex);
                          if (slotElement) {
                            if (participantStreams[p.id]?.hasStream) {
                              console.log('Participant has stream info, creating video element');
                              
                              if (!window.localStream) {
                                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                                  .then(stream => {
                                    window.localStream = stream;
                                    createVideoElement(slotElement, stream);
                                  })
                                  .catch(err => {
                                    console.error('Error accessing camera:', err);
                                    slotElement.innerHTML = \`
                                      <div style="text-align: center; padding: 10px;">
                                        <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                          <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        <div style="margin-top: 5px; font-size: 12px;">Aguardando mídia...</div>
                                      </div>
                                    \`;
                                  });
                              } else {
                                createVideoElement(slotElement, window.localStream);
                              }
                            } else {
                              slotElement.innerHTML = \`
                                <div style="text-align: center; padding: 10px;">
                                  <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                  </svg>
                                  <div style="margin-top: 5px; font-size: 12px;">\${p.name}</div>
                                </div>
                              \`;
                            }
                          }
                        } else {
                          console.warn('No available slots for participant', p.id);
                        }
                      }
                    });
                    
                    // Handle de-selected participants
                    participants.forEach(p => {
                      if (!p.selected && assignedParticipants.has(p.id)) {
                        const slotIndex = participantSlots[p.id];
                        
                        // Clean up the slot
                        const slotElement = document.getElementById("participant-slot-" + slotIndex);
                        if (slotElement) {
                          if (activeVideoElements[slotElement.id]) {
                            const videoElement = activeVideoElements[slotElement.id];
                            if (videoElement.srcObject) {
                              const tracks = videoElement.srcObject.getTracks();
                              tracks.forEach(track => track.stop());
                              videoElement.srcObject = null;
                            }
                            delete activeVideoElements[slotElement.id];
                          }
                          
                          slotElement.innerHTML = \`
                            <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                          \`;
                        }
                        
                        // Free up the slot
                        delete participantSlots[p.id];
                        availableSlots.push(slotIndex);
                        assignedParticipants.delete(p.id);
                      }
                    });
                  }
                });
                
                window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              }
              
              updateParticipantDisplay();
              
              setInterval(() => {
                window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              }, 5000);
              
              channel.onmessage = (event) => {
                const { type, id } = event.data;
                if (type === 'participant-join') {
                  console.log('Participant joined:', id);
                  window.opener.postMessage({ type: 'participant-joined', id, sessionId }, '*');
                }
              };
              
              window.addEventListener('beforeunload', () => {
                Object.values(activeVideoElements).forEach(videoElement => {
                  if (videoElement.srcObject) {
                    const tracks = videoElement.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    videoElement.srcObject = null;
                  }
                });
                
                if (window.localStream) {
                  const tracks = window.localStream.getTracks();
                  tracks.forEach(track => track.stop());
                  window.localStream = null;
                }
                
                channel.close();
                backupChannel.close();
              });
            </script>
          </body>
        </html>
      `;
      
      newWindow.document.write(html);
      newWindow.document.close();
      setTransmissionOpen(true);
      
      newWindow.onbeforeunload = () => {
        setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      };
      
      window.addEventListener('message', handleTransmissionMessage);
      
      updateTransmissionParticipants();
    }
  };
  
  const updateTransmissionParticipants = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const uniqueParticipants = [...new Map(
        participantList.map(p => [p.id, p])
      ).values()];
      
      const participantsWithStreams = uniqueParticipants.map(p => ({
        ...p,
        hasStream: p.active
      }));
      
      transmissionWindowRef.current.postMessage({
        type: 'update-participants',
        participants: participantsWithStreams
      }, '*');
    }
  };
  
  const handleTransmissionMessage = (event: MessageEvent) => {
    if (event.data.type === 'transmission-ready' && event.data.sessionId === sessionId) {
      updateTransmissionParticipants();
    }
    else if (event.data.type === 'participant-joined' && event.data.sessionId === sessionId) {
      handleParticipantJoin(event.data.id);
    }
  };

  const finishTransmission = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      setTransmissionOpen(false);
    }
    
    window.removeEventListener('message', handleTransmissionMessage);
    
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

  const handleParticipantJoin = (participantId: string) => {
    console.log("Participant joined:", participantId);
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      
      if (exists) {
        return prev.map(p => p.id === participantId ? { 
          ...p, 
          active: true, 
          hasVideo: true,
          connectedAt: p.connectedAt || Date.now() 
        } : p);
      }
      
      const participantName = `Participante ${prev.filter(p => !p.id.startsWith('placeholder-')).length + 1}`;
      const newParticipant = {
        id: participantId,
        name: participantName,
        active: true,
        selected: false,
        hasVideo: true,
        connectedAt: Date.now()
      };
      
      if (sessionId) {
        addParticipantToSession(sessionId, participantId, participantName);
      }
      
      toast({
        title: "Novo participante conectado",
        description: `${participantName} se conectou à sessão.`,
      });
      
      const filteredList = prev.filter(p => !p.id.startsWith('placeholder-') || p.active);
      return [...filteredList, newParticipant];
    });
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Live</h1>
      
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
                    disabled={transmissionOpen || !sessionId}
                  >
                    <MonitorPlay className="h-4 w-4 mr-2" />
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
                
                <TabsContent value="participants">
                  <ParticipantGrid 
                    participants={participantList}
                    onSelectParticipant={handleParticipantSelect}
                    onRemoveParticipant={handleParticipantRemove}
                  />
                </TabsContent>
                
                <TabsContent value="layout">
                  <TextSettings 
                    participantCount={participantCount}
                    setParticipantCount={setParticipantCount}
                    qrCodeDescription={qrCodeDescription}
                    setQrCodeDescription={setQrCodeDescription}
                    selectedFont={selectedFont}
                    setSelectedFont={setSelectedFont}
                    selectedTextColor={selectedTextColor}
                    setSelectedTextColor={setSelectedTextColor}
                    qrDescriptionFontSize={qrDescriptionFontSize}
                    setQrDescriptionFontSize={setQrDescriptionFontSize}
                  />
                </TabsContent>
                
                <TabsContent value="appearance">
                  <AppearanceSettings 
                    selectedBackgroundColor={selectedBackgroundColor}
                    setSelectedBackgroundColor={setSelectedBackgroundColor}
                    backgroundImage={backgroundImage}
                    onFileSelect={handleFileSelect}
                    onRemoveImage={removeBackgroundImage}
                    fileInputRef={fileInputRef}
                  />
                </TabsContent>
                
                <TabsContent value="qrcode">
                  <QrCodeSettings 
                    qrCodeGenerated={!!sessionId}
                    qrCodeVisible={qrCodeVisible}
                    qrCodeURL={qrCodeURL}
                    finalAction={finalAction}
                    setFinalAction={setFinalAction}
                    finalActionImage={finalActionImage}
                    setFinalActionImage={setFinalActionImage}
                    finalActionLink={finalActionLink}
                    setFinalActionLink={setFinalActionLink}
                    finalActionCoupon={finalActionCoupon}
                    setFinalActionCoupon={setFinalActionCouponCode}
                    onGenerateQRCode={handleGenerateQRCode}
                    onQRCodeToTransmission={handleQRCodeToTransmission}
                    autoJoin={autoJoin}
                    setAutoJoin={setAutoJoin}
                  />
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
              <LivePreview 
                qrCodeVisible={qrCodeVisible}
                qrCodeSvg={qrCodeSvg}
                qrCodePosition={qrCodePosition}
                setQrCodePosition={setQrCodePosition}
                qrDescriptionPosition={qrDescriptionPosition}
                setQrDescriptionPosition={setQrDescriptionPosition}
                qrCodeDescription={qrCodeDescription}
                selectedFont={selectedFont}
                selectedTextColor={selectedTextColor}
                qrDescriptionFontSize={qrDescriptionFontSize}
                backgroundImage={backgroundImage}
                selectedBackgroundColor={selectedBackgroundColor}
                participantList={participantList}
                participantCount={participantCount}
              />
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
              <div 
                className="bg-muted rounded-md overflow-hidden hover:opacity-90 transition-opacity cursor-pointer aspect-video" 
                onClick={handleFinalActionClick}
              >
                <img
                  src={finalActionImage || 'https://placehold.co/600x400/png?text=Imagem+Exemplo'}
                  alt="Final action"
                  className="object-cover w-full h-full"
                />
              </div>
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

export default LivePage;
