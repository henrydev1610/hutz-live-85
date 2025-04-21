
/**
 * Utilitários WebRTC: verificação e priorização de codecs.
 */
export type SupportedCodecInfo = { codec: string; supported: boolean };

export async function checkCodecSupport(): Promise<{ video: SupportedCodecInfo[]; audio: SupportedCodecInfo[] }> {
  const supportedCodecs = {
    video: [] as SupportedCodecInfo[],
    audio: [] as SupportedCodecInfo[],
  };

  // Codecs de vídeo populares para WebRTC no navegador
  const videoCodecs = ['video/H264', 'video/VP8', 'video/VP9', 'video/AV1'];
  for (const codec of videoCodecs) {
    const supported = typeof window !== 'undefined' && 'MediaRecorder' in window
      ? (window as any).MediaRecorder.isTypeSupported(codec)
      : false;
    supportedCodecs.video.push({ codec, supported });
  }

  // Codecs de áudio populares para WebRTC no navegador
  const audioCodecs = ['audio/opus', 'audio/PCMU', 'audio/PCMA', 'audio/G722'];
  for (const codec of audioCodecs) {
    const supported = typeof window !== 'undefined' && 'MediaRecorder' in window
      ? (window as any).MediaRecorder.isTypeSupported(codec)
      : false;
    supportedCodecs.audio.push({ codec, supported });
  }

  console.log('Codecs suportados detectados:', supportedCodecs);
  return supportedCodecs;
}

/**
 * Modificar a ordem dos codecs em um SDP para priorizar H.264 (vídeo) e Opus (áudio)
 * @param sdp - descrição SDP bruta (string)
 * @returns SDP com ordem preferencial dos codecs
 */
export function setPreferredCodecs(sdp: string): string {
  let modifiedSdp = sdp;

  // Rearranja codecs de vídeo: coloca H264 no início
  modifiedSdp = modifiedSdp.replace(
    /(m=video .*\r\n)((a=rtpmap:.*\r\n)*)/g,
    (match, mLine, rest) => {
      const lines = rest.split('\r\n').filter(Boolean);
      const h264 = lines.filter(line => line.toUpperCase().includes('H264'));
      const others = lines.filter(line => !line.toUpperCase().includes('H264'));
      return `${mLine}${h264.concat(others).join('\r\n')}\r\n`;
    }
  );

  // Rearranja codecs de áudio: coloca OPUS no início
  modifiedSdp = modifiedSdp.replace(
    /(m=audio .*\r\n)((a=rtpmap:.*\r\n)*)/g,
    (match, mLine, rest) => {
      const lines = rest.split('\r\n').filter(Boolean);
      const opus = lines.filter(line => line.toLowerCase().includes('opus'));
      const others = lines.filter(line => !line.toLowerCase().includes('opus'));
      return `${mLine}${opus.concat(others).join('\r\n')}\r\n`;
    }
  );

  return modifiedSdp;
}

/**
 * Exemplo de como usar na criação de oferta WebRTC:
 * 
 * import { setPreferredCodecs } from './webrtcCodecs';
 * 
 * async function createOfferWithPreferredCodecs(peerConnection: RTCPeerConnection) {
 *   const offer = await peerConnection.createOffer();
 *   const preferredSdp = setPreferredCodecs(offer.sdp);
 *   const modifiedOffer = new RTCSessionDescription({
 *     type: offer.type,
 *     sdp: preferredSdp
 *   });
 *   await peerConnection.setLocalDescription(modifiedOffer);
 *   return modifiedOffer;
 * }
 */
