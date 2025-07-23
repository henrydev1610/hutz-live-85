import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenRequest {
  identity: string;
  roomName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { identity, roomName }: TokenRequest = await req.json()

    if (!identity || !roomName) {
      return new Response(
        JSON.stringify({ error: 'Identity and roomName are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get Twilio credentials from Supabase secrets
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY')  
    const TWILIO_API_SECRET = Deno.env.get('TWILIO_API_SECRET')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
      console.error('Missing Twilio credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing Twilio credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Twilio JWT token
    const now = Math.floor(Date.now() / 1000)
    const exp = now + (60 * 60) // 1 hour expiration

    // JWT Header
    const header = {
      typ: 'JWT',
      alg: 'HS256',
      cty: 'twilio-fpa;v=1'
    }

    // JWT Payload  
    const payload = {
      iss: TWILIO_API_KEY,
      sub: TWILIO_ACCOUNT_SID,
      nbf: now,
      exp: exp,
      jti: `${TWILIO_API_KEY}-${now}`,
      grants: {
        identity: identity,
        video: {
          room: roomName
        }
      }
    }

    // Create JWT manually since we're in Deno
    const encoder = new TextEncoder()
    
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    
    const signingInput = `${encodedHeader}.${encodedPayload}`
    
    // Create HMAC signature
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(TWILIO_API_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput))
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    
    const token = `${signingInput}.${encodedSignature}`

    console.log(`✅ Generated token for identity: ${identity}, room: ${roomName}`)

    return new Response(
      JSON.stringify({ token }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error generating Twilio token:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})