import { useRef, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useTransmissionWindowDebounce } from './useTransmissionWindowDebounce';

export const useTransmissionWindow = () => {
  const { toast } = useToast();
  const transmissionWindowRef = useRef<Window | null>(null);

  // Mantemos disponível caso você queira deboucear futuros updates
  const { debouncedUpdate, cancelUpdate } = useTransmissionWindowDebounce({ delay: 2000 });

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
            let activeVideoElements = {};

            function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
            
            function keepAlive() {
              if (window.isKeepAliveActive) {
                setTimeout(keepAlive, 1000);
              }
            }
            keepAlive();

            // ====== NOVO: Anexa stream do HOST (opener) com retry ======
            async function attachOpenerStreamToSlot(slotElement, participantId) {
              if (!slotElement) {
                console.error("❌ TRANSMISSION: Slot element inválido");
                return false;
              }

              let stream = null;
              let attempts = 0;
              const maxAttempts = 30; // ~9s (30 * 300ms)

              while (attempts < maxAttempts) {
                try {
                  stream = window.opener?.getParticipantStream?.(participantId);
                  if (stream && stream.getTracks && stream.getTracks().length) break;
                } catch (e) {
                  console.warn("⚠️ TRANSMISSION: opener.getParticipantStream erro:", e);
                }
                await sleep(300);
                attempts++;
              }

              slotElement.innerHTML = '';
              const video = document.createElement('video');
              video.autoplay = true;
              video.playsInline = true;
              video.muted = true;
              video.setAttribute('playsinline', '');
              video.setAttribute('muted', '');
              video.style.width = '100%';
              video.style.height = '100%';
              video.style.objectFit = 'cover';
              video.style.transform = 'translateZ(0)';
              video.style.backfaceVisibility = 'hidden';
              video.style.webkitBackfaceVisibility = 'hidden';
              video.style.willChange = 'transform';
              video.style.transition = 'none';

              if (stream) {
                video.srcObject = stream;
                console.log("✅ TRANSMISSION: Stream do host anexado para", participantId);
                try { await video.play(); } catch (err) {
                  console.warn("⚠️ TRANSMISSION: Falha ao dar play:", err);
                  setTimeout(() => video.play().catch(()=>{}), 500);
                }
              } else {
                console.warn("⚠️ TRANSMISSION: Stream não encontrado para", participantId, "– usando placeholder");
                await createPlaceholderVideo(slotElement, video);
              }

              slotElement.appendChild(video);
              activeVideoElements[slotElement.id] = video;

              setTimeout(() => {
                slotElement.style.background = 'transparent';
                video.style.opacity = '1';
                video.style.visibility = 'visible';
              }, 100);

              return true;
            }

            async function createPlaceholderVideo(slotElement, videoEl) {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 480;
              const ctx = canvas.getContext('2d');

              const draw = () => {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#444';
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2 - 50, 60, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2 + 90, 100, 0, Math.PI, true);
                ctx.fill();
                ctx.fillStyle = '#666';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Aguardando stream...', canvas.width/2, canvas.height - 40);
                requestAnimationFrame(draw);
              };
              draw();

              try {
                const stream = canvas.captureStream(30);
                videoEl.srcObject = stream;
                try { await videoEl.play(); } catch {}
              } catch (e) {
                console.error("❌ TRANSMISSION: Falha ao criar placeholder:", e);
              }
            }

            // ====== Handlers (BroadcastChannel) ======
            channel.addEventListener('message', async (event) => {
              const data = event.data;
              console.log("📨 TRANSMISSION: Received message:", data?.type, data);
              
              if (data?.type === 'video-stream' && data.participantId && data.hasStream) {
                if (!participantSlots[data.participantId] && availableSlots.length > 0) {
                  const slotIndex = availableSlots.shift();
                  participantSlots[data.participantId] = slotIndex;
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement) {
                    console.log("📹 TRANSMISSION: Attach via opener no slot", slotIndex, "->", data.participantId);
                    await attachOpenerStreamToSlot(slotElement, data.participantId);
                    slotElement.dataset.participantId = data.participantId;
                  }
                } else if (participantSlots[data.participantId]) {
                  const slotIndex = participantSlots[data.participantId];
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement && !slotElement.querySelector('video')) {
                    await attachOpenerStreamToSlot(slotElement, data.participantId);
                  }
                }
              }
            });

            // ====== Handlers (postMessage do host) ======
            window.addEventListener('message', async (event) => {
              const data = event.data;
              console.log("📩 TRANSMISSION: Received window message:", data?.type);
              
              if (data?.type === 'participant-stream-ready' && data.participantId) {
                if (!participantSlots[data.participantId] && availableSlots.length > 0) {
                  const slotIndex = availableSlots.shift();
                  participantSlots[data.participantId] = slotIndex;
                  const slotElement = document.getElementById("participant-slot-" + slotIndex);
                  if (slotElement) {
                    await attachOpenerStreamToSlot(slotElement, data.participantId);
                    slotElement.dataset.participantId = data.participantId;
                  }
                }
              }
              else if (data?.type === 'update-participants') {
                const { participants = [] } = data;
                const selectedParticipants = participants.filter(p => p.selected && p.hasVideo);

                for (const participant of selectedParticipants) {
                  if (!participantSlots[participant.id] && availableSlots.length > 0) {
                    const slotIndex = availableSlots.shift();
                    participantSlots[participant.id] = slotIndex;
                    const slotElement = document.getElementById("participant-slot-" + slotIndex);
                    if (slotElement) {
                      await attachOpenerStreamToSlot(slotElement, participant.id);
                      slotElement.dataset.participantId = participant.id;
                    }
                  }
                }

                // Remove quem não está mais selecionado
                Object.keys(participantSlots).forEach(participantId => {
                  const isStillSelected = participants.some(p => p.id === participantId && p.selected);
                  if (!isStillSelected) {
                    const slotIndex = participantSlots[participantId];
                    delete participantSlots[participantId];
                    availableSlots.push(slotIndex);
                    const slotElement = document.getElementById("participant-slot-" + slotIndex);
                    if (slotElement) {
                      const videoElement = activeVideoElements[slotElement.id];
                      if (videoElement?.srcObject) {
                        try {
                          const tracks = videoElement.srcObject.getTracks?.() || [];
                          tracks.forEach(t => t.stop());
                        } catch {}
                        videoElement.srcObject = null;
                      }
                      delete activeVideoElements[slotElement.id];
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
              else if (data?.type === 'update-qr-positions') {
                updateQRPositions(data);
              }
              else if (data?.type === 'keep-alive') {
                // noop
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
              
            // Heartbeat e cleanup
            setInterval(() => {
              if (window.opener && !window.opener.closed) {
                const activeSlots = Object.keys(participantSlots);
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
            
            // Sinaliza pronto para o host
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
                if (videoElement && videoElement.srcObject) {
                  try {
                    const tracks = videoElement.srcObject.getTracks?.() || [];
                    tracks.forEach(track => track.stop());
                  } catch {}
                  videoElement.srcObject = null;
                }
              });
                
              if (window.localPlaceholderStream) {
                try {
                  const tracks = window.localPlaceholderStream.getTracks?.() || [];
                  tracks.forEach(track => track.stop());
                } catch {}
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

    console.log('🎬 FASE 1: Opening simplified transmission window...');

    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.9;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    // FASE 1: Usar rota React ao invés de arquivo HTML estático
    const sessionId = state.sessionId || 'default';
    const newWindow = window.open(
      `/transmission?sessionId=${sessionId}`,
      'LiveTransmissionWindow',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (newWindow) {
      transmissionWindowRef.current = newWindow;
      state.setTransmissionOpen(true);

      console.log('✅ FASE 1: Transmission window opened successfully');

      // Aguardar o carregamento da nova janela antes de expor funções e configurações
      setTimeout(() => {
        if (newWindow && !newWindow.closed) {
          // Expor função global para a janela de transmissão acessar streams
          newWindow.getParticipantStream = (participantId: string) => {
            console.log('🎬 Host: getParticipantStream solicitado para:', participantId);
            return state.participantStreams?.[participantId] || null;
          };
          
          // Enviar configurações iniciais para replicar interface LivePreview
          newWindow.postMessage({
            type: 'update-participants',
            participants: state.participantList || []
          }, '*');
          
          newWindow.postMessage({
            type: 'update-qr-positions',
            qrCodeVisible: state.qrCodeVisible,
            qrCodeSvg: state.qrCodeSvg,
            qrCodePosition: state.qrCodePosition,
            qrDescriptionPosition: state.qrDescriptionPosition,
            qrCodeDescription: state.qrCodeDescription,
            selectedFont: state.selectedFont,
            selectedTextColor: state.selectedTextColor,
            qrDescriptionFontSize: state.qrDescriptionFontSize
          }, '*');
          
          console.log('✅ FASE 1: Functions and initial configurations sent to transmission window');
        }
      }, 1500);

      // Handler de mensagens vindas da popup
      const handleTransmissionMessage = (event: MessageEvent) => {
        if (event.source === newWindow) {
          const type = (event.data && event.data.type) || 'unknown';
          if (type === 'transmission-ready') {
            setTimeout(() => {
              updateTransmissionParticipants();
            }, 500);
          } else if (type === 'transmission-heartbeat') {
            // opcional: logs/metrics
          }
        }
      };

      window.addEventListener('message', handleTransmissionMessage);

      // Cleanup ao fechar a popup
      const beforeUnloadHandler = () => {
        state.setTransmissionOpen(false);
        transmissionWindowRef.current = null;
        window.removeEventListener('message', handleTransmissionMessage);
        newWindow.removeEventListener('beforeunload', beforeUnloadHandler);
      };
      newWindow.addEventListener('beforeunload', beforeUnloadHandler);
    } else {
      console.error('❌ TRANSMISSION: Falha ao abrir janela de transmissão');
      toast({
        title: "Erro na Transmissão",
        description: "Não foi possível abrir a janela de transmissão. Verifique se pop-ups estão habilitados.",
        variant: "destructive"
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
