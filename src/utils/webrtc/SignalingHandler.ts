
import unifiedWebSocketService from '@/services/UnifiedWebSocketService';
import { ConnectionHandler } from './ConnectionHandler';

export class SignalingHandler {
  private peerConnections: Map<string, RTCPeerConnection>;
  private participants: Map<string, any>;
  private connectionHandler: ConnectionHandler | null = null;

  constructor(
    peerConnections: Map<string, RTCPeerConnection>,
    participants: Map<string, any>
  ) {
    this.peerConnections = peerConnections;
    this.participants = participants;
  }

  setConnectionHandler(connectionHandler: ConnectionHandler) {
    this.connectionHandler = connectionHandler;
  }

  async handleOffer(data: any) {
    console.log('📤 HANDSHAKE DEFINITIVO: SignalingHandler handling offer from:', data.fromUserId || data.fromSocketId || data.from);
    
    const participantId = data.fromUserId || data.fromSocketId || data.from;
    const offer = data.offer;
    
    if (!participantId || !offer) {
      console.error('❌ HANDSHAKE DEFINITIVO: Invalid offer data:', data);
      return;
    }
    
    try {
      // CORREÇÃO CRÍTICA: Usar ConnectionHandler diretamente se disponível
      if (this.connectionHandler) {
        console.log('🚀 HANDSHAKE DEFINITIVO: Using ConnectionHandler to process offer');
        await this.connectionHandler.handleOffer(participantId, offer);
        console.log(`✅ HANDSHAKE DEFINITIVO: Offer processed successfully via ConnectionHandler for: ${participantId}`);
      } else {
        console.log('🔄 HANDSHAKE DEFINITIVO: Using basic peer connection fallback');
        
        // Use connection handler if available, otherwise create directly
        const peerConnection = this.createBasicPeerConnection(participantId);
        
        console.log(`📝 HANDSHAKE DEFINITIVO: Setting remote description for: ${participantId}`);
        await peerConnection.setRemoteDescription(offer);
        
        console.log(`📋 HANDSHAKE DEFINITIVO: Creating answer for: ${participantId}`);
        const answer = await peerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        console.log(`📝 HANDSHAKE DEFINITIVO: Setting local description for: ${participantId}`);
        await peerConnection.setLocalDescription(answer);
        
        console.log(`📤 HANDSHAKE DEFINITIVO: Sending answer to: ${participantId}`);
        unifiedWebSocketService.sendAnswer(participantId, answer);
        console.log('✅ HANDSHAKE DEFINITIVO: Answer sent successfully to:', participantId);
      }
      
      // VISUAL LOG: Toast para offer processado com sucesso
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('offer-processed-successfully', {
          detail: { participantId }
        }));
      }
      
    } catch (error) {
      console.error('❌ HANDSHAKE DEFINITIVO: Failed to handle offer:', error);
      
      // VISUAL LOG: Toast para erro no processamento da offer
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('handshake-error', {
          detail: { participantId, error: error.message, phase: 'SignalingHandler-handleOffer' }
        }));
      }
    }
  }

  async handleAnswer(data: any) {
    console.log('📥 HANDSHAKE DEFINITIVO: SignalingHandler handling answer from:', data.fromUserId || data.fromSocketId || data.from);
    
    const participantId = data.fromUserId || data.fromSocketId || data.from;
    const answer = data.answer;
    
    if (!participantId || !answer) {
      console.error('❌ HANDSHAKE DEFINITIVO: Invalid answer data:', data);
      return;
    }
    
    try {
      // CORREÇÃO CRÍTICA: Usar ConnectionHandler diretamente se disponível
      if (this.connectionHandler) {
        console.log('🚀 HANDSHAKE DEFINITIVO: Using ConnectionHandler to process answer');
        await this.connectionHandler.handleAnswer(participantId, answer);
        console.log(`✅ HANDSHAKE DEFINITIVO: Answer processed successfully via ConnectionHandler for: ${participantId}`);
      } else {
        console.log('🔄 HANDSHAKE DEFINITIVO: Using basic peer connection fallback');
        
        const peerConnection = this.peerConnections.get(participantId);
        
        if (peerConnection) {
          console.log(`📝 HANDSHAKE DEFINITIVO: Setting remote description from answer for: ${participantId}`);
          await peerConnection.setRemoteDescription(answer);
          console.log('✅ HANDSHAKE DEFINITIVO: Answer processed successfully for:', participantId);
        } else {
          console.error(`❌ HANDSHAKE DEFINITIVO: No peer connection found for answer from: ${participantId}`);
        }
      }
      
      // VISUAL LOG: Toast para answer processado com sucesso
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('answer-processed-successfully', {
          detail: { participantId }
        }));
      }
      
    } catch (error) {
      console.error('❌ HANDSHAKE DEFINITIVO: Failed to handle answer:', error);
      
      // VISUAL LOG: Toast para erro no processamento da answer
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('handshake-error', {
          detail: { participantId, error: error.message, phase: 'SignalingHandler-handleAnswer' }
        }));
      }
    }
  }

  async handleIceCandidate(data: any) {
    console.log('🧊 HANDSHAKE DEFINITIVO: SignalingHandler handling ICE candidate from:', data.fromUserId || data.fromSocketId || data.from);
    
    const participantId = data.fromUserId || data.fromSocketId || data.from;
    const candidate = data.candidate;
    
    if (!participantId || !candidate) {
      console.error('❌ HANDSHAKE DEFINITIVO: Invalid ICE candidate data:', data);
      return;
    }
    
    try {
      // CORREÇÃO CRÍTICA: Usar ConnectionHandler diretamente se disponível
      if (this.connectionHandler) {
        console.log('🚀 HANDSHAKE DEFINITIVO: Using ConnectionHandler to process ICE candidate');
        await this.connectionHandler.handleIceCandidate(participantId, candidate);
        console.log(`✅ HANDSHAKE DEFINITIVO: ICE candidate processed successfully via ConnectionHandler for: ${participantId}`);
      } else {
        console.log('🔄 HANDSHAKE DEFINITIVO: Using basic peer connection fallback');
        
        const peerConnection = this.peerConnections.get(participantId);
        
        if (peerConnection) {
          console.log(`🧊 HANDSHAKE DEFINITIVO: Adding ICE candidate for: ${participantId}`);
          await peerConnection.addIceCandidate(candidate);
          console.log('✅ HANDSHAKE DEFINITIVO: ICE candidate added successfully for:', participantId);
        } else {
          console.error(`❌ HANDSHAKE DEFINITIVO: No peer connection found for ICE candidate from: ${participantId}`);
        }
      }
    } catch (error) {
      console.error('❌ HANDSHAKE DEFINITIVO: Failed to add ICE candidate:', error);
      
      // VISUAL LOG: Toast para erro no processamento do ICE candidate
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('ice-candidate-error', {
          detail: { participantId, error: error.message }
        }));
      }
    }
  }

  private createBasicPeerConnection(participantId: string): RTCPeerConnection {
    // Verificar se já existe conexão para este participante
    if (this.peerConnections.has(participantId)) {
      console.log(`♻️ Reusing existing basic peer connection for: ${participantId}`);
      return this.peerConnections.get(participantId)!;
    }

    // Criar nome único para o relay baseado na sessão e timestamp
    const uniqueId = `relay-basic-${participantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    console.log(`🔧 Creating basic WebRTC connection with unique ID: ${uniqueId}`);
    const peerConnection = new RTCPeerConnection(config);
    
    // Adicionar propriedade única para debug
    (peerConnection as any).__uniqueId = uniqueId;
    
    this.peerConnections.set(participantId, peerConnection);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Sending ICE candidate to:', participantId);
        unifiedWebSocketService.sendIceCandidate(participantId, event.candidate);
      }
    };
    
    return peerConnection;
  }
}
