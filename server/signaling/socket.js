// New WebRTC routing maps for direct connections
const hostByRoom = new Map(); // roomId → hostSocketId
const participantSocket = new Map(); // participantId → socketId
const socketToUser = new Map(); // socketId → {roomId, userId, role, joinedAt}

// Legacy maps for compatibility
const connections = new Map(); // socketId -> { roomId, userId, socketRef }
const rooms = new Map(); // roomId -> Set of socketIds

// FASE 2: Connection timeout e health monitoring
const CONNECTION_HEALTH_INTERVAL = 30000; // 30s
const STALE_CONNECTION_TIMEOUT = 120000; // 2 minutes

// Configuração dos servidores STUN/TURN
const getICEServers = () => {
  const servers = [];

  // STUN
  if (process.env.STUN_SERVERS) {
    try {
      const stunServers = JSON.parse(process.env.STUN_SERVERS);
      stunServers.forEach(url => servers.push({ urls: url }));
    } catch {
      console.warn('Invalid STUN_SERVERS format, using defaults');
      servers.push({ urls: 'stun:stun.l.google.com:19302' });
    }
  } else {
    servers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' } // <— corrigido: adiciona "stun:"
    );
  }

  // TURN
  if (process.env.TURN_SERVERS) {
    try {
      const turnServers = JSON.parse(process.env.TURN_SERVERS);
      servers.push(...turnServers);
    } catch {
      console.warn('Invalid TURN_SERVERS format');
    }
  }

  // Log seguro (evita expor credenciais em produção)
  const toLog = servers.map(s => ({
    urls: s.urls,
    username: s.username,
    hasCredential: !!s.credential
  }));
  if (process.env.NODE_ENV !== 'production') {
    console.log('ICE servers carregados:', JSON.stringify(toLog));
  }

  return servers;
};


// FASE 4: Enhanced connection logging
const logConnectionMetrics = () => {
  const roomsData = Array.from(rooms.entries()).map(([roomId, sockets]) => ({
    roomId,
    participants: sockets.size,
    socketIds: Array.from(sockets)
  }));

  console.log(`📊 SERVER METRICS: ${connections.size} connections, ${rooms.size} active rooms`);
  console.log(`🏠 ROOMS DETAIL:`, roomsData);
};

// FASE 4: Connection health monitoring
const cleanupStaleConnections = () => {
  const now = Date.now();
  const staleConnections = [];

  connections.forEach((conn, socketId) => {
    if (conn.lastSeen && (now - conn.lastSeen) > STALE_CONNECTION_TIMEOUT) {
      staleConnections.push({ socketId, conn });
    }
  });

  staleConnections.forEach(({ socketId, conn }) => {
    console.log(`🧹 CLEANUP: Removing stale connection ${socketId} (last seen ${Math.round((now - conn.lastSeen) / 1000)}s ago)`);

    // Remove from room
    const roomSockets = rooms.get(conn.roomId);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        rooms.delete(conn.roomId);
        console.log(`🗑️ CLEANUP: Empty room ${conn.roomId} removed`);
      }
    }

    // Remove connection
    connections.delete(socketId);
  });

  if (staleConnections.length > 0) {
    logConnectionMetrics();
  }
};

const initializeSocketHandlers = (io) => {
  // FASE 4: Setup health monitoring
  setInterval(() => {
    logConnectionMetrics();
    cleanupStaleConnections();
  }, CONNECTION_HEALTH_INTERVAL);

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} from ${socket.handshake.address}`);
    console.log(`📡 CONNECTION HEADERS:`, {
      userAgent: socket.handshake.headers['user-agent'],
      networkQuality: socket.handshake.headers['x-network-quality'],
      origin: socket.handshake.headers.origin
    });

    // Suporte a múltiplos formatos de join-room
    const handleJoinRoom = (data) => {
      try {
        const { roomId, userId, networkQuality } = data;

        // Validação básica de parâmetros obrigatórios
        if (!roomId || !userId) {
          console.error(`❌ JOIN: Missing required fields - roomId: ${roomId}, userId: ${userId}`);
          socket.emit('error', { message: 'roomId and userId are required' });
          socket.emit('join-error', { 
            error: 'Missing roomId or userId',
            received: { roomId, userId }
          });
          socket.emit('join-room-response', { success: false, error: 'Missing roomId or userId' });
          return;
        }

        // Validação de formato do roomId (sessionId)
        if (typeof roomId !== 'string' || roomId.length < 5 || roomId.length > 50) {
          console.error('❌ JOIN ROOM: Invalid roomId format:', roomId);
          socket.emit('join-error', { 
            error: 'Invalid session ID format',
            roomId: roomId,
            details: 'Session ID must be between 5-50 characters'
          });
          socket.emit('join-room-response', { success: false, error: 'Invalid session ID format' });
          return;
        }

        // Validação de caracteres do roomId
        const validFormat = /^[a-zA-Z0-9\-_]+$/.test(roomId);
        if (!validFormat) {
          console.error('❌ JOIN ROOM: Invalid roomId characters:', roomId);
          socket.emit('join-error', { 
            error: 'Invalid session ID characters',
            roomId: roomId,
            details: 'Session ID can only contain letters, numbers, hyphens and underscores'
          });
          socket.emit('join-room-response', { success: false, error: 'Invalid session ID characters' });
          return;
        }

        console.log('✅ JOIN ROOM: Session ID validation passed:', roomId);

         // adicioando log para controle de servido ICE
    const iceServers = getICEServers();

    // Log “seguro” (não imprime credential em produção)
    const safeIceLog = iceServers.map(s => ({
      urls: s.urls,
      username: s.username,
      hasCredential: Boolean(s.credential),
    }));

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🧊 ICE (join-room): user=${userId} room=${roomId}`, safeIceLog);
    }

    // Se você já tinha esse emit mais abaixo, pode mover para cá
    socket.emit('ice-servers', { iceServers });

        console.log(`👤 JOIN REQUEST: User ${userId} joining room ${roomId} (Network: ${networkQuality || 'unknown'})`);

        // Verificar se já está em uma sala
        const existingConnection = connections.get(socket.id);
        if (existingConnection) {
          console.log(`⚠️ User ${userId} already in room ${existingConnection.roomId}, cleaning up...`);
          // Remover da sala anterior
          const oldRoom = rooms.get(existingConnection.roomId);
          if (oldRoom) {
            oldRoom.delete(socket.id);
            socket.leave(existingConnection.roomId);
          }
        }

        // Detect role: host vs participant based on userId
        const isHost = userId.includes('host') || userId.startsWith('host-');
        const role = isHost ? 'host' : 'participant';

        // Update new routing maps for direct WebRTC routing
        if (isHost) {
          const oldHostSocketId = hostByRoom.get(roomId);
          if (oldHostSocketId && oldHostSocketId !== socket.id) {
            console.log(`⚠️ HOST-REPLACE: Room ${roomId} old=${oldHostSocketId} new=${socket.id}`);
          }
          hostByRoom.set(roomId, socket.id);
          console.log(`SERVER-HOST-SOCKET-SET roomId=${roomId} socketId=${socket.id}`);
        } else {
          const oldSocketId = participantSocket.get(userId);
          if (oldSocketId && oldSocketId !== socket.id) {
            console.log(`PARTICIPANT-REJOIN ${userId} oldSocket=${oldSocketId} newSocket=${socket.id}`);
          }
          participantSocket.set(userId, socket.id);
          console.log(`SERVER-PARTICIPANT-SOCKET-SET participantId=${userId} socketId=${socket.id}`);
        }

        // Update socketToUser mapping
        socketToUser.set(socket.id, {
          roomId,
          userId,
          role,
          joinedAt: Date.now()
        });

        // Legacy connections (keep for compatibility)
        connections.set(socket.id, {
          roomId,
          userId,
          socketRef: socket,
          joinedAt: Date.now(),
          lastSeen: Date.now(),
          networkQuality: networkQuality || 'unknown'
        });

        // Adicionar à sala
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);

        // Entrar na sala do Socket.IO
        socket.join(roomId);

        // FASE 1: Enviar configuração dos servidores ICE
        socket.emit('ice-servers', { iceServers: getICEServers() });

        // Notificar outros participantes
        socket.to(roomId).emit('user-connected', {
          userId,
          socketId: socket.id,
          timestamp: Date.now(),
          networkQuality: networkQuality || 'unknown'
        });

        // Enviar lista de participantes existentes
        const participantsInRoom = [];
        const roomSockets = rooms.get(roomId);

        if (roomSockets) {
          roomSockets.forEach(socketId => {
            const conn = connections.get(socketId);
            if (conn && socketId !== socket.id) {
              participantsInRoom.push({
                userId: conn.userId,
                socketId: socketId,
                networkQuality: conn.networkQuality
              });
            }
          });
        }

        // FASE 2: Enhanced success responses with multiple confirmations
        const successData = {
          success: true,
          roomId,
          userId,
          participants: participantsInRoom,
          timestamp: Date.now(),
          iceServers: getICEServers()
        };

        // Enviar múltiplas confirmações para garantir recebimento
        socket.emit('room_joined', successData);
        socket.emit('join-room-response', successData);
        socket.emit('room-participants', { participants: participantsInRoom });
        socket.emit('participants-update', participantsInRoom);

        console.log(`✅ JOIN SUCCESS: User ${userId} joined room ${roomId} (${participantsInRoom.length + 1} total participants)`);
        logConnectionMetrics();

      } catch (error) {
        console.error('❌ JOIN ERROR:', error);
        const errorMessage = `Failed to join room: ${error.message}`;
        socket.emit('error', { message: errorMessage });
        socket.emit('join-room-response', { success: false, error: errorMessage });
      }
    };

    // Registrar múltiplos eventos para compatibilidade
    socket.on('join-room', handleJoinRoom);
    socket.on('join_room', handleJoinRoom);

    // FASE 4: Enhanced heartbeat with connection health tracking
    socket.on('ping', (callback) => {
      const connection = connections.get(socket.id);
      if (connection) {
        connection.lastSeen = Date.now();
        console.log(`💓 HEARTBEAT: Updated last seen for ${connection.userId}`);
      }

      // Respond with server health info
      const response = {
        timestamp: Date.now(),
        serverHealth: 'ok',
        connectionsCount: connections.size,
        roomsCount: rooms.size
      };

      if (callback && typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('pong', response);
      }
    });

    socket.on('offer', (data) => {
      try {
        const { roomId, targetSocketId, targetUserId, offer, fromUserId } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        // Update last seen
        connection.lastSeen = Date.now();

        console.log(`📤 Offer from ${fromUserId || connection.userId} to ${targetUserId || targetSocketId}`);

        let finalTargetSocketId = targetSocketId;

        if (targetUserId && !targetSocketId) {
          const roomSockets = rooms.get(roomId);
          if (roomSockets) {
            for (const socketId of roomSockets) {
              const conn = connections.get(socketId);
              if (conn && conn.userId === targetUserId) {
                finalTargetSocketId = socketId;
                break;
              }
            }
          }
        }

        if (finalTargetSocketId) {
          socket.to(finalTargetSocketId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          console.warn(`❌ OFFER: target not found for userId=${targetUserId} / socketId=${targetSocketId}`);
          socket.emit('error', { message: 'Target not found for offer' });
          return;
        }


      } catch (error) {
        console.error('Error in offer:', error);
        socket.emit('error', { message: 'Failed to send offer' });
      }
    });

    socket.on('answer', (data) => {
      try {
        const { roomId, targetSocketId, targetUserId, answer, fromUserId } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        connection.lastSeen = Date.now();

        console.log(`📥 Answer from ${fromUserId || connection.userId} to ${targetUserId || targetSocketId}`);

        let finalTargetSocketId = targetSocketId;

        if (targetUserId && !targetSocketId) {
          const roomSockets = rooms.get(roomId);
          if (roomSockets) {
            for (const socketId of roomSockets) {
              const conn = connections.get(socketId);
              if (conn && conn.userId === targetUserId) {
                finalTargetSocketId = socketId;
                break;
              }
            }
          }
        }

        if (finalTargetSocketId) {
          socket.to(finalTargetSocketId).emit('answer', {
            answer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          socket.to(roomId).emit('answer', {
            answer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        }

      } catch (error) {
        console.error('Error in answer:', error);
        socket.emit('error', { message: 'Failed to send answer' });
      }
    });

    // ICE legacy - mantido apenas para compatibilidade (não usado no fluxo principal)
    /*
    socket.on('ice', (data) => {
      try {
        const { roomId, targetSocketId, candidate } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        connection.lastSeen = Date.now();

        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          socket.to(roomId).emit('ice', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        }

      } catch (error) {
        console.error('Error in ice:', error);
        socket.emit('error', { message: 'Failed to send ICE candidate' });
      }
    });
    */

    socket.on('ice-candidate', (data) => {
      try {
        const { roomId, targetUserId, candidate, fromUserId } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        connection.lastSeen = Date.now();

        console.log(`🧊 [SERVER] ICE candidate: ${fromUserId || connection.userId} -> ${targetUserId}`);

        let targetSocketId = null;
        const roomSockets = rooms.get(roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const conn = connections.get(socketId);
            if (conn && conn.userId === targetUserId) {
              targetSocketId = socketId;
              break;
            }
          }
        }

        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          console.warn(`⚠️ [SERVER] Target user ${targetUserId} not found in room ${roomId}`);
        }

      } catch (error) {
        console.error('Error in ice-candidate:', error);
        socket.emit('error', { message: 'Failed to send ICE candidate' });
      }
    });

    socket.on('stream-started', (data) => {
      try {
        const { participantId, roomId, streamInfo } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }

        connection.lastSeen = Date.now();

        console.log(`📹 Stream started from ${participantId} in room ${roomId}`);

        socket.to(roomId).emit('stream-started', {
          participantId,
          streamInfo,
          fromSocketId: socket.id,
          timestamp: Date.now()
        });

      } catch (error) {
        console.error('Error in stream-started:', error);
        socket.emit('error', { message: 'Failed to notify stream started' });
      }
    });

    socket.on('heartbeat', (data) => {
      const connection = connections.get(socket.id);
      if (connection) {
        connection.lastSeen = Date.now();
        socket.to(connection.roomId).emit('user-heartbeat', {
          userId: connection.userId,
          socketId: socket.id,
          timestamp: Date.now()
        });
      }
    });

    socket.on('disconnect', (reason) => {
      try {
        const connection = connections.get(socket.id);
        const userInfo = socketToUser.get(socket.id);

        if (connection || userInfo) {
          const roomId = connection?.roomId || userInfo?.roomId;
          const userId = connection?.userId || userInfo?.userId;
          const role = userInfo?.role || 'unknown';

          console.log(`🔌 User ${userId} disconnecting from room ${roomId} (reason: ${reason})`);

          // Clean up new routing maps
          if (userInfo) {
            if (userInfo.role === 'host') {
              if (hostByRoom.get(roomId) === socket.id) {
                hostByRoom.delete(roomId);
                console.log(`HOST-SOCKET-DISCONNECTED roomId=${roomId} socketId=${socket.id} reason=${reason}`);
              }
            } else {
              if (participantSocket.get(userId) === socket.id) {
                participantSocket.delete(userId);
                console.log(`PARTICIPANT-SOCKET-DISCONNECTED participantId=${userId} socketId=${socket.id} reason=${reason}`);
              }
            }
            socketToUser.delete(socket.id);
          }

          // Legacy cleanup
          const roomSockets = rooms.get(roomId);
          if (roomSockets) {
            roomSockets.delete(socket.id);

            if (roomSockets.size === 0) {
              rooms.delete(roomId);
              console.log(`🗑️ Empty room ${roomId} removed`);
            }
          }

          socket.to(roomId).emit('user-disconnected', {
            userId,
            socketId: socket.id,
            timestamp: Date.now(),
            reason
          });

          // Emit participant-left with detailed info
          socket.to(roomId).emit('participant-left', {
            participantId: userId,
            reason,
            timestamp: Date.now()
          });

          connections.delete(socket.id);

          console.log(`SERVER-DISCONNECT userId=${userId} roomId=${roomId} role=${role} reason=${reason}`);
          logConnectionMetrics();
        }

      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });

    // LEGACY: Keep old handlers for backward compatibility (simplified)

    // NEW: Direct WebRTC routing with in-memory maps
    socket.on('webrtc-request-offer', (data) => {
      try {
        const { roomId, participantId } = data;
        const userInfo = socketToUser.get(socket.id);

        if (!userInfo || userInfo.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room for WebRTC request-offer' });
          return;
        }

        // Direct participant lookup via map
        const targetSocketId = participantSocket.get(participantId);
        
        if (targetSocketId) {
          console.log(`SERVER-REQUEST-OFFER-ROUTED roomId=${roomId} participantId=${participantId} socketId=${targetSocketId}`);
          socket.to(targetSocketId).emit('webrtc-request-offer', {
            fromSocketId: socket.id,
            fromUserId: userInfo.userId,
            roomId
          });
        } else {
          console.log(`SERVER-MISSING-PARTICIPANT roomId=${roomId} participantId=${participantId}`);
          socket.emit('webrtc-participant-missing', { roomId, participantId });
        }

      } catch (error) {
        console.error('Error in webrtc-request-offer:', error);
        socket.emit('error', { message: 'Failed to send webrtc-request-offer' });
      }
    });

    // NEW: Enhanced offer routing from participant to host with timeout and validation
    socket.on('webrtc-offer', (data) => {
      try {
        const { roomId, offer } = data;
        const userInfo = socketToUser.get(socket.id);

        if (!userInfo || userInfo.roomId !== roomId) {
          console.log(`SERVER-OFFER-REJECTED roomId=${roomId} reason=not-in-room`);
          socket.emit('error', { message: 'Not in room for WebRTC offer' });
          return;
        }

        // Validar offer
        if (!offer || !offer.sdp || !offer.type) {
          console.log(`SERVER-OFFER-INVALID roomId=${roomId} participantId=${userInfo.userId} reason=missing-sdp`);
          socket.emit('webrtc-error', { 
            message: 'Invalid offer format',
            expectedFormat: '{offer: {sdp, type}}'
          });
          return;
        }

        // Direct host lookup via map with fallback
        let hostSocketId = hostByRoom.get(roomId);
        
        // Fallback: buscar host na conexões
        if (!hostSocketId) {
          connections.forEach((conn, sockId) => {
            if (conn.roomId === roomId && conn.userId.includes('host')) {
              hostSocketId = sockId;
              hostByRoom.set(roomId, sockId); // Atualizar cache
            }
          });
        }
        
        const sdpLen = offer.sdp.length;
        
        if (hostSocketId) {
          console.log(`SERVER-FWD-OFFER roomId=${roomId} participantId=${userInfo.userId} hostSocketId=${hostSocketId} sdpLen=${sdpLen}`);
          
          // Configurar timeout para offer sem resposta
          const offerTimeoutId = setTimeout(() => {
            console.warn(`SERVER-OFFER-TIMEOUT roomId=${roomId} participantId=${userInfo.userId} timeout=10s`);
            socket.emit('webrtc-offer-timeout', {
              roomId,
              participantId: userInfo.userId,
              timeoutMs: 10000
            });
          }, 10000);
          
          // Armazenar timeout para cleanup
          const connection = connections.get(socket.id);
          if (connection) {
            connection.offerTimeout = offerTimeoutId;
          }
          
          socket.to(hostSocketId).emit('webrtc-offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: userInfo.userId,
            participantId: userInfo.userId,
            timestamp: Date.now(),
            roomId
          });
          
          console.log(`SERVER-OFFER-SENT roomId=${roomId} from=${userInfo.userId} to=host`);
        } else {
          console.log(`SERVER-MISSING-HOST roomId=${roomId} participantId=${userInfo.userId}`);
          socket.emit('webrtc-host-missing', { 
            roomId, 
            participantId: userInfo.userId,
            suggestRetry: true,
            retryDelay: 3000
          });
        }

      } catch (error) {
        console.error('Error in webrtc-offer:', error);
        socket.emit('error', { message: 'Failed to send WebRTC offer' });
      }
    });

    // NEW: Enhanced answer routing from host to participant with timeout cleanup
    socket.on('webrtc-answer', (data) => {
      try {
        const { roomId, participantId, answer } = data;
        const userInfo = socketToUser.get(socket.id);

        if (!userInfo || userInfo.roomId !== roomId) {
          console.log(`SERVER-ANSWER-REJECTED roomId=${roomId} reason=not-in-room`);
          socket.emit('error', { message: 'Not in room for WebRTC answer' });
          return;
        }

        // Validar answer
        if (!answer || !answer.sdp || !answer.type) {
          console.log(`SERVER-ANSWER-INVALID roomId=${roomId} participantId=${participantId} reason=missing-sdp`);
          socket.emit('webrtc-error', { 
            message: 'Invalid answer format',
            expectedFormat: '{answer: {sdp, type}}'
          });
          return;
        }

        // Direct participant lookup via map with fallback
        let targetSocketId = participantSocket.get(participantId);
        
        if (!targetSocketId) {
          connections.forEach((conn, sockId) => {
            if (conn.userId === participantId && conn.roomId === roomId) {
              targetSocketId = sockId;
              participantSocket.set(participantId, sockId); // Atualizar cache
            }
          });
        }
        
        if (targetSocketId) {
          // Limpar timeout do offer correspondente
          const targetConnection = connections.get(targetSocketId);
          if (targetConnection && targetConnection.offerTimeout) {
            clearTimeout(targetConnection.offerTimeout);
            delete targetConnection.offerTimeout;
            console.log(`SERVER-ANSWER-TIMEOUT-CLEARED roomId=${roomId} participantId=${participantId}`);
          }
          
          console.log(`SERVER-FWD-ANSWER roomId=${roomId} participantId=${participantId} socketId=${targetSocketId}`);
          socket.to(targetSocketId).emit('webrtc-answer', {
            answer,
            fromSocketId: socket.id,
            fromUserId: userInfo.userId,
            timestamp: Date.now(),
            roomId
          });
          
          console.log(`SERVER-ANSWER-SENT roomId=${roomId} from=host to=${participantId}`);
        } else {
          console.log(`SERVER-MISSING-PARTICIPANT roomId=${roomId} participantId=${participantId}`);
          socket.emit('webrtc-participant-missing', { 
            roomId, 
            participantId,
            suggestRetry: true,
            retryDelay: 2000
          });
        }

      } catch (error) {
        console.error('Error in webrtc-answer:', error);
        socket.emit('error', { message: 'Failed to send WebRTC answer' });
      }
    });

    // NEW: Direct ICE candidate routing
    socket.on('webrtc-candidate', (data) => {
      try {
        const { roomId, targetUserId, candidate } = data;
        const userInfo = socketToUser.get(socket.id);

        if (!userInfo || userInfo.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room for WebRTC candidate' });
          return;
        }

        const candidateType = candidate?.candidate?.includes('typ') ? 
          candidate.candidate.split(' ').find(part => part.startsWith('typ'))?.split(' ')[1] || 'unknown' : 'unknown';

        // Route to target via direct lookup
        let targetSocketId = null;
        if (userInfo.role === 'host') {
          // Host sending to participant
          targetSocketId = participantSocket.get(targetUserId);
        } else {
          // Participant sending to host
          targetSocketId = hostByRoom.get(roomId);
        }
        
        if (targetSocketId) {
          console.log(`ICE-CANDIDATE-SENT roomId=${roomId} from=${userInfo.userId} to=${targetUserId} type=${candidateType}`);
          socket.to(targetSocketId).emit('webrtc-candidate', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: userInfo.userId
          });
        } else {
          console.log(`SERVER-MISSING-TARGET roomId=${roomId} targetUserId=${targetUserId}`);
        }

      } catch (error) {
        console.error('Error in webrtc-candidate:', error);
        socket.emit('error', { message: 'Failed to send WebRTC candidate' });
      }
    });

    // LEGACY: Keep old handlers for backward compatibility
    socket.on('request-offer', (data) => {
      try {
        const { roomId, targetUserId, fromUserId } = data;
        const connection = connections.get(socket.id);

        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room for request-offer' });
          return;
        }

        connection.lastSeen = Date.now();
         // Encontrar socket do participante alvo
        let targetSocketId = null;
        const roomSockets = rooms.get(roomId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const conn = connections.get(socketId);
            if (conn && conn.userId === targetUserId) {
              targetSocketId = socketId;
              break;
            }
          }
        }

        if (targetSocketId) {
          console.log(`SERVER-REQUEST-OFFER-ROUTED to=${targetSocketId}`);
          socket.to(targetSocketId).emit('request-offer', {
            fromSocketId: socket.id,
            fromUserId: connection.userId,
            roomId
          });
        } else {
          console.log(`SERVER-REQUEST-OFFER-OFFLINE user=${targetUserId} roomId=${roomId}`);
        }

      } catch (error) {
        console.error('Error in request-offer:', error);
        socket.emit('error', { message: 'Failed to send request-offer' });
      }
    });

    socket.on('leave-room', () => {
      const connection = connections.get(socket.id);
      if (connection) {
        socket.leave(connection.roomId);
        socket.emit('disconnect');
      }
    });
  });

  console.log('🚀 Socket handlers initialized with enhanced stability and monitoring');
};

module.exports = {
  initializeSocketHandlers,
  getICEServers
};











