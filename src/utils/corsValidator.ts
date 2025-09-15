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
 * Validate CORS configuration between frontend and backend with retry logic
 */
export const validateCORSConnection = async (backendUrl: string): Promise<CORSValidationResult> => {
  const currentOrigin = window.location.origin;
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  console.log(`🔍 CORS VALIDATION: Testing connection from ${currentOrigin} to ${backendUrl}`);
  
  // Try multiple endpoints to wake up sleeping server
  const endpoints = ['/health', '/status', '/api/test'];
  let lastError: Error | null = null;
  let response: Response | null = null;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔄 Trying endpoint: ${backendUrl}${endpoint}`);
      
      response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        console.log(`✅ Backend awake via ${endpoint}`);
        break;
      } else {
        console.log(`⚠️ ${endpoint} returned ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} failed:`, error);
      lastError = error as Error;
      response = null;
    }
  }
  
  if (!response || !response.ok) {
    errors.push(`Backend not responding: ${response?.status || 'Connection failed'} ${response?.statusText || ''}`);
    suggestions.push('Backend may be sleeping - retry in a few seconds');
    suggestions.push('Verify backend URL is correct');
    
    if (lastError) {
      errors.push(`Last error: ${lastError.message}`);
    }
  } else {
    // Check CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
    };
    
    console.log(`📋 CORS HEADERS:`, corsHeaders);
    
    const allowOrigin = corsHeaders['Access-Control-Allow-Origin'];
    if (allowOrigin === null) {
      errors.push(`CORS header missing: Backend did not send Access-Control-Allow-Origin header`);
      suggestions.push(`Add "${currentOrigin}" to ALLOWED_ORIGINS in server/.env`);
      suggestions.push('Check server CORS configuration');
    } else if (allowOrigin !== '*' && allowOrigin !== currentOrigin) {
      errors.push(`CORS origin mismatch: Backend allows "${allowOrigin}", current origin is "${currentOrigin}"`);
      suggestions.push(`Add "${currentOrigin}" to ALLOWED_ORIGINS in server/.env`);
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