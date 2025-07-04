import { useRef, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

export const useTransmissionWindow = () => {
  const { toast } = useToast();
  const transmissionWindowRef = useRef<Window | null>(null);

  const createTransmissionHTML = (state: any) => {
    return `
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
  };

  const openTransmissionWindow = (state: any, updateTransmissionParticipants: () => void) => {
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
      
      const html = createTransmissionHTML(state);
      
      newWindow.document.write(html);
      newWindow.document.close();
      state.setTransmissionOpen(true);
      
      const channel = new BroadcastChannel(`live-session-${state.sessionId}`);
      const backupChannel = new BroadcastChannel(`telao-session-${state.sessionId}`);
      
      const updateQRPositions = (data: any) => {
        if (!newWindow.document) return;
        
        const qrCodeElement = newWindow.document.querySelector('.qr-code');
        const qrDescriptionElement = newWindow.document.querySelector('.qr-description');
        
        if (qrCodeElement) {
          qrCodeElement.style.left = data.qrCodePosition.x + 'px';
          qrCodeElement.style.top = data.qrCodePosition.y + 'px';
          qrCodeElement.style.width = data.qrCodePosition.width + 'px';
          qrCodeElement.style.height = data.qrCodePosition.height + 'px';
          qrCodeElement.style.display = data.qrCodeVisible ? 'flex' : 'none';
          
          if (data.qrCodeSvg) {
            const imgElement = qrCodeElement.querySelector('img') || newWindow.document.createElement('img');
            imgElement.src = data.qrCodeSvg;
            imgElement.alt = "QR Code";
            if (!imgElement.parentNode) {
              qrCodeElement.appendChild(imgElement);
            }
          }
        }
        
        if (qrDescriptionElement) {
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
      };
      
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
        
        channel.close();
        backupChannel.close();
      });
      
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.data.type === 'update-qr-positions') {
          updateQRPositions(event.data);
        }
      });
      
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

  const finishTransmission = (state: any, handleFinalAction: () => void) => {
    if (transmissionWindowRef.current && !transmissionWindowRef.current.closed) {
      transmissionWindowRef.current.close();
      transmissionWindowRef.current = null;
      state.setTransmissionOpen(false);
    }
    
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

  return {
    transmissionWindowRef,
    openTransmissionWindow,
    finishTransmission
  };
};
