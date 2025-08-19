// FASE 1 - SECURITY CONTEXT CRÍTICO
// Força HTTPS e valida contexto seguro para getUserMedia

interface SecurityValidationResult {
  isSecure: boolean;
  isHTTPS: boolean;
  hasSecureContext: boolean;
  issues: string[];
  canAccessMedia: boolean;
}

class SecureContextEnforcer {
  private static instance: SecureContextEnforcer;
  private validationCache: SecurityValidationResult | null = null;
  private lastValidation = 0;
  private readonly CACHE_DURATION = 5000; // 5s cache

  static getInstance(): SecureContextEnforcer {
    if (!SecureContextEnforcer.instance) {
      SecureContextEnforcer.instance = new SecureContextEnforcer();
    }
    return SecureContextEnforcer.instance;
  }

  // CRÍTICO: Força redirecionamento HTTP -> HTTPS
  enforceHTTPS(): boolean {
    if (location.protocol === 'http:' && location.hostname !== 'localhost') {
      console.log('🔒 SECURITY: HTTP detected, redirecting to HTTPS...');
      const httpsUrl = `https://${location.host}${location.pathname}${location.search}${location.hash}`;
      location.replace(httpsUrl);
      return false; // Indicates redirect happened
    }
    return true; // Already HTTPS or localhost
  }

  // CRÍTICO: Valida contexto seguro completo
  validateSecureContext(): SecurityValidationResult {
    const now = Date.now();
    if (this.validationCache && (now - this.lastValidation) < this.CACHE_DURATION) {
      return this.validationCache;
    }

    const issues: string[] = [];
    const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
    const hasSecureContext = window.isSecureContext;

    if (!isHTTPS) {
      issues.push('HTTP protocol - HTTPS required for media access');
    }

    if (!hasSecureContext) {
      issues.push('Insecure context - getUserMedia blocked');
    }

    // Check for mixed content
    const hasMixedContent = this.detectMixedContent();
    if (hasMixedContent.length > 0) {
      issues.push(`Mixed content detected: ${hasMixedContent.join(', ')}`);
    }

    const isSecure = isHTTPS && hasSecureContext && hasMixedContent.length === 0;
    const canAccessMedia = hasSecureContext; // Main requirement for getUserMedia

    const result: SecurityValidationResult = {
      isSecure,
      isHTTPS,
      hasSecureContext,
      issues,
      canAccessMedia
    };

    this.validationCache = result;
    this.lastValidation = now;

    console.log('🔒 SECURITY: Context validation:', result);
    return result;
  }

  // CRÍTICO: Detecta mixed content
  private detectMixedContent(): string[] {
    const mixedContent: string[] = [];

    // Check scripts
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.startsWith('http://')) {
        mixedContent.push(`Insecure script: ${src}`);
      }
    });

    // Check stylesheets
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"][href]');
    stylesheets.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('http://')) {
        mixedContent.push(`Insecure stylesheet: ${href}`);
      }
    });

    // Check images
    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http://')) {
        mixedContent.push(`Insecure image: ${src}`);
      }
    });

    return mixedContent;
  }

  // CRÍTICO: Valida antes de getUserMedia
  async validateBeforeGetUserMedia(): Promise<void> {
    const validation = this.validateSecureContext();
    
    if (!validation.canAccessMedia) {
      const error = new Error(
        `getUserMedia blocked - ${validation.issues.join(', ')}`
      );
      error.name = 'NotAllowedError';
      throw error;
    }

    if (!validation.isSecure) {
      console.warn('🔒 SECURITY: Context not fully secure:', validation.issues);
    }
  }

  // Força correção de mixed content
  fixMixedContent(): void {
    console.log('🔒 SECURITY: Fixing mixed content...');

    // Fix scripts
    const scripts = document.querySelectorAll('script[src^="http://"]');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src) {
        script.setAttribute('src', src.replace('http://', 'https://'));
      }
    });

    // Fix stylesheets
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"][href^="http://"]');
    stylesheets.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        link.setAttribute('href', href.replace('http://', 'https://'));
      }
    });

    // Fix images
    const images = document.querySelectorAll('img[src^="http://"]');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        img.setAttribute('src', src.replace('http://', 'https://'));
      }
    });
  }

  // API pública
  getValidationResult(): SecurityValidationResult | null {
    return this.validationCache;
  }

  isSecureContext(): boolean {
    return this.validateSecureContext().canAccessMedia;
  }

  clearCache(): void {
    this.validationCache = null;
    this.lastValidation = 0;
  }
}

export const secureContextEnforcer = SecureContextEnforcer.getInstance();
export type { SecurityValidationResult };