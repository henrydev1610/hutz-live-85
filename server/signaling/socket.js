// Armazenamento das conexões e salas
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

        if (!roomId || !userId) {
          console.error(`❌ JOIN: Missing required fields - roomId: ${roomId}, userId: ${userId}`);
          socket.emit('error', { message: 'roomId and userId are required' });
          socket.emit('join-room-response', { success: false, error: 'Missing roomId or userId' });
          return;
        }

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

        // Armazenar conexão com enhanced metadata
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

    socket.on('disconnect', () => {
      try {
        const connection = connections.get(socket.id);

        if (connection) {
          const { roomId, userId } = connection;

          console.log(`🔌 User ${userId} disconnecting from room ${roomId}`);

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
            timestamp: Date.now()
          });

          connections.delete(socket.id);

          console.log(`❌ User ${userId} disconnected from room ${roomId}`);
          logConnectionMetrics();
        }

      } catch (error) {
        console.error('Error in disconnect:', error);
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











