import { io, Socket } from 'socket.io-client';
import { supabase } from '@/integrations/supabase/client';

let socket: Socket | null = null;
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let remoteStreams: { [participantId: string]: MediaStream } = {};
const iceCandidateBuffer: { [participantId: string]: RTCIceCandidate[] } = {};
const MAX_ICE_CANDIDATES = 50;

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export const getSocket = (): Socket | null => socket;

export const getPeerConnection = (): RTCPeerConnection | null => peerConnection;

export const getLocalStream = (): MediaStream | null => localStream;

export const getRemoteStream = (): MediaStream | null => remoteStream;

export const getRemoteStreams = (): { [participantId: string]: MediaStream } => remoteStreams;

export const setLocalStream = (stream: MediaStream | null) => {
  localStream = stream;
};

export const removeRemoteStream = (participantId: string) => {
  if (remoteStreams[participantId]) {
    delete remoteStreams[participantId];
  }
};

export const initSocket = (sessionId: string, participantId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      console.log('Socket already initialized');
      resolve(socket.id);
      return;
    }

    socket = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL as string, {
      query: { sessionId, participantId },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected', socket?.id);
      resolve(socket?.id || '');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${reason}`);
      socket = null;
    });
  });
};

export const stopAllTracks = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
};

export const closeMediaStream = () => {
  stopAllTracks(localStream);
  stopAllTracks(remoteStream);
  localStream = null;
  remoteStream = null;
};

export const createPeerConnection = (participantId: string): RTCPeerConnection => {
  peerConnection = new RTCPeerConnection(servers);

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log('ICE candidate:', event.candidate);
      addIceCandidate(participantId, event.candidate);
    }
  };

  peerConnection.onicegatheringstatechange = () => {
    console.log(`ICE gathering state changed: ${peerConnection?.iceGatheringState}`);
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection state change: ${peerConnection?.connectionState}`);
    if (peerConnection?.connectionState === 'failed') {
      console.log('Peer connection failed, restarting ICE');
      peerConnection?.restartIce();
    }
  };

  peerConnection.onsignalingstatechange = () => {
    console.log(`Signaling state change: ${peerConnection?.signalingState}`);
  };

  peerConnection.ontrack = (event) => {
    console.log('Track event:', event);
    if (!remoteStreams[participantId]) {
      remoteStreams[participantId] = new MediaStream();
    }
    event.streams[0].getTracks().forEach((track) => {
      remoteStreams[participantId]?.addTrack(track);
    });
  };

  return peerConnection;
};

export const addIceCandidate = (participantId: string, iceCandidate: RTCIceCandidate) => {
  if (!iceCandidateBuffer[participantId]) {
    iceCandidateBuffer[participantId] = [];
  }

  iceCandidateBuffer[participantId]?.push(iceCandidate);

  if (iceCandidateBuffer[participantId]?.length > MAX_ICE_CANDIDATES) {
    iceCandidateBuffer[participantId]?.shift();
  }
};

export const flushIceCandidateBuffer = async (participantId: string) => {
  if (peerConnection && iceCandidateBuffer[participantId]) {
    for (const candidate of iceCandidateBuffer[participantId]) {
      try {
        await peerConnection.addIceCandidate(candidate);
        console.log('ICE candidate added successfully');
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
    iceCandidateBuffer[participantId] = [];
  }
};

export const sendIceCandidates = async (participantId: string, iceCandidates: RTCIceCandidate[]) => {
  if (socket) {
    socket.emit('ice-candidate', {
      participantId,
      iceCandidates,
    });
  }
};

export const createOffer = async (participantId: string): Promise<void> => {
  if (!peerConnection) {
    throw new Error('Peer connection is not initialized.');
  }

  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, localStream as MediaStream);
      });
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    await peerConnection.setLocalDescription(offer);

    if (socket) {
      socket.emit('offer', {
        sdp: offer.sdp,
        target: participantId,
      });
    }
  } catch (e) {
    console.error('Error creating offer:', e);
  }
};

export const createAnswer = async (offer: RTCSessionDescriptionInit, participantId: string): Promise<void> => {
  if (!peerConnection) {
    throw new Error('Peer connection is not initialized.');
  }

  try {
    await peerConnection.setRemoteDescription(offer);

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection?.addTrack(track, localStream as MediaStream);
      });
    }

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    if (socket) {
      socket.emit('answer', {
        sdp: answer.sdp,
        target: participantId,
      });
    }
  } catch (e) {
    console.error('Error creating answer:', e);
  }
};

export const setRemoteAnswer = async (answer: RTCSessionDescriptionInit): Promise<void> => {
  if (!peerConnection) {
    throw new Error('Peer connection is not initialized.');
  }

  try {
    await peerConnection.setRemoteDescription(answer);
  } catch (e) {
    console.error('Error setting remote description:', e);
  }
};

export const hangUp = async (participantId: string) => {
  if (peerConnection) {
    peerConnection.close();
    console.log('Peer connection closed');
    peerConnection = null;
  }

  removeRemoteStream(participantId);

  if (socket) {
    socket.emit('hangup', {
      target: participantId,
    });
  }
};

export const initHostWebRTC = async (sessionId: string, participantId: string) => {
  if (!socket) {
    throw new Error('Socket is not initialized.');
  }

  socket.on('join', async (data: { origin: string; id: string }) => {
    const { origin, id } = data;
    console.log(`Participant ${id} joined the session from ${origin}`);

    createPeerConnection(id);

    socket.on('ice-candidate', async (data: { participantId: string; iceCandidates: RTCIceCandidate[] }) => {
      if (id === data.participantId) {
        data.iceCandidates.forEach(async (candidate) => {
          try {
            await peerConnection?.addIceCandidate(candidate);
            console.log('ICE candidate added successfully');
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        });
      }
    });

    socket.on('offer', async (data: { sdp: string; origin: string }) => {
      if (id === data.origin) {
        const offer = {
          type: 'offer',
          sdp: data.sdp,
        };
        await createAnswer(offer, id);
      }
    });

    socket.on('hangup', async (data: { origin: string }) => {
      if (id === data.origin) {
        console.log(`Participant ${id} hung up`);
        hangUp(id);
      }
    });

    socket.emit('host-acknowledge', {
      target: id,
      participantId,
    });
  });

  socket.on('leave', (data: { id: string }) => {
    console.log(`Participant ${data.id} left the session`);
    hangUp(data.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected, cleaning up');
    closeMediaStream();
  });
};

export const initParticipantWebRTC = async (sessionId: string, participantId: string, stream: MediaStream) => {
  if (!socket) {
    throw new Error('Socket is not initialized.');
  }

  localStream = stream;

  createPeerConnection(participantId);

  socket.on('ice-candidate', async (data: { participantId: string; iceCandidates: RTCIceCandidate[] }) => {
    if (participantId === data.participantId) {
      data.iceCandidates.forEach(async (candidate) => {
        try {
          await peerConnection?.addIceCandidate(candidate);
          console.log('ICE candidate added successfully');
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      });
    }
  });

  socket.on('answer', async (data: { sdp: string }) => {
    const answer = {
      type: 'answer',
      sdp: data.sdp,
    };
    await setRemoteAnswer(answer);
  });

  socket.on('hangup', () => {
    console.log('Host hung up');
    hangUp(participantId);
  });

  socket.on('host-leave', () => {
    console.log('Host left the session');
    closeMediaStream();
  });

  await createOffer(participantId);

  // Monitor WebRTC stats
  const statsInterval = setInterval(async () => {
    if (peerConnection?.connectionState === 'closed') {
      clearInterval(statsInterval);
      return;
    }

    try {
      const stats = await peerConnection?.getStats();
      let videoReceived = false;
      let audioReceived = false;

      stats?.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          videoReceived = report.bytesReceived > 0;
          console.log('Estatísticas de vídeo recebido:', {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            frameWidth: report.frameWidth,
            frameHeight: report.frameHeight,
            framesPerSecond: report.framesPerSecond,
          });
        }

        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          audioReceived = report.bytesReceived > 0;
          console.log('Estatísticas de áudio recebido:', {
            bytesReceived: report.bytesReceived,
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
          });
        }

        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          console.log('Estatísticas de conexão ICE:', {
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate,
            availableIncomingBitrate: report.availableIncomingBitrate,
          });
        }
      });

      // Verificar se estamos recebendo mídia
      if (!videoReceived) {
        console.warn('Não estamos recebendo vídeo');
      }

      if (!audioReceived) {
        console.warn('Não estamos recebendo áudio');
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
    }
  }, 5000); // Verificar a cada 5 segundos
};
