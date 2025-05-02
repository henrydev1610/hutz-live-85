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
import { initHostWebRTC, setOnParticipantTrack } from '@/utils/webrtc';
import BackButton from '@/components/common/BackButton';

const LivePage = () => {
  const [participantCount, setParticipantCount] = useState(4);
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [participantList, setParticipantList] = useState<{id: string, name: string, joinedAt: number, lastActive: number, active: boolean, selected: boolean, hasVideo: boolean, connectedAt?: number}[]>([]);
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

  useEffect(() => {
    if (participantList.length === 0) {
      const initialParticipants = Array(4).fill(0).map((_, i) => ({
        id: `placeholder-${i}`,
        name: `Participante ${i + 1}`,
        joinedAt: Date.now(),
        lastActive: Date.now(),
        active: false,
        selected: false,
        hasVideo: false
      }));
      setParticipantList(initialParticipants);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      // Store the session ID in sessionStorage so it can be accessed from other components
      window.sessionStorage.setItem('currentSessionId', sessionId);
      
      // Initialize the host session without activating the camera
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

      // Initialize WebRTC without camera for host
      initHostWebRTC(sessionId, (participantId, track) => {
        console.log(`Received track from participant ${participantId}:`, track);
        handleParticipantTrack(participantId, track);
      });

      return () => {
        cleanup();
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [sessionId]);

  const handleParticipantTrack = (participantId: string, track: MediaStreamTrack) => {
    console.log(`Processing track from participant ${participantId}:`, track);
    console.log(`Track details: kind=${track.kind}, id=${track.id}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
    
    // Log track settings if available
    if (track.getSettings) {
      try {
        const settings = track.getSettings();
        console.log(`Track settings: width=${settings.width}, height=${settings.height}, frameRate=${settings.frameRate}`);
      } catch (e) {
        console.log("Could not get track settings:", e);
      }
    }
    
    setParticipantStreams(prev => {
      // If we already have a stream for this participant
      if (prev[participantId]) {
        const existingStream = prev[participantId];
        const trackExists = existingStream.getTracks().some(t => t.id === track.id);
        
        if (!trackExists) {
          console.log(`Adding new track ${track.id} to existing stream for participant ${participantId}`);
          existingStream.addTrack(track);
          
          // Check the stream is still valid after adding the track
          console.log(`Stream for ${participantId} now has ${existingStream.getTracks().length} tracks`);
          console.log(`Stream active status: ${existingStream.active}`);
          
          return { ...prev };
        }
        console.log(`Track ${track.id} already exists in stream for participant ${participantId}`);
        return prev;
      }
      
      // Create a new stream for this participant
      console.log(`Creating new stream for participant ${participantId} with track ${track.id}`);
      const newStream = new MediaStream([track]);
      
      console.log(`New stream created with ${newStream.getTracks().length} tracks`);
      console.log(`Stream active status: ${newStream.active}`);
      
      return {
        ...prev,
        [participantId]: newStream
      };
    });
    
    // Update the participant list to indicate this participant has video
    setParticipantList(prev => 
      prev.map(p => p.id === participantId ? { ...p, hasVideo: true } : p)
    );
    
    // Forward to transmission window if it's open
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      try {
        const channel = new BroadcastChannel(`live-session-${sessionId}`);
        channel.postMessage({
          type: 'video-stream',
          participantId,
          stream: { hasStream: true, trackId: track.id }
        });
        setTimeout(() => channel.close(), 500);
      } catch (e) {
        console.error("Error sending video stream notification to transmission window:", e);
      }
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
      videoElement.setAttribute('playsinline', ''); // Important for iOS Safari
      videoElement.className = 'w-full h-full object-cover';
      container.innerHTML = ''; // Clear any placeholder content
      container.appendChild(videoElement);
      console.log("Created new video element in container:", container.id);
    }
    
    // Check if we need to update the stream
    if (videoElement.srcObject !== stream) {
      // Log stream info for debugging
      console.log(`Setting video source for ${container.id} to stream with ${stream.getTracks().length} tracks`);
      stream.getTracks().forEach(track => {
        console.log(`- Track: ${track.kind} (${track.id}), enabled=${track.enabled}, muted=${track.muted}, state=${track.readyState}`);
        // Log track settings if available
        if (track.getSettings) {
          try {
            const settings = track.getSettings();
            console.log(`  Settings: width=${settings.width}, height=${settings.height}, frameRate=${settings.frameRate}`);
          } catch (e) {
            console.log("  Could not get track settings:", e);
          }
        }
      });
      
      // Set the stream and play
      videoElement.srcObject = stream;
      
      videoElement.play().catch(err => {
        console.error(`Error playing video in ${container.id}:`, err);
        
        // Try again with a delay - sometimes helps with timing issues
        setTimeout(() => {
          videoElement.play().catch(retryErr => {
            console.error(`Error playing video in ${container.id} on retry:`, retryErr);
          });
        }, 500);
      });
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
    setParticipantList(prev => {
      const updatedList = prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p);
      
      // Notify the transmission window about the change
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.postMessage({
          type: 'update-participants',
          participants: updatedList
        }, '*');
      }
      
      return updatedList;
    });
  };

  const handleParticipantRemove = (id: string) => {
    setParticipantList(prev => {
      const newList = prev.filter(p => p.id !== id);
      
      const nextId = `placeholder-${prev.length}`;
      const now = Date.now();
      const newParticipant = {
        id: nextId,
        name: `Participante ${newList.length + 1}`,
        joinedAt: now,
        lastActive: now,
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
              window.transmissionWindow = true;
              window.isKeepAliveActive = true;
              
              const sessionId = "${sessionId}";
              console.log("Live transmission window opened for session:", sessionId);
              
              const channel = new BroadcastChannel("live-session-" + sessionId);
              const backupChannel = new BroadcastChannel("telao-session-" + sessionId);
              
              let participantSlots = {};
              let availableSlots = Array.from({ length: Math.min(${participantCount}, 100) }, (_, i) => i);
              let participantStreams = {};
              let activeVideoElements = {};
              
              // Keep the window alive by preventing it from closing automatically
              function keepAlive() {
                if (window.isKeepAliveActive) {
                  console.log("Keeping transmission window alive");
                  setTimeout(keepAlive, 1000);
                }
              }
              keepAlive();

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

              // Modified - Do not use real camera, create a mock placeholder video stream
              function createPlaceholderStream() {
                // Create a canvas element
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw a placeholder icon
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 - 50, 60, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 + 90, 100, 0, Math.PI, true);
                ctx.fill();
                
                // Try to create a stream from the canvas
                try {
                  const stream = canvas.captureStream(30);
                  console.log("Created placeholder stream with", stream.getTracks().length, "tracks");
                  return stream;
                } catch (error) {
                  console.error("Failed to create placeholder stream:", error);
                  return null;
                }
              }
              
              // Listen for participant heartbeat to keep track of active participants
              setInterval(() => {
                if (window.opener && !window.opener.closed) {
                  const activeSlots = Object.keys(participantSlots);
                  activeSlots.forEach(participantId => {
                    try {
                      channel.postMessage({
                        type: 'participant-heartbeat',
                        participantId,
                        timestamp: Date.now()
                      });
                    } catch (e) {
                      console.error("Error sending participant heartbeat:", e);
                    }
                  });
                }
              }, 2000);
              
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
                        window.localPlaceholderStream = createPlaceholderStream();
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
                else if (data.type === 'request-participant-streams') {
                  // Re-broadcast participant streams to ensure they're displayed
                  Object.keys(participantSlots).forEach(participantId => {
                    channel.postMessage({
                      type: 'participant-heartbeat',
                      participantId,
                      timestamp: Date.now()
                    });
                  });
                }
              });

              function updateQRPositions(data) {
                const qrCodeElement = document.querySelector('.qr-code');
                const qrDescriptionElement = document.querySelector('.qr-description');
                
                if (qrCodeElement && data.qrCodePosition) {
                  qrCodeElement.style.left = data.qrCodePosition.x + 'px';
                  qrCodeElement.style.top = data.qrCodePosition.y + 'px';
                  qrCodeElement.style.width = data.qrCodePosition.width + 'px';
                  qrCodeElement.style.height = data.qrCodePosition.height + 'px';
                  qrCodeElement.style.display = data.qrCodeVisible ? 'flex' : 'none';
                  
                  if (data.qrCodeSvg) {
                    const imgElement = qrCodeElement.querySelector('img') || document.createElement('img');
                    imgElement.src = data.qrCodeSvg;
                    imgElement.alt = "QR Code";
                    if (!imgElement.parentNode) {
                      qrCodeElement.appendChild(imgElement);
                    }
                  }
                }
                
                if (qrDescriptionElement && data.qrDescriptionPosition) {
                  qrDescriptionElement.style.left = data.qrDescriptionPosition.x + 'px';
                  qrDescriptionElement.style.top = data.qrDescriptionPosition.y + 'px';
                  qrDescriptionElement.style.width = data.qrDescriptionPosition.width + 'px';
                  qrDescriptionElement.style.height = data.qrDescriptionPosition.height + 'px';
                  qrDescriptionElement.style.fontSize = data.qrDescriptionFontSize + 'px';
                  qrDescriptionElement.style.fontFamily = data.selectedFont;
                  qrDescriptionElement.style.color = data.selectedTextColor;
                  qrDescriptionElement.style.display = data.qrCodeVisible ? 'flex' : 'none';
                  qrDescriptionElement.textContent = data.qrCodeDescription;
                }
              }

              window.addEventListener('message', (event) => {
                if (event.data.type === 'update-participants') {
                  const { participants } = event.data;
                  console.log('Got participants update:', participants);
                  
                  // Track which participants are currently selected
                  const selectedParticipants = participants.filter(p => p.selected);
                  
                  // Ensure participants that are selected get assigned to slots first
                  selectedParticipants.forEach(p => {
                    if (!participantSlots[p.id] && availableSlots.length > 0) {
                      const slotIndex = availableSlots.shift();
                      participantSlots[p.id] = slotIndex;
                      
                      console.log('Assigned slot', slotIndex, 'to selected participant', p.id);
                      
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
                        
                        // Send a broadcast to request the video stream again
                        channel.postMessage({
                          type: 'request-video-stream',
                          participantId: p.id
                        });
                      }
                    }
                  });
                  
                  // Handle participants that are no longer selected
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
                else if (event.data.type === 'update-qr-positions') {
                  updateQRPositions(event.data);
                }
                else if (event.data.type === 'keep-alive') {
                  // Keep alive message received
                  console.log("Keep-alive received");
                }
                else if (event.data.type === 'participant-joined') {
                  // Forward participant join events to all windows via broadcast channel
                  channel.postMessage({
                    type: 'participant-join',
                    id: event.data.id
                  });
                }
              });
              
              window.onbeforeunload = function() {
                if (!window.isClosingIntentionally) {
                  return "Are you sure you want to leave the transmission?";
                }
              };
              
              window.isClosingIntentionally = false;
              
              // Send ready message to parent window
              window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              
              // Send heartbeat to parent window
              setInterval(() => {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({ type: 'transmission-heartbeat', sessionId }, '*');
                }
              }, 2000);
              
              // Listen for broadcast channel messages
              channel.onmessage = (event) => {
                const { type, id } = event.data;
                if (type === 'participant-join') {
                  console.log('Participant joined:', id);
                  if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'participant-joined', id, sessionId }, '*');
                  }
                }
              };
              
              window.addEventListener('beforeunload', () => {
                window.isKeepAliveActive = false;
                window.isClosingIntentionally = true;
                
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
      
      // Set up a keep-alive interval to prevent the window from closing
      const keepAliveInterval = setInterval(() => {
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          try {
            transmissionWindowRef.current.postMessage({ type: 'keep-alive' }, '*');
          } catch (e) {
            console.error("Error sending keep-alive:", e);
            clearInterval(keepAliveInterval);
          }
        } else {
          clearInterval(keepAliveInterval);
        }
      }, 1000);
      
      newWindow.addEventListener('beforeunload', () => {
        clearInterval(keepAliveInterval);
        setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      });
      
      window.addEventListener('message', handleTransmissionMessage);
      
      // Wait a bit longer before sending initial data to ensure window is fully loaded
      setTimeout(() => {
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          transmissionWindowRef.current.postMessage({
            type: 'update-qr-positions',
            qrCodePosition,
            qrDescriptionPosition,
            qrCodeVisible,
            qrCodeSvg,
            qrCodeDescription,
            selectedFont,
            selectedTextColor,
            qrDescriptionFontSize
          }, '*');
          
          // Send the initial participant list
          updateTransmissionParticipants();
        }
      }, 500);
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
        return prev.map(p => p.id === participantId ? { ...p, active: true, hasVideo: true, lastActive: Date.now(), connectedAt: Date.now() } : p);
      }
      
      const participantName = `Participante ${prev.filter(p => !p.id.startsWith('placeholder-')).length + 1}`;
      const now = Date.now();
      const newParticipant = {
        id: participantId,
        name: participantName,
        joinedAt: now,
        lastActive: now,
        active: true,
        selected: true,
        hasVideo: true,
        connectedAt: now
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
    
    // Immediately broadcast participant join to transmission window
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'participant-joined',
        id: participantId,
        sessionId
      }, '*');
    }
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  useEffect(() => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'update-qr-positions',
        qrCodePosition,
        qrDescriptionPosition,
        qrCodeVisible,
        qrCodeSvg,
        qrCodeDescription,
        selectedFont,
        selectedTextColor,
        qrDescriptionFontSize
      }, '*');
    }
  }, [
    qrCodePosition, 
    qrDescriptionPosition, 
    qrCodeVisible, 
    qrCodeSvg, 
    qrCodeDescription,
    selectedFont,
    selectedTextColor,
    qrDescriptionFontSize
  ]);

  return (
    <div className="min-h-screen container mx-auto py-8 px-4 relative">
      <BackButton />
      <h1 className="text-3xl font-bold mb-8 hutz-gradient-text text-center">Momento Live</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 min-h-[700px]">
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
                    participantStreams={participantStreams}
                    sessionId={sessionId || ''}
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
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 min-h-[700px]">
            <CardHeader>
              <CardTitle>
                Pré-visualização
              </CardTitle>
              <CardDescription>
                Veja como sua transmissão será exibida
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-[650px] flex items-center justify-center">
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Dialog open={finalActionOpen} onOpenChange={setFinalActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ação final enviada!</DialogTitle>
            <DialogDescription>
              O conteúdo foi exibido para os participantes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <p className="text-sm text-muted-foreground">
                Esta tela será fechada automaticamente em {finalActionTimeLeft} segundos.
              </p>
            </div>
            <Button variant="outline" onClick={closeFinalAction}>
              Fechar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LivePage;
