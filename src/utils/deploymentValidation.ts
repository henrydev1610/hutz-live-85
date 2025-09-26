/**
 * Deployment validation utilities for signaling configuration
 */

import { signalingConfig } from '@/config/signalingConfig';

export interface DeploymentCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export interface DeploymentValidationResult {
  isValid: boolean;
  checks: DeploymentCheck[];
  errors: string[];
  warnings: string[];
}

class DeploymentValidator {
  /**
   * Run comprehensive deployment validation
   */
  async validate(): Promise<DeploymentValidationResult> {
    const checks: DeploymentCheck[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Signaling configuration
    const configCheck = this.validateSignalingConfig();
    checks.push(configCheck);
    if (configCheck.status === 'fail') {
      errors.push(configCheck.message);
    } else if (configCheck.status === 'warning') {
      warnings.push(configCheck.message);
    }

    // Check 2: WebSocket connectivity
    const wsCheck = await this.validateWebSocketConnectivity();
    checks.push(wsCheck);
    if (wsCheck.status === 'fail') {
      errors.push(wsCheck.message);
    }

    // Check 3: Environment variables
    const envCheck = this.validateEnvironmentVariables();
    checks.push(envCheck);
    if (envCheck.status === 'fail') {
      errors.push(envCheck.message);
    } else if (envCheck.status === 'warning') {
      warnings.push(envCheck.message);
    }

    // Check 4: Production URL validation
    const urlCheck = this.validateProductionURLs();
    checks.push(urlCheck);
    if (urlCheck.status === 'fail') {
      errors.push(urlCheck.message);
    }

    return {
      isValid: errors.length === 0,
      checks,
      errors,
      warnings
    };
  }

  private validateSignalingConfig(): DeploymentCheck {
    try {
      const config = signalingConfig.getConfig();
      const validation = signalingConfig.validateConfig();

      if (!validation.isValid) {
        return {
          name: 'Signaling Configuration',
          status: 'fail',
          message: `Invalid signaling configuration: ${validation.errors.join(', ')}`,
          details: { config, errors: validation.errors }
        };
      }

      return {
        name: 'Signaling Configuration',
        status: 'pass',
        message: `Valid ${config.isDevelopment ? 'development' : 'production'} signaling configuration`,
        details: { url: config.url, protocol: config.protocol }
      };
    } catch (error) {
      return {
        name: 'Signaling Configuration',
        status: 'fail',
        message: `Failed to validate signaling configuration: ${error}`,
        details: { error }
      };
    }
  }

  private async validateWebSocketConnectivity(): Promise<DeploymentCheck> {
    try {
      const signalingURL = signalingConfig.getSignalingURL();
      
      // For WebSocket testing, we'll check if we can create a WebSocket connection
      return new Promise<DeploymentCheck>((resolve) => {
        const testSocket = new WebSocket(signalingURL.replace(/^http/, 'ws'));
        const timeout = setTimeout(() => {
          testSocket.close();
          resolve({
            name: 'WebSocket Connectivity',
            status: 'fail',
            message: 'WebSocket connection timeout (5s)',
            details: { url: signalingURL, timeout: '5000ms' }
          });
        }, 5000);

        testSocket.onopen = () => {
          clearTimeout(timeout);
          testSocket.close();
          resolve({
            name: 'WebSocket Connectivity',
            status: 'pass',
            message: 'WebSocket connection successful',
            details: { url: signalingURL }
          });
        };

        testSocket.onerror = (error) => {
          clearTimeout(timeout);
          resolve({
            name: 'WebSocket Connectivity',
            status: 'fail',
            message: 'WebSocket connection failed',
            details: { url: signalingURL, error }
          });
        };
      });
    } catch (error) {
      return {
        name: 'WebSocket Connectivity',
        status: 'fail',
        message: `WebSocket test failed: ${error}`,
        details: { error }
      };
    }
  }

  private validateEnvironmentVariables(): DeploymentCheck {
    const envVars = {
      VITE_SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL,
      VITE_API_URL: import.meta.env.VITE_API_URL,
      MODE: import.meta.env.MODE
    };

    const missing = Object.entries(envVars)
      .filter(([key, value]) => key !== 'VITE_SIGNALING_SERVER_URL' && !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      return {
        name: 'Environment Variables',
        status: 'warning',
        message: `Missing optional environment variables: ${missing.join(', ')}`,
        details: { available: envVars, missing }
      };
    }

    // Check for development mode in production
    const config = signalingConfig.getConfig();
    if (!config.isDevelopment && import.meta.env.MODE === 'development') {
      return {
        name: 'Environment Variables',
        status: 'warning',
        message: 'Running in development mode on production environment',
        details: { mode: import.meta.env.MODE, environment: 'production' }
      };
    }

    return {
      name: 'Environment Variables',
      status: 'pass',
      message: 'Environment variables properly configured',
      details: envVars
    };
  }

  private validateProductionURLs(): DeploymentCheck {
    const config = signalingConfig.getConfig();
    const currentHost = window.location.host;

    // In production/preview, ensure no localhost usage
    if (!config.isDevelopment) {
      if (config.url.includes('localhost')) {
        return {
          name: 'Production URL Validation',
          status: 'fail',
          message: 'Production environment using localhost signaling URL',
          details: { url: config.url, environment: 'production' }
        };
      }

      if (config.protocol !== 'wss') {
        return {
          name: 'Production URL Validation',
          status: 'fail',
          message: 'Production environment must use WSS protocol',
          details: { protocol: config.protocol, url: config.url }
        };
      }
    }

    return {
      name: 'Production URL Validation',
      status: 'pass',
      message: `Valid ${config.isDevelopment ? 'development' : 'production'} URL configuration`,
      details: { url: config.url, protocol: config.protocol, host: currentHost }
    };
  }

  /**
   * Log deployment validation results
   */
  logValidationResults(result: DeploymentValidationResult): void {
    console.log('🔍 [DEPLOYMENT] Validation Results:', {
      isValid: result.isValid,
      checkCount: result.checks.length,
      errors: result.errors.length,
      warnings: result.warnings.length
    });

    // Log individual checks
    result.checks.forEach(check => {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} [DEPLOYMENT] ${check.name}: ${check.message}`);
      if (check.details) {
        console.log(`   Details:`, check.details);
      }
    });

    // Log summary
    if (result.isValid) {
      console.log('✅ [DEPLOYMENT] All validation checks passed');
    } else {
      console.error('❌ [DEPLOYMENT] Validation failed:', result.errors);
    }

    if (result.warnings.length > 0) {
      console.warn('⚠️ [DEPLOYMENT] Warnings:', result.warnings);
    }
  }
}

// Export singleton instance
export const deploymentValidator = new DeploymentValidator();

// Make available for debugging
(window as any).deploymentValidator = deploymentValidator;