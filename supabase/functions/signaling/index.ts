
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define headers for CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Define WebSocket connection types
type Room = {
  id: string;
  connections: Map<string, WebSocket>;
  lastActive: number;
};

type SignalingMessage = {
  type: string;
  senderId?: string;
  targetId?: string;
  sessionId?: string;
  description?: RTCSessionDescription;
  candidate?: RTCIceCandidate;
  timestamp?: number;
  [key: string]: any;
};

// Create a map to store active rooms
const rooms = new Map<string, Room>();

// Database operations
async function createOrUpdateRoom(supabase: any, roomId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('signaling_rooms')
      .upsert({ 
        room_id: roomId,
        last_active: new Date().toISOString()
      }, { 
        onConflict: 'room_id',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('Error updating room:', error);
    }
  } catch (e) {
    console.error('Exception creating/updating room:', e);
  }
}

async function addParticipantToRoom(
  supabase: any, 
  roomId: string, 
  peerId: string, 
  userName?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('signaling_participants')
      .insert({
        room_id: roomId,
        peer_id: peerId,
        user_name: userName || `Participant ${peerId.substring(0, 4)}`
      });
    
    if (error) {
      console.error('Error adding participant:', error);
    }
    
    // Update participant count
    await supabase
      .from('signaling_rooms')
      .update({ 
        participant_count: rooms.get(roomId)?.connections.size || 1,
        last_active: new Date().toISOString()
      })
      .eq('room_id', roomId);
      
  } catch (e) {
    console.error('Exception adding participant:', e);
  }
}

async function updateParticipantStatus(
  supabase: any,
  roomId: string,
  peerId: string,
  isConnected: boolean
): Promise<void> {
  try {
    const { error } = await supabase
      .from('signaling_participants')
      .update({
        is_connected: isConnected,
        last_active: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('peer_id', peerId);
    
    if (error) {
      console.error('Error updating participant status:', error);
    }
  } catch (e) {
    console.error('Exception updating participant status:', e);
  }
}

// WebSocket server handler
serve(async (req) => {
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Extract URL parameters
  const url = new URL(req.url);
  const roomId = url.searchParams.get('room');
  const peerId = url.searchParams.get('id');
  const userName = url.searchParams.get('name');

  // Create Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check for required parameters
  if (!roomId || !peerId) {
    return new Response(
      JSON.stringify({ error: 'Room ID and Peer ID are required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response(
      JSON.stringify({ error: 'This endpoint requires a WebSocket connection' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Create WebSocket connection
  const { socket, response } = Deno.upgradeWebSocket(req);

  // Create or get room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      connections: new Map(),
      lastActive: Date.now(),
    });
    
    // Create room in database
    await createOrUpdateRoom(supabase, roomId);
    console.log(`Created room ${roomId}`);
  }

  const room = rooms.get(roomId)!;
  
  // Store connection in the appropriate room
  room.connections.set(peerId, socket);
  room.lastActive = Date.now();
  
  // Add participant to room in database
  await addParticipantToRoom(supabase, roomId, peerId, userName);
  console.log(`Participant ${peerId} joined room ${roomId}`);

  // Send welcome message
  socket.send(JSON.stringify({
    type: 'welcome',
    roomId,
    peerId,
    timestamp: Date.now()
  }));
  
  // Notify others in the room that a new peer has joined
  room.connections.forEach((conn, id) => {
    if (id !== peerId && conn.readyState === WebSocket.OPEN) {
      conn.send(JSON.stringify({
        type: 'user-joined',
        peerId: peerId,
        userName: userName,
        timestamp: Date.now()
      }));
    }
  });

  // Send list of current peers to the new peer
  const peerList = Array.from(room.connections.keys())
    .filter(id => id !== peerId);
  
  socket.send(JSON.stringify({
    type: 'peer-list',
    peers: peerList,
    timestamp: Date.now()
  }));

  // Handle messages from the client
  socket.onmessage = async (event) => {
    let message: SignalingMessage;
    
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      console.error('Invalid message format:', e);
      return;
    }

    // Update room last active timestamp
    room.lastActive = Date.now();
    await createOrUpdateRoom(supabase, roomId);
    
    // Handle message based on type
    switch (message.type) {
      case 'heartbeat':
        // Update participant activity status
        await updateParticipantStatus(supabase, roomId, peerId, true);
        socket.send(JSON.stringify({ 
          type: 'heartbeat-ack',
          timestamp: Date.now()
        }));
        break;

      // FASE A: Protocolo WebRTC Padronizado
      case 'webrtc-offer':
        if (message.targetUserId && room.connections.has(message.targetUserId)) {
          const targetConnection = room.connections.get(message.targetUserId);
          if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
            const forwardedMessage = {
              type: 'webrtc-offer',
              roomId: message.roomId,
              fromUserId: message.fromUserId || peerId,
              targetUserId: message.targetUserId,
              offer: message.offer,
              timestamp: message.timestamp || Date.now()
            };
            console.log(`📞 [SERVER] Forwarding webrtc-offer: ${peerId} → ${message.targetUserId}`);
            targetConnection.send(JSON.stringify(forwardedMessage));
          }
        }
        break;

      case 'webrtc-answer':
        if (message.targetUserId && room.connections.has(message.targetUserId)) {
          const targetConnection = room.connections.get(message.targetUserId);
          if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
            const forwardedMessage = {
              type: 'webrtc-answer',
              roomId: message.roomId,
              fromUserId: message.fromUserId || peerId,
              targetUserId: message.targetUserId,
              answer: message.answer,
              timestamp: message.timestamp || Date.now()
            };
            console.log(`✅ [SERVER] Forwarding webrtc-answer: ${peerId} → ${message.targetUserId}`);
            targetConnection.send(JSON.stringify(forwardedMessage));
          }
        }
        break;

      case 'webrtc-candidate':
        if (message.targetUserId && room.connections.has(message.targetUserId)) {
          const targetConnection = room.connections.get(message.targetUserId);
          if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
            const forwardedMessage = {
              type: 'webrtc-candidate',
              roomId: message.roomId,
              fromUserId: message.fromUserId || peerId,
              targetUserId: message.targetUserId,
              candidate: message.candidate,
              timestamp: message.timestamp || Date.now()
            };
            console.log(`🧊 [SERVER] Forwarding webrtc-candidate: ${peerId} → ${message.targetUserId}`);
            targetConnection.send(JSON.stringify(forwardedMessage));
          }
        }
        break;

      // FASE F: Solicitação de offer
      case 'request-offer':
        if (message.targetUserId && room.connections.has(message.targetUserId)) {
          const targetConnection = room.connections.get(message.targetUserId);
          if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
            const forwardedMessage = {
              type: 'request-offer',
              roomId: message.roomId,
              fromUserId: message.fromUserId || peerId,
              targetUserId: message.targetUserId,
              timestamp: message.timestamp || Date.now()
            };
            console.log(`🚀 [SERVER] Forwarding request-offer: ${peerId} → ${message.targetUserId}`);
            targetConnection.send(JSON.stringify(forwardedMessage));
          }
        }
        break;
        
      case 'offer':
      case 'answer':
      case 'candidate':
        // Forward signaling messages to the target peer (legacy support)
        if (message.targetId && room.connections.has(message.targetId)) {
          const targetConnection = room.connections.get(message.targetId);
          if (targetConnection && targetConnection.readyState === WebSocket.OPEN) {
            // Add sender ID if not present
            if (!message.senderId) {
              message.senderId = peerId;
            }
            // Add timestamp if not present
            if (!message.timestamp) {
              message.timestamp = Date.now();
            }
            targetConnection.send(JSON.stringify(message));
          }
        }
        break;
        
      case 'broadcast':
        // Broadcast a message to all peers in the room
        room.connections.forEach((conn, id) => {
          if (id !== peerId && conn.readyState === WebSocket.OPEN) {
            conn.send(JSON.stringify({
              ...message,
              senderId: peerId,
              timestamp: Date.now()
            }));
          }
        });
        break;
        
      default:
        console.log(`Received unknown message type: ${message.type}`);
    }
  };

  // Handle connection close
  socket.onclose = async () => {
    // Remove the connection from the room
    room.connections.delete(peerId);
    console.log(`Participant ${peerId} left room ${roomId}`);
    
    // Update participant status in database
    await updateParticipantStatus(supabase, roomId, peerId, false);
    
    // Update room participant count
    await supabase
      .from('signaling_rooms')
      .update({ 
        participant_count: room.connections.size,
        last_active: new Date().toISOString()
      })
      .eq('room_id', roomId);
    
    // Notify other peers that this peer has left
    room.connections.forEach((conn) => {
      if (conn.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify({
          type: 'user-left',
          peerId: peerId,
          timestamp: Date.now()
        }));
      }
    });
    
    // Remove room if empty
    if (room.connections.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} is now empty and will be removed`);
    }
  };

  // Handle errors
  socket.onerror = (error) => {
    console.error(`WebSocket error for peer ${peerId} in room ${roomId}:`, error);
  };

  return response;
});
