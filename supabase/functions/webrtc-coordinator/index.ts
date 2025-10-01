import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParticipantInfo {
  id: string;
  sessionId: string;
  joinedAt: number;
  lastSeen: number;
  streamInfo?: {
    hasVideo: boolean;
    hasAudio: boolean;
    streamId: string;
  };
}

// In-memory storage for active sessions and participants
const activeSessions = new Map<string, Set<string>>();
const participants = new Map<string, ParticipantInfo>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { action, sessionId, participantId, data } = await req.json();

    console.log(`📡 [COORDINATOR] Action: ${action}, Session: ${sessionId}, Participant: ${participantId}`);

    switch (action) {
      case 'join-session':
        return handleJoinSession(sessionId, participantId, data);
      
      case 'leave-session':
        return handleLeaveSession(sessionId, participantId);
      
      case 'update-stream':
        return handleUpdateStream(sessionId, participantId, data);
      
      case 'get-session-info':
        return handleGetSessionInfo(sessionId);
      
      case 'heartbeat':
        return handleHeartbeat(sessionId, participantId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('❌ [COORDINATOR] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function handleJoinSession(sessionId: string, participantId: string, data: any) {
  console.log(`✅ [COORDINATOR] Participant ${participantId} joining session ${sessionId}`);
  
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, new Set());
  }
  
  activeSessions.get(sessionId)!.add(participantId);
  
  const participantInfo: ParticipantInfo = {
    id: participantId,
    sessionId,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    streamInfo: data?.streamInfo
  };
  
  participants.set(participantId, participantInfo);
  
  const sessionParticipants = Array.from(activeSessions.get(sessionId)!);
  
  return new Response(
    JSON.stringify({
      success: true,
      participantId,
      sessionId,
      participants: sessionParticipants
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function handleLeaveSession(sessionId: string, participantId: string) {
  console.log(`👋 [COORDINATOR] Participant ${participantId} leaving session ${sessionId}`);
  
  const session = activeSessions.get(sessionId);
  if (session) {
    session.delete(participantId);
    if (session.size === 0) {
      activeSessions.delete(sessionId);
    }
  }
  
  participants.delete(participantId);
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function handleUpdateStream(sessionId: string, participantId: string, streamInfo: any) {
  console.log(`🎥 [COORDINATOR] Stream update for ${participantId}`);
  
  const participant = participants.get(participantId);
  if (participant) {
    participant.streamInfo = streamInfo;
    participant.lastSeen = Date.now();
  }
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function handleGetSessionInfo(sessionId: string) {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return new Response(
      JSON.stringify({ participants: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const sessionParticipants = Array.from(session).map(id => participants.get(id)).filter(Boolean);
  
  return new Response(
    JSON.stringify({
      sessionId,
      participants: sessionParticipants,
      count: sessionParticipants.length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function handleHeartbeat(sessionId: string, participantId: string) {
  const participant = participants.get(participantId);
  if (participant) {
    participant.lastSeen = Date.now();
  }
  
  return new Response(
    JSON.stringify({ success: true, timestamp: Date.now() }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Cleanup stale participants every 30 seconds
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 60000; // 60 seconds
  
  for (const [participantId, info] of participants.entries()) {
    if (now - info.lastSeen > staleThreshold) {
      console.log(`🧹 [COORDINATOR] Cleaning up stale participant: ${participantId}`);
      handleLeaveSession(info.sessionId, participantId);
    }
  }
}, 30000);
