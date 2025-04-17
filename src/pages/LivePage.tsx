import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { generateSessionId, isSessionActive, getSessionParticipants, addParticipantToSession, updateParticipantStatus } from '@/utils/sessionUtils';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import ParticipantGrid from '@/components/live/ParticipantGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check, Copy, Link, RefreshCw, Tv2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const FONTS = [
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Times New Roman, serif",
  "Courier New, monospace",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Impact, sans-serif",
  "Comic Sans MS, cursive",
  "Trebuchet MS, sans-serif",
  "Arial Black, sans-serif",
];

const LivePage = () => {
  const [sessionId, setSessionId] = useState<string>(() => {
    const storedSessionId = localStorage.getItem('live-session-id');
    return storedSessionId || generateSessionId();
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeDescription, setQrCodeDescription] = useState<string>("Acesse aqui para participar");
  const [participantList, setParticipantList] = useState<any[]>([]);
  const [transmissionOpen, setTransmissionOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(6);
  const [selectedFont, setSelectedFont] = useState<string>("Arial, sans-serif");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [transmissionWindowRef, setTransmissionWindowRef] = useState<React.MutableRefObject<Window | null>>(useRef(null));
  const [isSessionActiveState, setIsSessionActiveState] = useState<boolean>(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const initialSessionId = searchParams.get("session") || localStorage.getItem('live-session-id') || generateSessionId();
    setSessionId(initialSessionId);
    localStorage.setItem('live-session-id', initialSessionId);
  }, [searchParams]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('live-session-id', sessionId);
      generateQrCode(sessionId);
      checkSessionStatus(sessionId);
      loadParticipants(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    if (transmissionOpen && transmissionWindowRef.current) {
      updateTransmissionParticipants();
    }
  }, [selectedParticipants, transmissionOpen]);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    if (sessionId) {
      cleanupFn = initializeHostSession(sessionId, {
        onParticipantJoin: handleParticipantJoin,
        onParticipantLeave: handleParticipantLeave,
        onParticipantHeartbeat: handleParticipantHeartbeat
      });
    }

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [sessionId]);

  const generateQrCode = async (sessionId: string) => {
    try {
      const url = `${window.location.origin}/telao/${sessionId}`;
      const svg = await QRCode.toString(url, { type: 'svg' });
      setQrCodeSvg(svg);
      const generatedQrCode = await QRCode.toDataURL(url);
      setQrCode(generatedQrCode);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const checkSessionStatus = async (sessionId: string) => {
    const isActive = isSessionActive(sessionId);
    setIsSessionActiveState(isActive);
  };

  const loadParticipants = (sessionId: string) => {
    const participants = getSessionParticipants(sessionId);
    setParticipantList(participants);
  };

  const handleParticipantJoin = (participantId: string) => {
    setParticipantList(prev => {
      const exists = prev.some(p => p.id === participantId);
      if (exists) {
        return prev.map(p => p.id === participantId ? { ...p, active: true } : p);
      }
      
      const newParticipant = {
        id: participantId,
        name: `Participante ${prev.length + 1}`,
        active: true,
        selected: false // Changed to false - no longer auto-selected
      };
      
      toast({
        title: "Novo participante conectado",
        description: `Um novo participante se conectou à sessão.`,
      });
      
      return [...prev, newParticipant];
    });
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  const handleParticipantLeave = (participantId: string) => {
    setParticipantList(prev => prev.map(p => p.id === participantId ? { ...p, active: false } : p));
    setTimeout(updateTransmissionParticipants, 500);
  };

  const handleParticipantHeartbeat = (participantId: string) => {
    setParticipantList(prev => prev.map(p => p.id === participantId ? { ...p, active: true } : p));
  };

  const handleSelectParticipant = (id: string) => {
    setParticipantList(prev =>
      prev.map(p =>
        p.id === id ? { ...p, selected: !p.selected } : p
      )
    );
    
    setSelectedParticipants(prev => {
      if (prev.includes(id)) {
        return prev.filter(participantId => participantId !== id);
      } else {
        return [...prev, id];
      }
    });
    
    setTimeout(updateTransmissionParticipants, 500);
  };

  const handleRemoveParticipant = (id: string) => {
    setParticipantList(prev => prev.filter(p => p.id !== id));
    setTimeout(updateTransmissionParticipants, 500);
  };

  const handleEndSession = () => {
    cleanupSession(sessionId);
    setIsSessionActiveState(false);
    setTransmissionOpen(false);
    setParticipantList([]);
    toast({
      title: "Sessão encerrada",
      description: "A sessão foi encerrada e todos os participantes foram desconectados.",
    });
  };

  const handleFontChange = (font: string) => {
    setSelectedFont(font);
  };

  const handleBackgroundImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateTransmissionParticipants = () => {
    if (transmissionWindowRef.current) {
      transmissionWindowRef.current.postMessage({
        type: 'update-participants',
        participants: participantList
      }, '*');
    }
  };

  const openTransmissionWindow = () => {
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    
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
                width: 100%;
                height: 100%;
              }
              
              .content-wrapper {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
              }
              
              .bg-image {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: 0;
              }
              
              .participants-grid {
                position: relative;
                z-index: 1;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 10px;
                padding: 10px;
                height: 100%;
              }
              
              .participant {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              
              .participant-icon {
                width: 50%;
                height: 50%;
                color: rgba(255, 255, 255, 0.3);
              }
              
              .qr-code {
                position: absolute;
                bottom: 20px;
                left: 20px;
                z-index: 2;
                background-color: rgba(0, 0, 0, 0.8);
                padding: 10px;
                border-radius: 5px;
              }
              
              .qr-code img {
                width: 100px;
                height: 100px;
              }
              
              .qr-description {
                position: absolute;
                bottom: 5px;
                left: 20px;
                z-index: 3;
                color: white;
                font-size: 0.8em;
              }
              
              .live-indicator {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 4;
                display: flex;
                align-items: center;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 5px 8px;
                border-radius: 5px;
                font-size: 0.9em;
              }
              
              .live-dot {
                width: 8px;
                height: 8px;
                background-color: red;
                border-radius: 50%;
                margin-right: 5px;
                animation: pulse 1s infinite alternate;
              }
              
              @keyframes pulse {
                0% {
                  opacity: 0.5;
                }
                100% {
                  opacity: 1;
                }
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
              
              .participant video::-webkit-media-controls {
                display: none !important;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="content-wrapper">
                ${backgroundImage ? `<img src="${backgroundImage}" class="bg-image" alt="Background" />` : ''}
                
                <div class="participants-grid" id="participants-container">
                  ${Array.from({ length: participantCount }, (_, i) => `
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
              let availableSlots = Array.from({ length: ${participantCount} }, (_, i) => i);
              let participantStreams = {};
              
              // Helper function to create a stable video element with anti-flicker protections
              function createVideoElement(slotElement, participantId) {
                slotElement.innerHTML = '';
                
                // Create a more stable container for the video
                const videoContainer = document.createElement('div');
                videoContainer.style.width = '100%';
                videoContainer.style.height = '100%';
                videoContainer.style.position = 'relative';
                videoContainer.style.overflow = 'hidden';
                slotElement.appendChild(videoContainer);
                
                const videoElement = document.createElement('video');
                videoElement.autoplay = true;
                videoElement.playsInline = true;
                videoElement.muted = true;
                videoElement.setAttribute('playsinline', '');
                videoElement.setAttribute('webkit-playsinline', '');
                
                // Critical anti-flicker styles
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = 'cover';
                videoElement.style.transform = 'translateZ(0)';
                videoElement.style.backfaceVisibility = 'hidden';
                videoElement.style.WebkitBackfaceVisibility = 'hidden';
                videoElement.style.WebkitTransform = 'translateZ(0)';
                videoElement.style.willChange = 'transform';
                videoElement.style.transition = 'none';
                
                // Prevent transformation flicker in mobile
                videoElement.style.webkitTransformStyle = 'preserve-3d';
                videoElement.style.transformStyle = 'preserve-3d';
                
                videoContainer.appendChild(videoElement);
                
                // Add a nameplate
                const nameElement = document.createElement('div');
                nameElement.style.position = 'absolute';
                nameElement.style.bottom = '4px';
                nameElement.style.left = '4px';
                nameElement.style.right = '4px';
                nameElement.style.padding = '2px 4px';
                nameElement.style.fontSize = '10px';
                nameElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
                nameElement.style.borderRadius = '2px';
                nameElement.style.color = 'white';
                nameElement.style.textAlign = 'center';
                nameElement.innerText = 'Participante';
                videoContainer.appendChild(nameElement);
                
                // Get remote stream from participant
                setupRemoteStream(participantId, videoElement, nameElement);
                
                return videoElement;
              }
              
              // Function to get the participant's stream from WebRTC
              function setupRemoteStream(participantId, videoElement, nameElement) {
                console.log('Setting up remote stream for participant:', participantId);
                
                // Try to connect to the participant's stream
                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                  .then(stream => {
                    console.log('Got local camera for preview');
                    
                    // Set this as a temporary placeholder
                    try {
                      videoElement.srcObject = stream;
                      videoElement.play().catch(err => console.warn('Error playing video:', err));
                      
                      // Request the actual participant stream in the background
                      const remoteFindInterval = setInterval(() => {
                        if (participantStreams[participantId]?.hasStream) {
                          console.log('Found video stream for participant:', participantId);
                          clearInterval(remoteFindInterval);
                          
                          const infoData = participantStreams[participantId].info;
                          if (infoData?.hasStream) {
                            nameElement.innerText = infoData.name || 'Participante';
                          }
                        }
                      }, 1000);
                      
                      // After 30 seconds, give up trying to find the stream
                      setTimeout(() => clearInterval(remoteFindInterval), 30000);
                    } catch (err) {
                      console.error('Error setting stream source:', err);
                    }
                  })
                  .catch(err => {
                    console.error('Error accessing camera for participant display:', err);
                  });
              }
              
              // Listen for video stream information
              channel.addEventListener('message', (event) => {
                const data = event.data;
                if (data.type === 'video-stream-info' && data.hasStream) {
                  console.log('Received video stream info for:', data.id);
                  participantStreams[data.id] = {
                    hasStream: true,
                    lastUpdate: Date.now(),
                    info: data
                  };
                  
                  // Make sure this participant is displayed if they are selected
                }
              });
              
              // Backup channel for redundancy
              backupChannel.addEventListener('message', (event) => {
                const data = event.data;
                if (data.type === 'video-stream-info' && data.hasStream) {
                  console.log('Received video stream info from backup channel:', data.id);
                  participantStreams[data.id] = {
                    hasStream: true,
                    lastUpdate: Date.now(),
                    info: data
                  };
                }
              });
              
              // Main function to update participant display
              function updateParticipantDisplay() {
                window.addEventListener('message', (event) => {
                  if (event.data.type === 'update-participants') {
                    const { participants } = event.data;
                    console.log('Got participants update:', participants);
                    
                    // Process selected participants
                    participants.forEach(participant => {
                      if (participant.selected) {
                        if (!participantSlots[participant.id] && availableSlots.length > 0) {
                          const slotIndex = availableSlots.shift();
                          participantSlots[participant.id] = slotIndex;
                          
                          console.log('Assigned slot', slotIndex, 'to participant', participant.id);
                          
                          const slotElement = document.getElementById("participant-slot-" + slotIndex);
                          if (slotElement) {
                            createVideoElement(slotElement, participant.id);
                          }
                        }
                      } else {
                        // Handle deselected participants
                        if (participantSlots[participant.id] !== undefined) {
                          const slotIndex = participantSlots[participant.id];
                          delete participantSlots[participant.id];
                          availableSlots.push(slotIndex);
                          
                          const slotElement = document.getElementById("participant-slot-" + slotIndex);
                          if (slotElement) {
                            slotElement.innerHTML = \`
                              <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                              </svg>
                            \`;
                          }
                        }
                      }
                    });
                    
                    // Clean up any slots that are no longer needed
                    Object.keys(participantSlots).forEach(participantId => {
                      const isStillSelected = participants.some(p => p.id === participantId && p.selected);
                      if (!isStillSelected) {
                        const slotIndex = participantSlots[participantId];
                        delete participantSlots[participantId];
                        availableSlots.push(slotIndex);
                        
                        const slotElement = document.getElementById("participant-slot-" + slotIndex);
                        if (slotElement) {
                          slotElement.innerHTML = \`
                            <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                          \`;
                        }
                      }
                    });
                  }
                });
                
                window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              }
              
              updateParticipantDisplay();
              
              // Request updates periodically
              setInterval(() => {
                window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              }, 5000);
              
              // Listen for participant joins
              channel.onmessage = (event) => {
                const { type, id } = event.data;
                if (type === 'participant-join') {
                  console.log('Participant joined:', id);
                  window.opener.postMessage({ type: 'participant-joined', id, sessionId }, '*');
                }
              };
              
              // Clean up when closing
              window.addEventListener('beforeunload', () => {
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

  const handleTransmissionMessage = (event: MessageEvent) => {
    if (event.data.type === 'transmission-ready' && event.data.sessionId === sessionId) {
      updateTransmissionParticipants();
    }
  };

  const handleNewSession = () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    localStorage.setItem('live-session-id', newSessionId);
    generateQrCode(newSessionId);
    setIsSessionActiveState(true);
    setParticipantList([]);
    toast({
      title: "Nova sessão criada",
      description: `Uma nova sessão com ID ${newSessionId} foi criada.`,
    });
  };
  
  const handleCopySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    toast({
      title: "ID da sessão copiado",
      description: "O ID da sessão foi copiado para a área de transferência.",
    });
  };

  return (
    <div className="min-h-screen bg-secondary/40 backdrop-blur-lg text-white">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Momento Live</h1>

        <Card className="mb-4 bg-secondary/60 border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium">Sessão</h2>
                <p className="text-sm text-white/60">ID da sessão: {sessionId}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-white/20" onClick={handleCopySessionId}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar ID
                </Button>
                <Button variant="outline" size="sm" className="border-white/20" onClick={handleNewSession}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Nova Sessão
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="qr-description" className="text-sm">Descrição do QR Code:</Label>
                <Input 
                  id="qr-description"
                  className="bg-secondary/80 border-white/20 text-white"
                  value={qrCodeDescription}
                  onChange={(e) => setQrCodeDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="participant-count" className="text-sm">Número de Participantes:</Label>
                <Input 
                  type="number"
                  id="participant-count"
                  className="bg-secondary/80 border-white/20 text-white"
                  value={participantCount}
                  onChange={(e) => setParticipantCount(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 bg-secondary/60 border border-white/10">
          <CardContent className="p-4">
            <h2 className="text-lg font-medium mb-2">Aparência</h2>
            
            <div className="mb-4">
              <Label htmlFor="font-select" className="text-sm">Fonte:</Label>
              <Select onValueChange={handleFontChange}>
                <SelectTrigger className="bg-secondary/80 border-white/20 text-white w-full">
                  <SelectValue placeholder="Selecione a fonte" />
                </SelectTrigger>
                <SelectContent className="bg-secondary/80 border-white/20 text-white">
                  {FONTS.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font.split(',')[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="background-image" className="text-sm">Imagem de Fundo:</Label>
              <Input
                type="file"
                id="background-image"
                className="bg-secondary/80 border-white/20 text-white"
                onChange={handleBackgroundImageChange}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 bg-secondary/60 border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Participantes</h2>
              <Button 
                variant={isSessionActiveState ? "destructive" : "default"}
                size="sm"
                onClick={isSessionActiveState ? handleEndSession : openTransmissionWindow}
                disabled={!isSessionActiveState && transmissionOpen}
              >
                {isSessionActiveState ? 'Encerrar Sessão' : 'Abrir Transmissão'}
              </Button>
            </div>
            
            <ParticipantGrid 
              participants={participantList}
              onSelectParticipant={handleSelectParticipant}
              onRemoveParticipant={handleRemoveParticipant}
            />
          </CardContent>
        </Card>
        
        {qrCode && (
          <Card className="bg-secondary/60 border border-white/10">
            <CardContent className="p-4">
              <h2 className="text-lg font-medium mb-2">QR Code</h2>
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="text-sm text-white/60 text-center mt-2">{qrCodeDescription}</p>
              <p className="text-sm text-white/60 text-center mt-2">
                Link direto: <a href={`${window.location.origin}/telao/${sessionId}`} target="_blank" rel="noopener noreferrer" className="underline">
                  {`${window.location.origin}/telao/${sessionId}`}
                </a>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LivePage;
