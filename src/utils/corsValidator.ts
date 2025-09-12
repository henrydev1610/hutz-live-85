/**
 * CORS Validation Utility - Critical URL and CORS Fix
 */

export interface CORSValidationResult {
  isValid: boolean;
  currentOrigin: string;
  backendUrl: string;
  errors: string[];
  suggestions: string[];
}

/**
 * Validate CORS configuration between frontend and backend
 */
export const validateCORSConnection = async (backendUrl: string): Promise<CORSValidationResult> => {
  const currentOrigin = window.location.origin;
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  console.log(`🔍 CORS VALIDATION: Testing connection from ${currentOrigin} to ${backendUrl}`);
  
  try {
    // Test basic connectivity
    const response = await fetch(`${backendUrl}/api/test`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      errors.push(`Backend not responding: ${response.status} ${response.statusText}`);
      suggestions.push('Verify backend is running and accessible');
    }
    
    // Check CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
    };
    
    console.log(`📋 CORS HEADERS:`, corsHeaders);
    
    const allowOrigin = corsHeaders['Access-Control-Allow-Origin'];
    if (allowOrigin !== '*' && allowOrigin !== currentOrigin) {
      errors.push(`CORS origin mismatch: Backend allows "${allowOrigin}", current origin is "${currentOrigin}"`);
      suggestions.push(`Add "${currentOrigin}" to ALLOWED_ORIGINS in server/.env`);
    }
    
  } catch (error) {
    console.error('🚨 CORS VALIDATION ERROR:', error);
    errors.push(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error && error.message.includes('CORS')) {
      suggestions.push('CORS configuration error - check server ALLOWED_ORIGINS');
    }
    
    if (error instanceof Error && error.message.includes('NetworkError')) {
      suggestions.push('Network error - check if backend URL is correct');
    }
  }
  
  const isValid = errors.length === 0;
  
  console.log(`${isValid ? '✅' : '❌'} CORS VALIDATION RESULT:`, {
    isValid,
    currentOrigin,
    backendUrl,
    errorCount: errors.length
  });
  
  return {
    isValid,
    currentOrigin,
    backendUrl,
    errors,
    suggestions
  };
};

/**
 * Quick CORS health check
 */
export const quickCORSCheck = async (backendUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${backendUrl}/status`, { 
      method: 'HEAD',
      mode: 'cors',
      credentials: 'omit'
    });
    
    const success = response.ok;
    console.log(`${success ? '✅' : '❌'} CORS QUICK CHECK: ${backendUrl} - ${success ? 'OK' : 'FAILED'}`);
    return success;
  } catch (error) {
    console.log(`❌ CORS QUICK CHECK: ${backendUrl} - FAILED`, error);
    return false;
  }
};

/**
 * Auto-fix CORS suggestions for common issues
 */
export const generateCORSFix = (validationResult: CORSValidationResult): string[] => {
  const fixes: string[] = [];
  
  if (!validationResult.isValid) {
    fixes.push('# Add to server/.env ALLOWED_ORIGINS:');
    fixes.push(`${validationResult.currentOrigin}`);
    
    // Add common Lovable patterns
    if (validationResult.currentOrigin.includes('lovable.app')) {
      fixes.push('*.lovable.app');
    }
    if (validationResult.currentOrigin.includes('lovableproject.com')) {
      fixes.push('*.lovableproject.com');
    }
    
    fixes.push('');
    fixes.push('# Full CORS configuration example:');
    fixes.push('ALLOWED_ORIGINS=https://hutz-live-85.onrender.com,https://hutz-live-85.lovable.app,*.lovable.app,*.lovableproject.com');
  }
  
  return fixes;
};