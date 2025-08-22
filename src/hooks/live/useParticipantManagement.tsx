// Minimal stub for backwards compatibility
import { useState } from 'react';

export const useParticipantManagement = (props: any) => {
  console.log('⚠️ DEPRECATED: useParticipantManagement - Use Twilio Video Rooms instead');
  
  return {
    handleParticipantJoin: () => {},
    handleParticipantStream: () => {},
    transferStreamToTransmission: () => {},
    debugParticipantManagement: () => {}
  };
};