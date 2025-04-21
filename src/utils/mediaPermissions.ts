
/**
 * Verifica e solicita permissões de mídia para câmera e microfone.
 */
export async function checkAndRequestMediaPermissions(): Promise<boolean> {
  try {
    if (navigator.permissions) {
      const camera = await navigator.permissions.query({ name: 'camera' as PermissionName });
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('Status da permissão de câmera:', camera.state);
      console.log('Status da permissão de microfone:', mic.state);

      if (camera.state !== 'granted' || mic.state !== 'granted') {
        return requestUserMedia();
      }
      return true;
    }
    // Fallback para navegadores que não suportam a API de permissões
    return requestUserMedia();
  } catch (error) {
    console.error('Erro ao verificar permissões:', error);
    return false;
  }
}

async function requestUserMedia(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    // Libera imediatamente as tracks, pois só precisamos da permissão agora
    stream.getTracks().forEach(track => track.stop());
    console.log('Permissões de mídia concedidas');
    return true;
  } catch (error) {
    console.error('Erro ao solicitar permissões de mídia:', error);
    alert('Para participar da transmissão, você precisa permitir o acesso à câmera e ao microfone.');
    return false;
  }
}
