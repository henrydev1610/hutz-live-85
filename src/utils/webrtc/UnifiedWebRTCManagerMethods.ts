/**
 * FASE 2: Métodos adicionais para UnifiedWebRTCManager
 * Implementação do waitForRoomConfirmation como método da classe
 */

import { waitForRoomConfirmation as externalWaitForRoomConfirmation } from './RoomConfirmationWaiter';

declare module './UnifiedWebRTCManager' {
  interface UnifiedWebRTCManager {
    waitForRoomConfirmation(roomId: string, participantId: string): Promise<any>;
  }
}

// Implementação do método waitForRoomConfirmation para a classe UnifiedWebRTCManager
export const waitForRoomConfirmationMethod = function(
  this: any,
  roomId: string, 
  participantId: string
) {
  return externalWaitForRoomConfirmation(roomId, participantId);
};