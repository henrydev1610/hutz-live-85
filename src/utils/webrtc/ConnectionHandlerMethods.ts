// FASE 2-4: Métodos auxiliares para ConnectionHandler
export function setupOnTrackWithTimeout(
  peerConnection: RTCPeerConnection, 
  participantId: string,
  streamCallback: ((participantId: string, stream: MediaStream) => void) | null,
  onTrackTimeoutMs: number = 10000
) {
  let onTrackReceived = false;
  
  // FASE 4: Timeout para ontrack
  const onTrackTimeout = setTimeout(() => {
    if (!onTrackReceived) {
      console.log(`⏰ ONTRACK TIMEOUT: Forcing connection restart for ${participantId}`);
      
      // Forçar restart da peer connection
      window.dispatchEvent(new CustomEvent('force-connection-restart', {
        detail: { participantId, reason: 'ontrack-timeout' }
      }));
    }
  }, onTrackTimeoutMs);

  peerConnection.ontrack = (event) => {
    onTrackReceived = true;
    clearTimeout(onTrackTimeout);
    
    console.log(`📺 WEBRTC DIAGNÓSTICO: ===== ONTRACK DISPARADO =====`);
    console.log(`📺 WEBRTC DIAGNÓSTICO: Participante: ${participantId}`);
    console.log(`📺 WEBRTC DIAGNÓSTICO: Timestamp: ${new Date().toISOString()}`);
    console.log(`📺 WEBRTC DIAGNÓSTICO: Event:`, {
      streams: event.streams?.length || 0,
      track: {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState
      },
      receiver: {
        track: event.receiver?.track?.id,
        transport: event.receiver?.transport?.state
      },
      transceiver: {
        direction: event.transceiver?.direction,
        currentDirection: event.transceiver?.currentDirection
      }
    });
    
    if (event.streams && event.streams.length > 0) {
      const remoteStream = event.streams[0];
      console.log(`📺 WEBRTC DIAGNÓSTICO: Stream remoto recebido:`, {
        id: remoteStream.id,
        active: remoteStream.active,
        tracks: remoteStream.getTracks().map(track => ({
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        }))
      });
      
      console.log(`📺 WEBRTC DIAGNÓSTICO: Stream callback disponível: ${!!streamCallback}`);
      console.log(`📺 WEBRTC DIAGNÓSTICO: Tentando chamar callback...`);
      
      if (streamCallback) {
        try {
          streamCallback(participantId, remoteStream);
          console.log(`✅ WEBRTC DIAGNÓSTICO: Stream callback chamado com sucesso para ${participantId}`);
        } catch (error) {
          console.error(`❌ WEBRTC DIAGNÓSTICO: Erro ao chamar stream callback:`, error);
        }
      } else {
        console.error(`❌ WEBRTC DIAGNÓSTICO: Stream callback não definido!`);
      }
      
      // FASE 4: Força atualização se callback falhou
      setTimeout(() => {
        console.log(`🔄 WEBRTC DIAGNÓSTICO: FORCE UPDATE após ontrack para ${participantId}`);
        window.dispatchEvent(new CustomEvent('participant-stream-connected', {
          detail: { participantId, stream: remoteStream }
        }));
      }, 100);
    } else {
      console.warn(`⚠️ WEBRTC DIAGNÓSTICO: Ontrack sem streams válidos para ${participantId}`);
    }
  };
}

// FASE 3: Setup para timeout de ICE gathering
export function setupICEGatheringTimeout(
  peerConnection: RTCPeerConnection,
  participantId: string,
  timeoutMs: number = 30000
) {
  const iceTimeout = setTimeout(() => {
    if (peerConnection.iceGatheringState !== 'complete') {
      console.log(`⏰ ICE GATHERING TIMEOUT for ${participantId}: Forcing completion`);
      
      // FASE 4: Tentar NAT tipo mais restritivo
      import('@/utils/webrtc/ConnectivityDiagnostics').then(({ connectivityDiagnostics }) => {
        const natType = connectivityDiagnostics.analyzeNATType(participantId);
        console.log(`🔍 NAT TYPE detected for ${participantId}: ${natType}`);
        
        if (natType === 'strict' || natType === 'symmetric') {
          console.log(`🔄 FORCING TURN-ONLY mode for ${participantId}`);
          window.dispatchEvent(new CustomEvent('force-turn-only', {
            detail: { participantId, natType }
          }));
        }
      });
    }
  }, timeoutMs);
  
  peerConnection.addEventListener('icegatheringstatechange', () => {
    if (peerConnection.iceGatheringState === 'complete') {
      clearTimeout(iceTimeout);
      console.log(`✅ ICE gathering completed for ${participantId}`);
    }
  });
}

// FASE 2: Validação de transceivers pós-negociação
export function validateTransceiversPostNegotiation(
  peerConnection: RTCPeerConnection,
  participantId: string
): boolean {
  console.log(`🔍 TRANSCEIVER VALIDATION for ${participantId}:`);
  
  const transceivers = peerConnection.getTransceivers();
  let allValid = true;
  
  transceivers.forEach((transceiver, index) => {
    const isValid = transceiver.currentDirection !== null;
    
    console.log(`📡 Transceiver ${index}:`, {
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection,
      valid: isValid,
      mid: transceiver.mid,
      sender: {
        track: transceiver.sender?.track?.kind,
        transport: transceiver.sender?.transport?.state
      },
      receiver: {
        track: transceiver.receiver?.track?.kind,
        transport: transceiver.receiver?.transport?.state
      }
    });
    
    if (!isValid) {
      allValid = false;
      console.warn(`⚠️ Invalid transceiver ${index} for ${participantId}`);
    }
  });
  
  if (!allValid) {
    console.log(`❌ TRANSCEIVER VALIDATION FAILED for ${participantId}`);
    
    // FASE 2: Trigger retry se transceivers inválidos
    setTimeout(() => {
      console.log(`🔄 TRIGGERING TRANSCEIVER RETRY for ${participantId}`);
      window.dispatchEvent(new CustomEvent('transceiver-validation-failed', {
        detail: { participantId, transceivers: transceivers.length }
      }));
    }, 1000);
  }
  
  return allValid;
}