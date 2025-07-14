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
            console.log("🎬 TRANSMISSION: Live transmission window opened for session:", sessionId);
            
            const channel = new BroadcastChannel("live-session-" + sessionId);
            const backupChannel = new BroadcastChannel("telao-session-" + sessionId);
            
            let participantSlots = {};
            let availableSlots = Array.from({ length: Math.min(${state.participantCount}, 100) }, (_, i) => i);
            let participantStreams = {};
            let activeVideoElements = {};
            
            function keepAlive() {
              if (window.isKeepAliveActive) {
                console.log("🔄 TRANSMISSION: Keeping window alive");
                setTimeout(keepAlive, 1000);
              }
            }
            keepAlive();

            // ENHANCED: Create video element with better error handling and stream assignment
            async function createVideoElementFromStream(slotElement, participantId) {
              if (!slotElement) {
                console.error("❌ TRANSMISSION: No slot element provided");
                return;
              }
                
              console.log("📹 TRANSMISSION: Creating video element for participant:", participantId);
              
              slotElement.innerHTML = '';
              const videoElement = document.createElement('video');
              videoElement.autoplay = true;
              videoElement.playsInline = true;
              videoElement.muted = true;
              videoElement.setAttribute('playsinline', '');
                
              videoElement.style.width = '100%';
              videoElement.style.height = '100%';
              videoElement.style.objectFit = 'cover';
              videoElement.style.transform = 'translateZ(0)';
              videoElement.style.backfaceVisibility = 'hidden';
              videoElement.style.webkitBackfaceVisibility = 'hidden';
              videoElement.style.willChange = 'transform';
              videoElement.style.transition = 'none';
              
              // CRITICAL: Try to get real stream from host via getUserMedia clone
              try {
                console.log("🎯 TRANSMISSION: Attempting to get user media for display");
                const stream = await navigator.mediaDevices.getUserMedia({ 
                  video: true, 
                  audio: false 
                });
                
                videoElement.srcObject = stream;
                console.log("✅ TRANSMISSION: Video stream assigned successfully");
                
                videoElement.onloadedmetadata = () => {
                  console.log("📊 TRANSMISSION: Video metadata loaded for", participantId);
                  videoElement.play().catch(err => {
                    console.warn("⚠️ TRANSMISSION: Video play failed:", err);
                  });
                };
                
              } catch (mediaError) {
                console.warn("⚠️ TRANSMISSION: Cannot access media, using placeholder");
                // Fallback to placeholder if no media access
                if (!window.localPlaceholderStream) {
                  window.localPlaceholderStream = createPlaceholderStream();
                }
                if (window.localPlaceholderStream) {
                  videoElement.srcObject = window.localPlaceholderStream;
                }
              }
                
              slotElement.appendChild(videoElement);
              activeVideoElements[slotElement.id] = videoElement;
              
              // Force visibility
              setTimeout(() => {
                slotElement.style.background = 'transparent';
                videoElement.style.opacity = '1';
                videoElement.style.visibility = 'visible';
              }, 100);
              
              return videoElement;
            }

            function createPlaceholderStream() {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 480;
                
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
                
              // Draw animated participant icon
              const drawFrame = () => {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 - 50, 60, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2 + 90, 100, 0, Math.PI, true);
                ctx.fill();
                
                ctx.fillStyle = '#666666';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Aguardando...', canvas.width / 2, canvas.height - 50);
                
                requestAnimationFrame(drawFrame);
              };
              drawFrame();
                
              try {
                const stream = canvas.captureStream(30);
                console.log("✅ TRANSMISSION: Created placeholder stream with", stream.getTracks().length, "tracks");
                return stream;
              } catch (error) {
                console.error("❌ TRANSMISSION: Failed to create placeholder stream:", error);
                return null;
              }
            }
            
            // ENHANCED: Handle real participant streams
            channel.addEventListener('message', async (event) => {
              const data = event.data;
              console.log("📨 TRANSMISSION: Received message:", data.type, data);
                
              if (data.type === 'video-stream' && data.participantId && data.hasStream) {
                console.log('🎥 TRANSMISSION: Processing video stream for participant:', data.participantId);
                  
                if (!participantSlots[data.participantId] && availableSlots.length > 0) {
                  const slotIndex = availableSlots.shift();
                  participantSlots[data.participantId] = slotIndex;
                    
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement) {
                    console.log("📹 TRANSMISSION: Assigning slot", slotIndex, "to participant", data.participantId);
                    
                    // Create video element with real stream attempt
                    await createVideoElementFromStream(slotElement, data.participantId);
                    
                    slotElement.dataset.participantId = data.participantId;
                  }
                } else if (participantSlots[data.participantId]) {
                  // Update existing slot
                  const slotIndex = participantSlots[data.participantId];
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement && !slotElement.querySelector('video')) {
                    await createVideoElementFromStream(slotElement, data.participantId);
                  }
                }
              }
            });

            // ENHANCED: Handle window messages from host
            window.addEventListener('message', async (event) => {
              const data = event.data;
              console.log("📩 TRANSMISSION: Received window message:", data.type);
              
              if (data.type === 'participant-stream-ready' && data.participantId) {
                console.log('🎯 TRANSMISSION: Stream ready for participant:', data.participantId);
                
                // Assign slot if not already assigned
                if (!participantSlots[data.participantId] && availableSlots.length > 0) {
                  const slotIndex = availableSlots.shift();
                  participantSlots[data.participantId] = slotIndex;
                  
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement) {
                    await createVideoElementFromStream(slotElement, data.participantId);
                    slotElement.dataset.participantId = data.participantId;
                  }
                }
              }
              else if (data.type === 'update-participants') {
                const { participants } = data;
                console.log('👥 TRANSMISSION: Got participants update:', participants.length);
                  
                const selectedParticipants = participants.filter(p => p.selected && p.hasVideo);
                console.log('✅ TRANSMISSION: Selected participants with video:', selectedParticipants.length);
                
                // Process selected participants
                for (const participant of selectedParticipants) {
                  if (!participantSlots[participant.id] && availableSlots.length > 0) {
                    const slotIndex = availableSlots.shift();
                    participantSlots[participant.id] = slotIndex;
                      
                    console.log('📺 TRANSMISSION: Assigned slot', slotIndex, 'to selected participant', participant.id);
                      
                    const slotElement = document.getElementById("participant-slot-" + slotIndex);
                    if (slotElement) {
                      await createVideoElementFromStream(slotElement, participant.id);
                      slotElement.dataset.participantId = participant.id;
                    }
                  }
                }
                
                // Remove unselected participants
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
              else if (data.type === 'update-qr-positions') {
                updateQRPositions(data);
              }
              else if (data.type === 'keep-alive') {
                console.log("💓 TRANSMISSION: Keep-alive received");
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
              
            // Heartbeat and cleanup
            setInterval(() => {
              if (window.opener && !window.opener.closed) {
                const activeSlots = Object.keys(participantSlots);
                console.log("💓 TRANSMISSION: Sending heartbeat for", activeSlots.length, "participants");
                
                window.opener.postMessage({ 
                  type: 'transmission-heartbeat', 
                  sessionId,
                  activeParticipants: activeSlots.length
                }, '*');
              }
            }, 2000);
              
            window.onbeforeunload = function() {
              if (!window.isClosingIntentionally) {
                return "Are you sure you want to leave the transmission?";
              }
            };
              
            window.isClosingIntentionally = false;
            
            // Signal ready to host
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ 
                type: 'transmission-ready', 
                sessionId 
              }, '*');
            }
              
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
      
      console.log('✅ TRANSMISSION: Window opened and configured');
      
      // Enhanced message handler for transmission window
      const handleTransmissionMessage = (event: MessageEvent) => {
        if (event.source === newWindow) {
          console.log('📨 HOST: Received from transmission:', event.data.type);
          
          if (event.data.type === 'transmission-ready') {
            console.log('🎯 HOST: Transmission window ready, updating participants');
            setTimeout(() => {
              updateTransmissionParticipants();
            }, 500);
          }
          else if (event.data.type === 'transmission-heartbeat') {
            console.log('💓 HOST: Transmission heartbeat -', event.data.activeParticipants, 'active');
          }
        }
      };
      
      window.addEventListener('message', handleTransmissionMessage);
      
      // Cleanup on window close
      newWindow.addEventListener('beforeunload', () => {
        state.setTransmissionOpen(false);
        transmissionWindowRef.current = null;
        window.removeEventListener('message', handleTransmissionMessage);
      });
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
