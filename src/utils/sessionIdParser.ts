/**
 * Utilitário robusto para extração e validação de sessionId
 */

export interface SessionIdValidation {
  isValid: boolean;
  sessionId: string | null;
  errorType?: 'empty' | 'invalid_format' | 'too_short' | 'too_long' | 'invalid_chars';
  rawValue?: string;
  cleanedValue?: string;
}

/**
 * Extrai sessionId da URL removendo query parameters e validando formato
 */
export const extractSessionId = (rawSessionId: string | undefined): SessionIdValidation => {
  console.log('🔍 SESSION ID EXTRACTION: Starting validation');
  console.log(`📝 Raw SessionId: "${rawSessionId}"`);
  
  // Verificar se existe
  if (!rawSessionId) {
    console.log('❌ SESSION ID: Empty or undefined');
    return {
      isValid: false,
      sessionId: null,
      errorType: 'empty',
      rawValue: rawSessionId
    };
  }

  // Limpar query parameters e outros caracteres problemáticos
  let cleanedSessionId = rawSessionId;
  
  // Remover query parameters (tudo após ?)
  if (cleanedSessionId.includes('?')) {
    cleanedSessionId = cleanedSessionId.split('?')[0];
    console.log(`🧹 SESSION ID: Removed query params: "${rawSessionId}" → "${cleanedSessionId}"`);
  }
  
  // Remover hash parameters (tudo após #)
  if (cleanedSessionId.includes('#')) {
    cleanedSessionId = cleanedSessionId.split('#')[0];
    console.log(`🧹 SESSION ID: Removed hash params: "${cleanedSessionId}"`);
  }
  
  // Trim espaços e caracteres especiais
  cleanedSessionId = cleanedSessionId.trim();
  
  // Validar se não está vazio após limpeza
  if (!cleanedSessionId) {
    console.log('❌ SESSION ID: Empty after cleaning');
    return {
      isValid: false,
      sessionId: null,
      errorType: 'empty',
      rawValue: rawSessionId,
      cleanedValue: cleanedSessionId
    };
  }
  
  // Validar tamanho (sessionId deve ter entre 5 e 50 caracteres)
  if (cleanedSessionId.length < 5) {
    console.log(`❌ SESSION ID: Too short (${cleanedSessionId.length} chars): "${cleanedSessionId}"`);
    return {
      isValid: false,
      sessionId: null,
      errorType: 'too_short',
      rawValue: rawSessionId,
      cleanedValue: cleanedSessionId
    };
  }
  
  if (cleanedSessionId.length > 50) {
    console.log(`❌ SESSION ID: Too long (${cleanedSessionId.length} chars): "${cleanedSessionId}"`);
    return {
      isValid: false,
      sessionId: null,
      errorType: 'too_long',
      rawValue: rawSessionId,
      cleanedValue: cleanedSessionId
    };
  }
  
  // Validar formato (alfanumérico + hífen + underscore)
  const validFormat = /^[a-zA-Z0-9\-_]+$/.test(cleanedSessionId);
  if (!validFormat) {
    console.log(`❌ SESSION ID: Invalid format: "${cleanedSessionId}"`);
    return {
      isValid: false,
      sessionId: null,
      errorType: 'invalid_chars',
      rawValue: rawSessionId,
      cleanedValue: cleanedSessionId
    };
  }
  
  console.log(`✅ SESSION ID: Valid - "${cleanedSessionId}"`);
  return {
    isValid: true,
    sessionId: cleanedSessionId,
    rawValue: rawSessionId,
    cleanedValue: cleanedSessionId
  };
};

/**
 * Gera mensagem de erro amigável baseada no tipo de erro
 */
export const getSessionIdErrorMessage = (validation: SessionIdValidation): string => {
  if (validation.isValid) return '';
  
  switch (validation.errorType) {
    case 'empty':
      return 'ID da sessão não foi fornecido na URL';
    case 'too_short':
      return 'ID da sessão é muito curto (mínimo 5 caracteres)';
    case 'too_long':
      return 'ID da sessão é muito longo (máximo 50 caracteres)';
    case 'invalid_chars':
      return 'ID da sessão contém caracteres inválidos (apenas letras, números, - e _ são permitidos)';
    case 'invalid_format':
      return 'Formato do ID da sessão é inválido';
    default:
      return 'ID da sessão é inválido';
  }
};

/**
 * Debug information para troubleshooting
 */
export const getSessionIdDebugInfo = (validation: SessionIdValidation): string => {
  return `
🔍 SESSION ID DEBUG:
📝 Raw Value: "${validation.rawValue}"
🧹 Cleaned Value: "${validation.cleanedValue}"
✅ Valid: ${validation.isValid}
❌ Error Type: ${validation.errorType || 'none'}
📏 Length: ${validation.cleanedValue?.length || 0}
🔤 Characters: ${validation.cleanedValue?.split('').join(', ') || 'none'}
  `.trim();
};