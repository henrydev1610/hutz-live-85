// Validação e correção de tracks de mídia
export const validateAndFixMediaTracks = (stream: MediaStream): void => {
  if (!stream) {
    console.warn('⚠️ TRACK VALIDATION: Stream is null/undefined');
    return;
  }

  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  console.log('🔍 TRACK VALIDATION: Analyzing stream tracks:', {
    streamId: stream.id,
    active: stream.active,
    videoTracks: videoTracks.length,
    audioTracks: audioTracks.length
  });

  // Validar e corrigir tracks de vídeo
  videoTracks.forEach((track, index) => {
    console.log(`🎬 VIDEO TRACK ${index}:`, {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      label: track.label
    });

    // CORREÇÃO CRÍTICA: Garantir que tracks de vídeo estão habilitados
    if (!track.enabled) {
      console.warn(`⚠️ FIXING: Habilitando video track desabilitado: ${track.id}`);
      track.enabled = true;
    }

    // Verificar se track está funcional
    if (track.readyState === 'ended') {
      console.error(`❌ VIDEO TRACK ENDED: Track ${track.id} está finalizado`);
    }
  });

  // Validar tracks de áudio
  audioTracks.forEach((track, index) => {
    console.log(`🎵 AUDIO TRACK ${index}:`, {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      label: track.label
    });

    if (!track.enabled) {
      console.warn(`⚠️ FIXING: Habilitando audio track desabilitado: ${track.id}`);
      track.enabled = true;
    }
  });

  // Verificar se o stream está ativo
  if (!stream.active) {
    console.error('❌ STREAM INACTIVE: Stream não está ativo');
  }
};

export const logStreamDetails = (stream: MediaStream, context: string): void => {
  console.log(`📊 STREAM DETAILS (${context}):`, {
    id: stream.id,
    active: stream.active,
    videoTracks: stream.getVideoTracks().map(track => ({
      id: track.id,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      settings: track.getSettings()
    })),
    audioTracks: stream.getAudioTracks().map(track => ({
      id: track.id,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState
    }))
  });
};