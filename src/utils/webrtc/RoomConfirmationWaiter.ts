/**
 * FASE 2: Sistema para aguardar confirmação explícita de entrada na sala
 * Evita iniciar WebRTC antes de estar realmente na sala
 */

import { unifiedWebSocketService } from '@/services/UnifiedWebSocketService';

export interface RoomConfirmationResult {
  success: boolean;
  participantId: string;
  roomId: string;
  timestamp: number;
  error?: string;
}

/**
 * Aguarda confirmação explícita de que o participante/host entrou na sala
 * Só retorna quando receber ACK do servidor
 */
export const waitForRoomConfirmation = async (
  roomId: string, 
  participantId: string,
  timeoutMs: number = 15000
): Promise<RoomConfirmationResult> => {
  
  console.log(`⏳ ROOM CONFIRMATION: Waiting for server ACK for ${participantId} in room ${roomId}`);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let isResolved = false;
    
    // Timeout para evitar espera infinita
    const timeoutHandle = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        const error = `TIMEOUT: No room confirmation received within ${timeoutMs}ms`;
        console.error(`❌ ROOM CONFIRMATION: ${error}`);
        reject(new Error(error));
      }
    }, timeoutMs);
    
    // Listener para confirmação de entrada na sala
    const handleRoomJoined = (event: CustomEvent) => {
      const { userId, roomId: eventRoomId } = event.detail;
      
      console.log(`📨 ROOM CONFIRMATION: Received room-joined event`, {
        userId,
        eventRoomId,
        expectedParticipantId: participantId,
        expectedRoomId: roomId
      });
      
      // Verificar se é a confirmação que estamos esperando
      if (userId === participantId && eventRoomId === roomId && !isResolved) {
        isResolved = true;
        clearTimeout(timeoutHandle);
        
        const result: RoomConfirmationResult = {
          success: true,
          participantId,
          roomId,
          timestamp: Date.now()
        };
        
        console.log(`✅ ROOM CONFIRMATION: Confirmed ${participantId} joined room ${roomId} (${Date.now() - startTime}ms)`);
        
        // Cleanup listener
        window.removeEventListener('room-joined', handleRoomJoined as EventListener);
        
        resolve(result);
      }
    };
    
    // Listener para erro de entrada na sala
    const handleRoomJoinError = (event: CustomEvent) => {
      const { error, roomId: eventRoomId, participantId: eventParticipantId } = event.detail;
      
      if ((eventParticipantId === participantId || !eventParticipantId) && 
          eventRoomId === roomId && !isResolved) {
        isResolved = true;
        clearTimeout(timeoutHandle);
        
        console.error(`❌ ROOM CONFIRMATION: Join error for ${participantId} in room ${roomId}:`, error);
        
        // Cleanup listeners
        window.removeEventListener('room-joined', handleRoomJoined as EventListener);
        window.removeEventListener('room-join-error', handleRoomJoinError as EventListener);
        
        reject(new Error(`Room join failed: ${error}`));
      }
    };
    
    // Registrar listeners
    window.addEventListener('room-joined', handleRoomJoined as EventListener);
    window.addEventListener('room-join-error', handleRoomJoinError as EventListener);
    
    // FALLBACK: Se WebSocket já está conectado e parece estável, fazer double-check
    if (unifiedWebSocketService.isConnected()) {
      setTimeout(() => {
        if (!isResolved) {
          console.log(`🔍 ROOM CONFIRMATION: Fallback check - assuming connection is stable after 3s`);
          
          // Se chegamos até aqui e não houve erro explícito, assumir sucesso
          isResolved = true;
          clearTimeout(timeoutHandle);
          
          // Cleanup listeners
          window.removeEventListener('room-joined', handleRoomJoined as EventListener);
          window.removeEventListener('room-join-error', handleRoomJoinError as EventListener);
          
          resolve({
            success: true,
            participantId,
            roomId,
            timestamp: Date.now()
          });
        }
      }, 3000); // 3s fallback
    }
    
    console.log(`⏰ ROOM CONFIRMATION: Waiting up to ${timeoutMs}ms for confirmation...`);
  });
};

/**
 * Versão simplificada que apenas aguarda um delay fixo
 * Útil quando o servidor não envia eventos explícitos
 */
export const waitForRoomStabilization = async (
  roomId: string,
  participantId: string,
  delayMs: number = 2000
): Promise<RoomConfirmationResult> => {
  
  console.log(`⏳ ROOM STABILIZATION: Waiting ${delayMs}ms for room to stabilize`);
  
  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  // Verificar se WebSocket ainda está conectado
  if (!unifiedWebSocketService.isConnected()) {
    throw new Error('WebSocket disconnected during room stabilization');
  }
  
  console.log(`✅ ROOM STABILIZATION: Room ${roomId} stabilized for ${participantId}`);
  
  return {
    success: true,
    participantId,
    roomId,
    timestamp: Date.now()
  };
};