import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import QRCode from 'qrcode';
import LivePreview from '@/components/live/LivePreview';
import LivePageHeader from '@/components/live/LivePageHeader';
import TransmissionControls from '@/components/live/TransmissionControls';
import LiveControlTabs from '@/components/live/LiveControlTabs';
import FinalActionDialog from '@/components/live/FinalActionDialog';
import { generateSessionId } from '@/utils/sessionUtils';
import { initializeHostSession, cleanupSession } from '@/utils/liveStreamUtils';
import { initHostWebRTC } from '@/utils/webrtc';
import { useLivePageState } from '@/hooks/live/useLivePageState';
import { useParticipantManagement } from '@/hooks/live/useParticipantManagement';

const LivePage: React.FC = () => {
  const { toast } = useToast();
  const state = useLivePageState();
  
  const transmissionWindowRef = useRef<Window | null>(null);
  const [apiBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');

  useEffect(() => {
    if (state.qrCodeURL) {
      generateQRCode(state.qrCodeURL);
    }
  }, [state.qrCodeURL]);

  useEffect(() => {
    if (state.finalActionOpen && state.finalActionTimeLeft > 0) {
      const timerId = window.setInterval(() => {
        state.setFinalActionTimeLeft((prev) => prev - 1);
      }, 1000);
      
      state.setFinalActionTimerId(timerId as unknown as number);
      
      return () => {
        if (timerId) clearInterval(timerId);
      };
    } else if (state.finalActionTimeLeft <= 0) {
      closeFinalAction();
    }
  }, [state.finalActionOpen, state.finalActionTimeLeft]);

  useEffect(() => {
    return () => {
      if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
        transmissionWindowRef.current.close();
      }
      if (state.sessionId) {
        cleanupSession(state.sessionId);
      }
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.sessionId, state.localStream]);

  useEffect(() => {
    if (state.sessionId) {
      window.sessionStorage.setItem('currentSessionId', state.sessionId);
      
      const cleanup = initializeHostSession(state.sessionId, {
        onParticipantJoin: participantManagement.handleParticipantJoin,
        onParticipantLeave: (id) => {
          console.log(`Participant left: ${id}`);
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: false } : p)
          );
        },
        onParticipantHeartbeat: (id) => {
          state.setParticipantList(prev => 
            prev.map(p => p.id === id ? { ...p, active: true } : p)
          );
        }
      });

      initHostWebRTC(state.sessionId);

      return () => {
        cleanup();
        if (state.localStream) {
          state.localStream.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [state.sessionId]);

  const updateTransmissionParticipants = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      const participantsWithStreams = state.participantList.map(p => ({
        ...p,
        hasStream: p.active
      }));
      
      transmissionWindowRef.current.postMessage({
        type: 'update-participants',
        participants: participantsWithStreams
      }, '*');
    }
  };

  const participantManagement = useParticipantManagement({
    participantList: state.participantList,
    setParticipantList: state.setParticipantList,
    participantStreams: state.participantStreams,
    setParticipantStreams: state.setParticipantStreams,
    sessionId: state.sessionId,
    transmissionWindowRef,
    updateTransmissionParticipants
  });

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
      
      state.setQrCodeSvg(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Erro ao gerar QR Code",
        description: "Não foi possível gerar o QR Code.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateQRCode = async () => {
    try {
      console.log("Generating QR Code via backend API...");
      console.log("API Base URL:", apiBaseUrl);
      
      const response = await fetch(`${apiBaseUrl}/api/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Response Error:", response.status, response.statusText, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("QR Code data received:", data);
      
      state.setSessionId(data.roomId);
      state.setQrCodeURL(data.joinURL);
      state.setQrCodeSvg(data.qrDataUrl);
      state.setParticipantList([]);
      
      toast({
        title: "QR Code gerado",
        description: "QR Code gerado com sucesso via backend. Compartilhe com os participantes.",
      });
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      
      try {
        console.log("Backend failed, generating QR Code locally as fallback...");
        const fallbackSessionId = generateSessionId();
        const fallbackUrl = `${window.location.origin}/participant/${fallbackSessionId}`;
        
        const qrDataUrl = await QRCode.toDataURL(fallbackUrl, {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        state.setSessionId(fallbackSessionId);
        state.setQrCodeURL(fallbackUrl);
        state.setQrCodeSvg(qrDataUrl);
        state.setParticipantList([]);
        
        toast({
          title: "QR Code gerado localmente",
          description: "Gerado localmente devido a problema de conectividade com o servidor.",
          variant: "default"
        });
        
      } catch (fallbackError) {
        console.error('Fallback QR generation also failed:', fallbackError);
        toast({
          title: "Erro ao gerar QR Code",
          description: `Não foi possível gerar o QR Code: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  };

  const handleQRCodeToTransmission = () => {
    state.setQrCodeVisible(true);
    toast({
      title: "QR Code incluído",
      description: "O QR Code foi incluído na tela de transmissão e pode ser redimensionado."
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        state.setBackgroundImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackgroundImage = () => {
    state.setBackgroundImage(null);
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
                font-family: ${state.selectedFont};
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
                background-color: ${state.backgroundImage ? 'transparent' : state.selectedBackgroundColor};
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
                grid-template-columns: repeat(${Math.ceil(Math.sqrt(state.participantCount))}, 1fr);
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
                left: ${state.qrCodePosition.x}px;
                top: ${state.qrCodePosition.y}px;
                width: ${state.qrCodePosition.width}px;
                height: ${state.qrCodePosition.height}px;
                background-color: white;
                padding: 4px;
                border-radius: 8px;
                display: ${state.qrCodeVisible ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
              }
              .qr-code img {
                width: 100%;
                height: 100%;
              }
              .qr-description {
                position: absolute;
                left: ${state.qrDescriptionPosition.x}px;
                top: ${state.qrDescriptionPosition.y}px;
                width: ${state.qrDescriptionPosition.width}px;
                height: ${state.qrDescriptionPosition.height}px;
                color: ${state.selectedTextColor};
                padding: 4px 8px;
                box-sizing: border-box;
                border-radius: 4px;
                font-size: ${state.qrDescriptionFontSize}px;
                text-align: center;
                font-weight: bold;
                font-family: ${state.selectedFont};
                display: ${state.qrCodeVisible ? 'flex' : 'none'};
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
                ${state.backgroundImage ? `<img src="${state.backgroundImage}" class="bg-image" alt="Background" />` : ''}
              
              <div class="participants-grid" id="participants-container">
                ${Array.from({ length: Math.min(state.participantCount, 100) }, (_, i) => `
                  <div class="participant" id="participant-slot-${i}">
                    <svg class="participant-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                `).join('')}
              </div>
              
                <div class="qr-code">
                  ${state.qrCodeSvg ? `<img src="${state.qrCodeSvg}" alt="QR Code" />` : ''}
                </div>
                <div class="qr-description">${state.qrCodeDescription}</div>
                
                <div class="live-indicator">
                  <div class="live-dot"></div>
                  AO VIVO
                </div>
              </div>
            </div>
            
            <script>
              window.transmissionWindow = true;
              window.isKeepAliveActive = true;
              
              const sessionId = "${state.sessionId}";
              console.log("Live transmission window opened for session:", sessionId);
              
              const channel = new BroadcastChannel("live-session-" + sessionId);
              const backupChannel = new BroadcastChannel("telao-session-" + sessionId);
              
              let participantSlots = {};
              let availableSlots = Array.from({ length: Math.min(${state.participantCount}, 100) }, (_, i) => i);
              let participantStreams = {};
              let activeVideoElements = {};
              
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

              function createPlaceholderStream() {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 - 50, 60, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 + 90, 100, 0, Math.PI, true);
                ctx.fill();
                
                try {
                  const stream = canvas.captureStream(30);
                  console.log("Created placeholder stream with", stream.getTracks().length, "tracks");
                  return stream;
                } catch (error) {
                  console.error("Failed to create placeholder stream:", error);
                  return null;
                }
              }
              
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
                  
                  const selectedParticipants = participants.filter(p => p.selected);
                  
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
                        
                        channel.postMessage({
                          type: 'request-video-stream',
                          participantId: p.id
                        });
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
                else if (event.data.type === 'update-qr-positions') {
                  updateQRPositions(event.data);
                }
                else if (event.data.type === 'keep-alive') {
                  console.log("Keep-alive received");
                }
                else if (event.data.type === 'participant-joined') {
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
              
              window.opener.postMessage({ type: 'transmission-ready', sessionId }, '*');
              
              setInterval(() => {
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({ type: 'transmission-heartbeat', sessionId }, '*');
                }
              }, 2000);
              
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
      state.setTransmissionOpen(true);
      
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
        state.setTransmissionOpen(false);
        transmissionWindowRef.current = null;
      });
      
      window.addEventListener('message', handleTransmissionMessage);
      
      setTimeout(() => {
        if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
          transmissionWindowRef.current.postMessage({
            type: 'update-qr-positions',
            qrCodePosition: state.qrCodePosition,
            qrDescriptionPosition: state.qrDescriptionPosition,
            qrCodeVisible: state.qrCodeVisible,
            qrCodeSvg: state.qrCodeSvg,
            qrCodeDescription: state.qrCodeDescription,
            selectedFont: state.selectedFont,
            selectedTextColor: state.selectedTextColor,
            qrDescriptionFontSize: state.qrDescriptionFontSize
          }, '*');
          
          updateTransmissionParticipants();
        }
      }, 500);
    }
  };

  const finishTransmission = () => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      state.setTransmissionOpen(false);
    }
    
    window.removeEventListener('message', handleTransmissionMessage);
    
    if (state.finalAction !== 'none') {
      state.setFinalActionTimeLeft(20);
      state.setFinalActionOpen(true);
    } else {
      toast({
        title: "Transmissão finalizada",
        description: "A transmissão foi encerrada com sucesso."
      });
    }
  };

  const closeFinalAction = () => {
    if (state.finalActionTimerId) {
      clearInterval(state.finalActionTimerId);
      state.setFinalActionTimerId(null);
    }
    state.setFinalActionOpen(false);
    state.setFinalActionTimeLeft(20);
    
    toast({
      title: "Transmissão finalizada",
      description: "A transmissão foi encerrada com sucesso."
    });
  };

  const handleTransmissionMessage = (event: MessageEvent) => {
    if (event.data.type === 'transmission-ready' && event.data.sessionId === state.sessionId) {
      updateTransmissionParticipants();
      
      Object.entries(state.participantStreams).forEach(([participantId, stream]) => {
        const participant = state.participantList.find(p => p.id === participantId);
        if (participant && participant.selected) {
          const channel = new BroadcastChannel(`live-session-${state.sessionId}`);
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
    else if (event.data.type === 'participant-joined' && event.data.sessionId === state.sessionId) {
      participantManagement.handleParticipantJoin(event.data.id);
    }
  };

  useEffect(() => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.postMessage({
        type: 'update-qr-positions',
        qrCodePosition: state.qrCodePosition,
        qrDescriptionPosition: state.qrDescriptionPosition,
        qrCodeVisible: state.qrCodeVisible,
        qrCodeSvg: state.qrCodeSvg,
        qrCodeDescription: state.qrCodeDescription,
        selectedFont: state.selectedFont,
        selectedTextColor: state.selectedTextColor,
        qrDescriptionFontSize: state.qrDescriptionFontSize
      }, '*');
    }
  }, [
    state.qrCodePosition, 
    state.qrDescriptionPosition, 
    state.qrCodeVisible, 
    state.qrCodeSvg, 
    state.qrCodeDescription,
    state.selectedFont,
    state.selectedTextColor,
    state.qrDescriptionFontSize
  ]);

  return (
    <div className="min-h-screen container mx-auto py-8 px-4 relative">
      <LivePageHeader />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Card className="bg-secondary/40 backdrop-blur-lg border border-white/10 min-h-[700px]">
            <CardHeader className="flex flex-row justify-between items-center">
              <div className="flex items-center gap-4 w-full">
                <CardTitle className="flex items-center gap-2">
                  Controle de Transmissão
                </CardTitle>
                <TransmissionControls
                  transmissionOpen={state.transmissionOpen}
                  sessionId={state.sessionId}
                  onStartTransmission={openTransmissionWindow}
                  onFinishTransmission={finishTransmission}
                />
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Gerencie participantes, layout e aparência da sua transmissão ao vivo
              </CardDescription>
              
              <LiveControlTabs
                participantList={state.participantList}
                onSelectParticipant={participantManagement.handleParticipantSelect}
                onRemoveParticipant={participantManagement.handleParticipantRemove}
                participantStreams={state.participantStreams}
                sessionId={state.sessionId || ''}
                participantCount={state.participantCount}
                setParticipantCount={state.setParticipantCount}
                qrCodeDescription={state.qrCodeDescription}
                setQrCodeDescription={state.setQrCodeDescription}
                selectedFont={state.selectedFont}
                setSelectedFont={state.setSelectedFont}
                selectedTextColor={state.selectedTextColor}
                setSelectedTextColor={state.setSelectedTextColor}
                qrDescriptionFontSize={state.qrDescriptionFontSize}
                setQrDescriptionFontSize={state.setQrDescriptionFontSize}
                selectedBackgroundColor={state.selectedBackgroundColor}
                setSelectedBackgroundColor={state.setSelectedBackgroundColor}
                backgroundImage={state.backgroundImage}
                onFileSelect={handleFileSelect}
                onRemoveImage={removeBackgroundImage}
                fileInputRef={state.fileInputRef}
                qrCodeGenerated={!!state.sessionId}
                qrCodeVisible={state.qrCodeVisible}
                qrCodeURL={state.qrCodeURL}
                finalAction={state.finalAction}
                setFinalAction={state.setFinalAction}
                finalActionImage={state.finalActionImage}
                setFinalActionImage={state.setFinalActionImage}
                finalActionLink={state.finalActionLink}
                setFinalActionLink={state.setFinalActionLink}
                finalActionCoupon={state.finalActionCoupon}
                setFinalActionCoupon={state.setFinalActionCouponCode}
                onGenerateQRCode={handleGenerateQRCode}
                onQRCodeToTransmission={handleQRCodeToTransmission}
              />
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
                  qrCodeVisible={state.qrCodeVisible}
                  qrCodeSvg={state.qrCodeSvg}
                  qrCodePosition={state.qrCodePosition}
                  setQrCodePosition={state.setQrCodePosition}
                  qrDescriptionPosition={state.qrDescriptionPosition}
                  setQrDescriptionPosition={state.setQrDescriptionPosition}
                  qrCodeDescription={state.qrCodeDescription}
                  selectedFont={state.selectedFont}
                  selectedTextColor={state.selectedTextColor}
                  qrDescriptionFontSize={state.qrDescriptionFontSize}
                  backgroundImage={state.backgroundImage}
                  selectedBackgroundColor={state.selectedBackgroundColor}
                  participantList={state.participantList}
                  participantCount={state.participantCount}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <FinalActionDialog
        finalActionOpen={state.finalActionOpen}
        setFinalActionOpen={state.setFinalActionOpen}
        finalActionTimeLeft={state.finalActionTimeLeft}
        onCloseFinalAction={closeFinalAction}
      />
    </div>
  );
};

export default LivePage;
