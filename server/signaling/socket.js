// Armazenamento das conexões e salas
const connections = new Map(); // socketId -> { roomId, userId, socketRef }
const rooms = new Map(); // roomId -> Set of socketIds

// Configuração dos servidores STUN/TURN
// FASE 4: Enhanced ICE server configuration with TURN servers
const getICEServers = () => {
  const servers = [];
  
  // Multiple STUN servers for redundancy
  const defaultStunServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' }
  ];
  
  // Use custom STUN servers if provided, otherwise use defaults
  if (process.env.STUN_SERVERS) {
    try {
      const stunServers = JSON.parse(process.env.STUN_SERVERS);
      stunServers.forEach(url => {
        servers.push({ urls: url });
      });
    } catch (error) {
      console.warn('Invalid STUN_SERVERS format, using defaults');
      servers.push(...defaultStunServers);
    }
  } else {
    servers.push(...defaultStunServers);
  }
  
  // TURN servers for production NAT traversal
  if (process.env.TURN_SERVERS) {
    try {
      const turnServers = JSON.parse(process.env.TURN_SERVERS);
      servers.push(...turnServers);
    } catch (error) {
      console.warn('Invalid TURN_SERVERS format');
    }
  } else {
    // Default TURN servers (replace with your production credentials)
    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      servers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL
      });
    }
  }
  
  console.log(`🌐 ICE Servers configured: ${servers.length} servers (${servers.filter(s => s.urls.includes('turn')).length} TURN, ${servers.filter(s => s.urls.includes('stun')).length} STUN)`);
  return servers;
};

const initializeSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Evento: Entrar na sala
    socket.on('join-room', (data) => {
      try {
        const { roomId, userId } = data;
        
        if (!roomId || !userId) {
          socket.emit('error', { message: 'roomId and userId are required' });
          return;
        }
        
        console.log(`👤 User ${userId} joining room ${roomId}`);
        
        // Armazenar conexão
        connections.set(socket.id, { roomId, userId, socketRef: socket });
        
        // Adicionar à sala
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        // Entrar na sala do Socket.IO
        socket.join(roomId);
        
        // Enviar configuração dos servidores ICE
        socket.emit('ice-servers', { servers: getICEServers() });
        
        // Notificar outros participantes
        socket.to(roomId).emit('user-connected', { 
          userId,
          socketId: socket.id,
          timestamp: Date.now()
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
                socketId: socketId
              });
            }
          });
        }
        
        socket.emit('room-participants', { participants: participantsInRoom });
        socket.emit('participants-update', { participants: participantsInRoom });
        
        console.log(`✅ User ${userId} joined room ${roomId} (${participantsInRoom.length + 1} total)`);
        
      } catch (error) {
        console.error('Error in join-room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    // Evento: Oferta WebRTC
    socket.on('offer', (data) => {
      try {
        const { roomId, targetSocketId, targetUserId, offer, fromUserId } = data;
        const connection = connections.get(socket.id);
        
        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }
        
        console.log(`📤 Offer from ${fromUserId || connection.userId} to ${targetUserId || targetSocketId}`);
        
        let finalTargetSocketId = targetSocketId;
        
        // Se temos targetUserId, encontrar o socketId correspondente
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
        
        // Enviar oferta para socket específico
        if (finalTargetSocketId) {
          socket.to(finalTargetSocketId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          // Enviar para toda a sala se não especificar destino
          socket.to(roomId).emit('offer', {
            offer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        }
        
      } catch (error) {
        console.error('Error in offer:', error);
        socket.emit('error', { message: 'Failed to send offer' });
      }
    });
    
    // Evento: Resposta WebRTC
    socket.on('answer', (data) => {
      try {
        const { roomId, targetSocketId, targetUserId, answer, fromUserId } = data;
        const connection = connections.get(socket.id);
        
        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }
        
        console.log(`📥 Answer from ${fromUserId || connection.userId} to ${targetUserId || targetSocketId}`);
        
        let finalTargetSocketId = targetSocketId;
        
        // Se temos targetUserId, encontrar o socketId correspondente
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
        
        // Enviar resposta para socket específico
        if (finalTargetSocketId) {
          socket.to(finalTargetSocketId).emit('answer', {
            answer,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          // Enviar para toda a sala se não especificar destino
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
    
    // Evento: Candidato ICE (suporte a ambos formatos)
    socket.on('ice', (data) => {
      try {
        const { roomId, targetSocketId, candidate } = data;
        const connection = connections.get(socket.id);
        
        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }
        
        // Enviar candidato ICE
        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          // Enviar para toda a sala se não especificar destino
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

    // Evento: Candidato ICE (formato UNIFIED)
    socket.on('ice-candidate', (data) => {
      try {
        const { roomId, targetUserId, candidate, fromUserId } = data;
        const connection = connections.get(socket.id);
        
        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }
        
        console.log(`🧊 ICE candidate from ${fromUserId || connection.userId} to ${targetUserId}`);
        
        // Encontrar socket do usuário alvo
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
        
        // Enviar candidato ICE
        if (targetSocketId) {
          socket.to(targetSocketId).emit('ice-candidate', {
            candidate,
            fromSocketId: socket.id,
            fromUserId: connection.userId
          });
        } else {
          console.warn(`Target user ${targetUserId} not found in room ${roomId}`);
        }
        
      } catch (error) {
        console.error('Error in ice-candidate:', error);
        socket.emit('error', { message: 'Failed to send ICE candidate' });
      }
    });

    // Evento: Stream iniciado
    socket.on('stream-started', (data) => {
      try {
        const { participantId, roomId, streamInfo } = data;
        const connection = connections.get(socket.id);
        
        if (!connection || connection.roomId !== roomId) {
          socket.emit('error', { message: 'Not in room' });
          return;
        }
        
        console.log(`📹 Stream started from ${participantId} in room ${roomId}`);
        
        // Notificar outros participantes
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
    
    // Evento: Heartbeat/Keep-alive
    socket.on('heartbeat', (data) => {
      const connection = connections.get(socket.id);
      if (connection) {
        socket.to(connection.roomId).emit('user-heartbeat', {
          userId: connection.userId,
          socketId: socket.id,
          timestamp: Date.now()
        });
      }
    });
    
    // Evento: Desconexão
    socket.on('disconnect', () => {
      try {
        const connection = connections.get(socket.id);
        
        if (connection) {
          const { roomId, userId } = connection;
          
          console.log(`🔌 User ${userId} disconnecting from room ${roomId}`);
          
          // Remover da sala
          const roomSockets = rooms.get(roomId);
          if (roomSockets) {
            roomSockets.delete(socket.id);
            
            // Remover sala se estiver vazia
            if (roomSockets.size === 0) {
              rooms.delete(roomId);
              console.log(`🗑️ Empty room ${roomId} removed`);
            }
          }
          
          // Notificar outros participantes
          socket.to(roomId).emit('user-disconnected', {
            userId,
            socketId: socket.id,
            timestamp: Date.now()
          });
          
          // Remover conexão
          connections.delete(socket.id);
          
          console.log(`❌ User ${userId} disconnected from room ${roomId}`);
        }
        
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    });
    
    // Evento: Deixar sala manualmente
    socket.on('leave-room', () => {
      const connection = connections.get(socket.id);
      if (connection) {
        socket.leave(connection.roomId);
        socket.emit('disconnect'); // Trigger disconnect logic
      }
    });
  });
  
  // Log estatísticas periodicamente
  setInterval(() => {
    console.log(`📊 Stats: ${connections.size} connections, ${rooms.size} active rooms`);
  }, 60000); // A cada minuto
};

module.exports = {
  initializeSocketHandlers,
  getICEServers
};
