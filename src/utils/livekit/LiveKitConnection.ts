import { Room, createLocalTracks, RoomEvent, Track } from 'livekit-client';

/**
 * Conecta ao LiveKit e retorna a room conectada
 * @param roomName Nome da sala (ex: sessionId)
 * @param userName Nome do usuário (ex: participantId ou 'host')
 * @returns Room conectada com tracks publicados
 */
export async function joinLiveRoom(
  roomName: string,
  userName: string
): Promise<Room> {
  // Verificar suporte a WebRTC
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Seu navegador não suporta WebRTC. Por favor, atualize para a versão mais recente.');
  }
  
  try {
    console.log('🚀 LiveKit: Iniciando conexão...', { roomName, userName });

    // 1. Solicitar token do backend
    const apiUrl = import.meta.env.VITE_API_URL || 'https://hutz-live-85.onrender.com';
    const tokenUrl = `${apiUrl}/get-token?room=${encodeURIComponent(roomName)}&user=${encodeURIComponent(userName)}`;
    
    console.log('📡 LiveKit: Solicitando token de:', tokenUrl);
    
    const response = await fetch(tokenUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const { token, url, room: roomFromToken, user, ttl } = data;
    
    if (!token) {
      throw new Error('Token não recebido do backend');
    }

    // Validação adicional
    if (!url) {
      console.warn('⚠️ URL do LiveKit não recebida, usando fallback');
    }
    
    console.log('✅ LiveKit: Token recebido com sucesso');
    console.log(`🔑 Token válido por ${ttl || 'N/A'} segundos`);

    // 2. Conectar ao LiveKit
    const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://web-rtc-menager-aoxvi3be.livekit.cloud';
    console.log(`🌐 Conectando a: ${url || livekitUrl}`);
    console.log('🔌 LiveKit: Conectando a:', livekitUrl);
    
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
      },
    });

    await room.connect(livekitUrl, token);
    console.log('📡 Conectado ao LiveKit');

    // 3. Criar e publicar tracks locais (câmera + microfone)
    console.log('🎥 LiveKit: Solicitando permissões de câmera e microfone...');
    console.log('📱 Dispositivo:', navigator.userAgent);
    
    try {
      const tracks = await createLocalTracks({
        audio: true,
        video: {
          facingMode: 'user',
          resolution: {
            width: 1280,
            height: 720,
            frameRate: 30,
          },
        },
      });

      console.log('🎥 Publicando câmera e microfone');
      
      // Publicar cada track na room
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
        console.log(`✅ Track publicado: ${track.kind}`);
      }
    } catch (mediaError) {
      console.error('❌ Erro ao acessar câmera/microfone:', mediaError);
      
      // Se falhar, conectar sem mídia local
      console.log('⚠️ Conectando sem mídia local...');
      
      // Apenas retornar a room sem publicar tracks
      return room;
    }

    // 4. Setup event listeners para novos participantes
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 Novo participante recebido:', participant.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log(`📹 Track recebido de ${participant.identity}:`, track.kind);
    });

    room.on(RoomEvent.Disconnected, () => {
      console.log('🔌 Desconectado do LiveKit');
    });

    console.log('✅ LiveKit: Conexão completa e tracks publicados');
    
    return room;

  } catch (error) {
    console.error('❌ Erro ao conectar ao LiveKit:', error);
    throw error;
  }
}

/**
 * Desconecta da room e limpa recursos
 */
export async function disconnectFromRoom(room: Room | null) {
  if (!room) return;
  
  try {
    console.log('🔌 LiveKit: Desconectando...');
    
    // Parar todas as tracks locais
    room.localParticipant.videoTrackPublications.forEach(publication => {
      publication.track?.stop();
    });
    
    room.localParticipant.audioTrackPublications.forEach(publication => {
      publication.track?.stop();
    });
    
    await room.disconnect();
    console.log('✅ LiveKit: Desconectado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao desconectar do LiveKit:', error);
  }
}
