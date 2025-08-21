import { twilioWebRTCService } from '../../services/TwilioWebRTCService';
import { getBackendBaseURL } from '@/utils/connectionUtils';

// MIGRAÇÃO 100% TWILIO - Forçando uso exclusivo da Twilio
let dynamicIceServers: RTCIceServer[] | null = null;
let relayOnly = false;
let forceTwilioOnly = true; // 🎯 MIGRAÇÃO: Forçar APENAS Twilio

// Configuração STUN-only para emergência (sem TURN do Metered.ca)
const STUN_ONLY_FALLBACK: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free) - apenas para emergência
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Cloudflare STUN (backup)  
    { urls: 'stun:stun.cloudflare.com:3478' }
    // 🚫 REMOVIDO: Metered.ca TURN servers (migração 100% Twilio)
  ],
  iceCandidatePoolSize: 10
};

// Chame isso ao receber `ice-servers` do backend
export function setDynamicIceServers(servers: RTCIceServer[], opts?: { relayOnly?: boolean }) {
  if (Array.isArray(servers) && servers.length) {
    dynamicIceServers = servers;
    console.log('🧊 [WRTC] ICE servers dinâmicos aplicados:',
      servers.map(s => ({ urls: s.urls, username: (s as any).username, hasCredential: !!(s as any).credential }))
    );
  } else {
    console.warn('🧊 [WRTC] ICE servers inválidos recebidos; mantendo fallback');
    dynamicIceServers = null;
  }
  if (typeof opts?.relayOnly === 'boolean') relayOnly = !!opts.relayOnly;
}

// 🎯 MIGRAÇÃO 100% TWILIO - Configuração exclusiva
export async function getWebRTCConfig(): Promise<RTCConfiguration> {
  console.log('🌐 TWILIO-ONLY: Starting WebRTC config initialization...');
  
  let iceServers: RTCIceServer[] = [];
  let usingTwilio = false;

  // 🎯 FASE 1: TENTAR TWILIO (OBRIGATÓRIO)
  if (forceTwilioOnly) {
    try {
      console.log('🌐 TWILIO: Fetching ICE servers (100% migration mode)...');
      
      // Verificar se Twilio está inicializado
      if (!twilioWebRTCService.isTwilioEnabled()) {
        console.warn('⚠️ TWILIO: Service not initialized, enabling Twilio...');
        twilioWebRTCService.enableTwilio(true);
      }
      
      iceServers = await twilioWebRTCService.getIceServers();
      
      if (iceServers && iceServers.length > 0) {
        console.log('✅ TWILIO: Successfully retrieved ICE servers:', iceServers.length);
        usingTwilio = true;
      }
    } catch (error) {
      console.error('🚨 TWILIO: Failed to get ICE servers:', error);
    }
  }

  // 🚨 EMERGÊNCIA: Se Twilio falhar completamente, usar apenas STUN
  if (!usingTwilio) {
    console.warn('🚨 FALLBACK: Twilio unavailable, using STUN-only mode');
    iceServers = STUN_ONLY_FALLBACK.iceServers;
  }

  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: usingTwilio ? 15 : 5, // Maior pool para Twilio
  };
  
  if (relayOnly) cfg.iceTransportPolicy = 'relay';
  
  console.log(`🎯 WEBRTC CONFIG: ${usingTwilio ? 'Twilio' : 'STUN-only'} | Servers: ${iceServers.length}`);
  return cfg;
}

// Alias para compatibilidade (agora async)
export async function getActiveWebRTCConfig(): Promise<RTCConfiguration> {
  return await getWebRTCConfig();
}

// Controles de feature flag
export function setTwilioPreference(enabled: boolean) {
  forceTwilioOnly = enabled;
  twilioWebRTCService.enableTwilio(enabled);
  console.log(`🎛️ Twilio preference: ${enabled ? 'ON' : 'OFF'}`);
}

export function getTwilioPreference(): boolean {
  return forceTwilioOnly && twilioWebRTCService.isTwilioEnabled();
}

// Caso queira forçar relay em algum cenário específico (ex.: ambiente Lovable)
export function useRelayOnly(enable = true) {
  relayOnly = enable;
}

// Para fluxos que exigem obrigatoriamente TURN (NAT extremo) - Simplificado para Twilio
export async function getTurnOnlyConfig(): Promise<RTCConfiguration> {
  console.log('🎯 TURN-ONLY: Using Twilio for relay-only configuration...');
  
  // Tentar buscar do Twilio
  try {
    const iceServers = await twilioWebRTCService.getIceServers();
    if (iceServers && iceServers.length > 0) {
      return {
        iceServers,
        iceTransportPolicy: 'relay',
        iceCandidatePoolSize: 10,
      };
    }
  } catch (error) {
    console.warn('⚠️ TWILIO TURN failed, using STUN fallback:', error);
  }

  // Fallback: apenas STUN (sem TURN)
  return {
    iceServers: STUN_ONLY_FALLBACK.iceServers,
    iceTransportPolicy: 'relay',
    iceCandidatePoolSize: 5,
  };
}

// Mantém os constraints no mesmo arquivo (sem alterações)
export const MEDIA_CONSTRAINTS = {
  video: { facingMode: 'user' },
  audio: true
};

  // Debug commands para migração 100% Twilio
  if (typeof window !== 'undefined') {
    (window as any).__webrtcCfg = async () => await getWebRTCConfig();
    (window as any).__twilioToggle = (enabled: boolean) => setTwilioPreference(enabled);
    (window as any).__twilioStatus = () => twilioWebRTCService.getServiceStats();
    (window as any).__twilioTest = async () => {
      console.log('🧪 TESTING Twilio migration...');
      const config = await getWebRTCConfig();
      const stats = twilioWebRTCService.getServiceStats();
      const diagnostic = await twilioWebRTCService.runConnectivityDiagnostic();
      
      return {
        webrtcConfig: config,
        twilioStats: stats,
        connectivityDiagnostic: diagnostic,
        migrationMode: forceTwilioOnly
      };
    };
    (window as any).__forceTwilioRefresh = async () => {
      console.log('🔄 Forcing Twilio cache refresh...');
      await twilioWebRTCService.refreshCache();
      return await twilioWebRTCService.getServiceStats();
    };
    (window as any).__twilioCredentialTest = async () => {
      console.log('🧪 TESTING Twilio credentials via backend...');
      try {
        const response = await fetch(`${getBackendBaseURL()}/api/twilio-test/credentials`);
        const data = await response.json();
        
        console.log('📋 CREDENTIAL TEST REPORT:', data.report);
        return data.report;
      } catch (error) {
        console.error('❌ Credential test failed:', error);
        return { error: error.message };
      }
    };
    (window as any).__twilioReset = async () => {
      console.log('🔄 Resetting Twilio service...');
      try {
        const response = await fetch(`${getBackendBaseURL()}/api/twilio-test/reset`, { method: 'POST' });
        const data = await response.json();
        
        console.log('🔄 Reset result:', data);
        
        // Também resetar o frontend
        await twilioWebRTCService.refreshCache();
        
        return data;
      } catch (error) {
        console.error('❌ Reset failed:', error);
        return { error: error.message };
      }
    };
  }