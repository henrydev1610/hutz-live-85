/**
 * Centralized participant ID generation with robust fallbacks
 * Ensures unique, valid participant IDs for WebRTC connections
 */

export const generateParticipantId = (prefix: string = 'participant'): string => {
  // Try crypto.randomUUID() first (modern browsers)
  if (crypto && crypto.randomUUID) {
    const uuid = crypto.randomUUID();
    return `${prefix}-${uuid}`;
  }
  
  // Fallback to timestamp + random string
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${randomString}`;
};

export const generateHostId = (): string => {
  return generateParticipantId('host');
};

export const validateParticipantId = (participantId: string): boolean => {
  if (!participantId || typeof participantId !== 'string') {
    console.error('❌ VALIDATION: Invalid participantId - not a string');
    return false;
  }
  
  if (participantId.trim() === '') {
    console.error('❌ VALIDATION: Invalid participantId - empty string');
    return false;
  }
  
  if (participantId === 'undefined' || participantId === 'null') {
    console.error('❌ VALIDATION: Invalid participantId - undefined/null string');
    return false;
  }
  
  // Must have a prefix and some content after it
  if (!participantId.includes('-') || participantId.split('-').length < 2) {
    console.error('❌ VALIDATION: Invalid participantId - missing proper format');
    return false;
  }
  
  console.log('✅ VALIDATION: ParticipantId is valid:', participantId);
  return true;
};

export const sanitizeParticipantId = (participantId: string | undefined | null): string => {
  if (!participantId || !validateParticipantId(participantId)) {
    console.warn('⚠️ SANITIZE: Invalid participantId, generating new one');
    return generateParticipantId();
  }
  
  return participantId;
};