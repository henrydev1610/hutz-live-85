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
import { initHostWebRTC, setOnParticipantTrack, setLocalStream } from '@/utils/webrtc';

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
  
  const [participantStreams, setParticipantStreams] = useState<{[id: string]: MediaStream}>({});
  const [localStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [autoJoin, setAutoJoin] = useState(false);

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
    if (sessionId && transmissionOpen) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          console.log("Created host media stream for WebRTC initialization", stream);
          setLocalMediaStream(stream);
          setLocalStream(stream);
          
          const cleanup = initializeHostSession(sessionId, {
            onParticipantJoin: handleParticipantJoin,
            onParticipantLeave: (id) => {
              console.log(`Participant left: ${id}`);
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

          initHostWebRTC(sessionId, (participantId, track) => {
            console.log(`Received track from participant ${participantId}:`, track);
            handleParticipantTrack(participantId, track);
          });

          return () => {
            cleanup();
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
          };
        })
        .catch(err => {
          console.error("Error creating host media stream:", err);
          toast({
            title: "Erro ao inicializar câmera",
            description: "Não foi possível acessar a câmera para inicializar a transmissão.",
            variant: "destructive"
          });
        });
    }
    
    else if (sessionId && !transmissionOpen) {
      const cleanup = initializeHostSession(sessionId, {
        onParticipantJoin: handleParticipantJoin,
        onParticipantLeave: (id) => {
          console.log(`Participant left: ${id}`);
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

      initHostWebRTC(sessionId, (participantId, track) => {
        console.log(`Received track from participant ${participantId}:`, track);
        handleParticipantTrack(participantId, track);
      });

      return () => {
        cleanup();
      };
    }
  }, [sessionId, transmissionOpen]);

  const handleParticipantTrack = (participantId: string, track: MediaStreamTrack) => {
    console.log(`Processing track from participant ${participantId}:`, track);
    
    setParticipantStreams(prev => {
      if (prev[participantId]) {
        const existingStream = prev[participantId];
        const trackExists = existingStream.getTracks().some(t => t.id === track.id);
        
        if (!trackExists) {
          existingStream.addTrack(track);
          return { ...prev };
        }
        return prev;
      }
      
      return {
        ...prev,
        [participantId]: new MediaStream([track])
      };
    });
    
    setParticipantList(prev => 
      prev.map(p => p.id === participantId ? { ...p, hasVideo: true } : p)
    );
    
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const channel = new BroadcastChannel(`live-session-${sessionId}`);
      channel.postMessage({
        type: 'video-stream',
        participantId,
        stream: { hasStream: true }
      });
    }
  };

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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [sessionId, localStream]);

  useEffect(() => {
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const participant = participantList.find(p => p.id === participantId);
      if (participant) {
        if (participant.selected) {
          const previewContainer = document.getElementById(`preview-participant-video-${participantId}`);
          updateVideoElement(previewContainer, stream);
        }
        
        const gridContainer = document.getElementById(`participant-video-${participantId}`);
        updateVideoElement(gridContainer, stream);
      }
    });
  }, [participantList, participantStreams]);

  const updateVideoElement = (container: HTMLElement | null, stream: MediaStream) => {
    if (!container) {
      console.warn("Video container not found");
      return;
    }
    
    let videoElement = container.querySelector('video');
    
    if (!videoElement) {
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = 'w-full h-full object-cover';
      container.innerHTML = ''; // Clear any placeholder content
      container.appendChild(videoElement);
      console.log("Created new video element in container:", container.id);
    }
    
    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
      console.log(`Set video source for ${container.id} to stream with ${stream.getTracks().length} tracks`);
      videoElement.play().catch(err => console.error('Error playing video:', err));
    }
  };

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
                left: 25%;
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
                position: relative;
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
                ${Array.from({ length: Math.min(participantCount, 100) }, (_, i) => `
                  <div class="participant" id="participant-slot-${i}">
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
              let availableSlots = Array.from({ length: Math.min(participantCount, 100) }, (_, i) => i);
              let participantStreams = {};
              let activeVideoElements = {};
            
              function createVideoElement(slotElement, stream) {
                if (!slotElement) return;
                
                const existingVideo = slotElement.querySelector('video');
                if (existingVideo) {
                  if (existingVideo.srcObject !== stream) {
                    existingVideo.srcObject = stream;
                  }
                  return existingVideo;
                }
                
                slotElement.innerHTML = '';
                const videoElement = document.createElement('video');
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.muted = true;
                
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = 'cover';
                videoElement.style.transform = 'translateZ(0)';
                videoElement.style.backfaceVisibility = 'hidden';
                videoElement.style.webkitBackfaceVisibility = 'hidden';
                videoElement.style.willChange = 'transform';
                videoElement.style.transition = 'none';
                
                slotElement.appendChild(videoElement);
                videoElement.srcObject = stream;
                
                videoElement.play().catch(err => {
                  console.warn('Error playing video:', err);
                });
                
                activeVideoElements[slotElement.id] = videoElement;
                return videoElement;
              }
            
              async function getLocalStreamForDisplay() {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: false 
                  });
                  
                  console.log("Got local stream for display with tracks:", stream.getTracks().length);
                  return stream;
                } catch (e) {
                  console.error("Failed to get local stream:", e);
                  return null;
                }
              }
              
              channel.addEventListener('message', async (event) => {
                const data = event.data;
                
                if (data.type === 'video-stream' && data.participantId) {
                  console.log('Received video stream notification for participant:', data.participantId);
                  
                  if (!participantSlots[data.participantId] && availableSlots.length > 0) {
                    const slotIndex = availableSlots.shift();
                    participantSlots[data.participantId] = slotIndex;
                    
                    const slotElement = document.getElementById("participant-slot-" + slotIndex);
                    if (slotElement) {
                      if (!window.localPlaceholderStream) {
                        window.localPlaceholderStream = await getLocalStreamForDisplay();
                      }
                      
                      if (window.localPlaceholderStream) {
                        const videoEl = createVideoElement(slotElement, window.localPlaceholderStream);
                        
                        if (videoEl) {
                          videoEl.dataset.participantId = data.participantId;
                        }
                      }
                    }
                  }
                }
              });
            
              window.addEventListener('message', (event) => {
                if (event.data.type === 'update-participants') {
                  const { participants } = event.data;
                  console.log('Got participants update:', participants);
                  
                  participants.forEach(p => {
                    if (p.selected) {
                      if (!participantSlots[p.id] && availableSlots.length > 0) {
                        const slotIndex = availableSlots.shift();
                        participantSlots[p.id] = slotIndex;
                        
                        console.log('Assigned slot', slotIndex, 'to participant', p.id);
                        
                        const slotElement = document.getElementById("participant-slot-" + slotIndex);
                        if (slotElement) {
                          slotElement.innerHTML = \`
                            <div style="text-align: center; padding: 10px;">
                              <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                              <div style="margin-top: 5px; font-size: 12px;">\${p.name}</div>
                            </div>
                          \`;
                          
                          slotElement.dataset.participantId = p.id;
                        }
                      }
                    } else {
                      if (participantSlots[p.id] !== undefined) {
                        const slotIndex = participantSlots[p.id];
                        delete participantSlots[p.id];
                        availableSlots.push(slotIndex);
                        
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
                          
                          delete slotElement.dataset.participantId;
                        }
                      }
                    }
                  });
                  
                  Object.keys(participantSlots).forEach(participantId => {
                    const isStillSelected = participants.some(p => p.id === participantId && p.selected);
                    if (!isStillSelected) {
                      const slotIndex = participantSlots[participantId];
                      delete participantSlots[participantId];
                      availableSlots.push(slotIndex);
                      
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
                        
                        delete slotElement.dataset.participantId;
                      }
                    }
                  });
                }
              });
              
              window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              
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
                
                if (window.localPlaceholderStream) {
                  const tracks = window.localPlaceholderStream.getTracks();
                  tracks.forEach(track => track.stop());
                  window.localPlaceholderStream = null;
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
      const participantsWithStreams = participantList.map(p => ({
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
      
      Object.entries(participantStreams).forEach(([participantId, stream]) => {
        const participant = participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          const channel = new BroadcastChannel(`live-session-${sessionId}`);
          channel.postMessage({
            type: 'video-stream',
            participantId,
            stream: {
              hasStream: true
            }
          });
        }
      });
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
        return prev.map(p => p.id === participantId ? { ...p, active: true, hasVideo: true, connectedAt: Date.now() } : p);
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
      
      // Remove the last placeholder participant and add the new real participant
      const filteredList = prev.filter(p => !p.id.startsWith('placeholder-') || prev.indexOf(p) < prev.length - 1);
      return [...filteredList, newParticipant];
    });
    
    // Auto-select the new participant if auto-join is enabled
    if (autoJoin) {
      setTimeout(() => {
        setParticipantList(prev => prev.map(p => p.id === participantId ? { ...p, selected: true } : p));
        updateTransmissionParticipants();
      }, 1000);
    }
  };

  const handleAutoJoinToggle = () => {
    setAutoJoin(!autoJoin);
  };
  
  return (
    <div className="container max-w-7xl mx-auto p-4">
      <div className="space-y-4">
        <Card className="border-white/10 bg-black/40">
          <CardHeader className="p-4">
            <CardTitle className="text-xl md:text-2xl">Momento Live</CardTitle>
            <CardDescription>Gerencie sua transmissão ao vivo.</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 p-4 pt-0">
            {transmissionOpen ? (
              <div className="bg-green-500/20 border border-green-500/30 text-green-500 p-3 rounded flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                  <span className="font-semibold">Transmissão em andamento</span>
                </div>
                <Button 
                  variant="outline" 
                  className="text-white border-white/20 hover:bg-white/20"
                  onClick={finishTransmission}
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </div>
            ) : sessionId ? (
              <div className="bg-blue-500/20 border border-blue-500/30 text-blue-500 p-3 rounded flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                  <span className="font-semibold">Sessão criada - pronta para iniciar</span>
                </div>
                <Button 
                  variant="default" 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={openTransmissionWindow}
                >
                  <MonitorPlay className="h-4 w-4 mr-2" />
                  Iniciar Transmissão
                </Button>
              </div>
            ) : null}
          
            <Tabs defaultValue="participants" className="space-y-4">
              <TabsList className="grid grid-cols-4 bg-background/5 text-white border border-white/10">
                <TabsTrigger value="participants" className="data-[state=active]:bg-white/10">
                  <Users className="h-4 w-4 mr-2" />
                  Participantes
                </TabsTrigger>
                <TabsTrigger value="appearance" className="data-[state=active]:bg-white/10">
                  <Palette className="h-4 w-4 mr-2" />
                  Aparência
                </TabsTrigger>
                <TabsTrigger value="text" className="data-[state=active]:bg-white/10">
                  <span className="font-serif mr-2">T</span>
                  Texto
                </TabsTrigger>
                <TabsTrigger value="qrcode" className="data-[state=active]:bg-white/10">
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </TabsTrigger>
              </TabsList>
              
              <div className="grid md:grid-cols-[1fr_300px] gap-6">
                <div>
                  <LivePreview
                    participants={participantList.filter(p => p.selected)}
                    participantCount={participantCount}
                    selectedBackgroundColor={selectedBackgroundColor}
                    backgroundImage={backgroundImage}
                    qrCodeSvg={qrCodeSvg}
                    qrCodeVisible={qrCodeVisible}
                    qrCodePosition={qrCodePosition}
                    qrCodeDescription={qrCodeDescription}
                    qrDescriptionPosition={qrDescriptionPosition}
                    qrDescriptionFontSize={qrDescriptionFontSize}
                    selectedFont={selectedFont}
                    selectedTextColor={selectedTextColor}
                    participantStreams={participantStreams}
                  />
                </div>
                
                <div>
                  <TabsContent value="participants" className="space-y-4 m-0">
                    <ParticipantGrid
                      participants={participantList}
                      onSelectParticipant={handleParticipantSelect}
                      onRemoveParticipant={handleParticipantRemove}
                      participantStreams={participantStreams}
                    />
                  </TabsContent>
                  
                  <TabsContent value="appearance" className="space-y-4 m-0">
                    <AppearanceSettings
                      selectedBackgroundColor={selectedBackgroundColor}
                      setSelectedBackgroundColor={setSelectedBackgroundColor}
                      backgroundImage={backgroundImage}
                      onFileSelect={handleFileSelect}
                      onRemoveImage={removeBackgroundImage}
                      fileInputRef={fileInputRef}
                    />
                  </TabsContent>
                  
                  <TabsContent value="text" className="space-y-4 m-0">
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
                  
                  <TabsContent value="qrcode" className="space-y-4 m-0">
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
                      setAutoJoin={handleAutoJoinToggle}
                    />
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>
        
        <Dialog open={finalActionOpen} onOpenChange={setFinalActionOpen}>
          <DialogContent className="bg-black text-white border-white/10">
            <DialogHeader>
              <DialogTitle>Ação Final da Transmissão</DialogTitle>
              <DialogDescription>
                A transmissão foi finalizada. Esta tela será exibida para todos os participantes.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 border border-white/10 rounded-md text-center">
                <p className="text-sm mb-2">Esta tela será fechada automaticamente em:</p>
                <span className="text-xl font-bold">{finalActionTimeLeft} segundos</span>
              </div>
              
              {finalAction === 'image' && finalActionImage && (
                <div 
                  className="aspect-video bg-white/5 rounded-md flex items-center justify-center cursor-pointer relative overflow-hidden"
                  onClick={handleFinalActionClick}
                >
                  <img 
                    src={finalActionImage} 
                    alt="Imagem final" 
                    className="w-full h-full object-contain" 
                  />
                  {finalActionLink && (
                    <div className="absolute bottom-2 right-2 bg-white/20 text-white text-xs px-2 py-1 rounded-full flex items-center">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Clique para acessar
                    </div>
                  )}
                </div>
              )}
              
              {finalAction === 'coupon' && (
                <div className="p-6 border border-accent/50 rounded-md text-center space-y-4">
                  <p className="text-sm">Utilize o código abaixo para obter seu desconto:</p>
                  <div className="p-3 bg-white/5 rounded font-mono text-accent text-xl">
                    {finalActionCoupon}
                  </div>
                  {finalActionLink && (
                    <Button 
                      variant="default" 
                      className="w-full"
                      onClick={handleFinalActionClick}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Resgatar Cupom
                    </Button>
                  )}
                </div>
              )}
              
              <Button 
                variant="outline" 
                className="w-full border-white/20"
                onClick={closeFinalAction}
              >
                <X className="h-4 w-4 mr-2" />
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default LivePage;
