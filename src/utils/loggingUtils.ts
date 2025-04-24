
/**
 * Enhanced logging utility for better debugging
 */

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Default log level - can be overridden
let globalLogLevel: LogLevel = 'info';

// Determine if we're in development mode
const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

// Create colored log styles
const logStyles = {
  debug: 'color: #6b7280; font-weight: normal;',
  info: 'color: #2563eb; font-weight: bold;',
  warn: 'color: #d97706; font-weight: bold;',
  error: 'color: #dc2626; font-weight: bold;'
};

// Map of numeric priorities for filtering
const logLevelPriorities: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Set global log level
 * @param level - The log level to set
 */
export const setLogLevel = (level: LogLevel): void => {
  globalLogLevel = level;
  console.log(`Log level set to: ${level}`);
};

/**
 * Creates a named logger instance
 * @param namespace - The namespace for this logger (usually a component or module name)
 * @returns Logger object with methods for each log level
 */
export const createLogger = (namespace: string) => {
  const shouldLog = (level: LogLevel): boolean => {
    return logLevelPriorities[level] >= logLevelPriorities[globalLogLevel];
  };
  
  const formatMessage = (level: LogLevel, message: string): string => {
    return `[${namespace}] ${message}`;
  };

  return {
    debug: (message: string, ...args: any[]): void => {
      if (!shouldLog('debug') && !isDev) return;
      console.debug(`%c${formatMessage('debug', message)}`, logStyles.debug, ...args);
    },
    
    info: (message: string, ...args: any[]): void => {
      if (!shouldLog('info') && !isDev) return;
      console.info(`%c${formatMessage('info', message)}`, logStyles.info, ...args);
    },
    
    warn: (message: string, ...args: any[]): void => {
      if (!shouldLog('warn')) return;
      console.warn(`%c${formatMessage('warn', message)}`, logStyles.warn, ...args);
    },
    
    error: (message: string, ...args: any[]): void => {
      if (!shouldLog('error')) return;
      console.error(`%c${formatMessage('error', message)}`, logStyles.error, ...args);
    },
    
    /**
     * Groups related log messages together
     * @param title - The title for the group
     * @param level - Log level for the group
     * @param callback - Function containing grouped log calls
     */
    group: (title: string, level: LogLevel, callback: () => void): void => {
      if (!shouldLog(level) && !isDev) return;
      console.group(`%c${formatMessage(level, title)}`, logStyles[level]);
      callback();
      console.groupEnd();
    },
    
    /**
     * Logs a performance measurement
     * @param label - Label for the measurement
     * @param callback - Function to measure
     * @returns The result of the callback
     */
    measure: async <T>(label: string, callback: () => Promise<T> | T): Promise<T> => {
      if (!shouldLog('debug') && !isDev) return callback();
      
      const start = performance.now();
      let result: T;
      
      try {
        result = await callback();
      } catch (error) {
        const duration = performance.now() - start;
        console.error(
          `%c${formatMessage('error', `${label} failed after ${duration.toFixed(2)}ms`)}`, 
          logStyles.error, 
          error
        );
        throw error;
      }
      
      const duration = performance.now() - start;
      console.debug(
        `%c${formatMessage('debug', `${label}: ${duration.toFixed(2)}ms`)}`, 
        logStyles.debug
      );
      
      return result;
    }
  };
};

// Export a default logger for general use
export const logger = createLogger('app');

// Enable more detailed logging in development mode
if (isDev) {
  setLogLevel('debug');
  logger.info('Development mode detected - verbose logging enabled');
}
