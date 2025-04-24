
/**
 * Centralized logging utility for consistent logging across the application
 */

// Define log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Interface for our logger instance
interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

// Global settings for logging
const logSettings = {
  enabledModules: new Set<string>(['default', 'webrtc', 'diagnostics', 'stream']),
  minLevel: 'info' as LogLevel,
  persistLogs: true,
  maxStoredLogs: 100
};

// In-memory log storage
const logStorage: Array<{
  timestamp: number;
  module: string;
  level: LogLevel;
  message: string;
  data?: any;
}> = [];

/**
 * Creates a logger instance for a specific module
 */
export const createLogger = (module: string): Logger => {
  const isModuleEnabled = () => logSettings.enabledModules.has(module) || 
                               logSettings.enabledModules.has('*');
  
  const isLevelEnabled = (level: LogLevel): boolean => {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    return levels[level] >= levels[logSettings.minLevel];
  };
  
  const log = (level: LogLevel, message: string, ...args: any[]): void => {
    if (!isModuleEnabled() || !isLevelEnabled(level)) return;
    
    const timestamp = Date.now();
    const formattedMessage = `[${module}] ${message}`;
    
    // Format based on environment and level
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, ...args);
        break;
      case 'info':
        console.info(formattedMessage, ...args);
        break;
      case 'warn':
        console.warn(formattedMessage, ...args);
        break;
      case 'error':
        console.error(formattedMessage, ...args);
        break;
    }
    
    // Store logs if enabled
    if (logSettings.persistLogs) {
      logStorage.push({
        timestamp,
        module,
        level,
        message,
        data: args.length > 0 ? args : undefined
      });
      
      // Trim log storage if it exceeds maximum size
      if (logStorage.length > logSettings.maxStoredLogs) {
        logStorage.shift();
      }
    }
  };
  
  return {
    debug: (message: string, ...args: any[]) => log('debug', message, ...args),
    info: (message: string, ...args: any[]) => log('info', message, ...args),
    warn: (message: string, ...args: any[]) => log('warn', message, ...args),
    error: (message: string, ...args: any[]) => log('error', message, ...args)
  };
};

/**
 * Gets stored logs for debugging purposes
 */
export const getStoredLogs = (
  options: { 
    module?: string; 
    level?: LogLevel; 
    since?: number;
  } = {}
): typeof logStorage => {
  let filteredLogs = [...logStorage];
  
  if (options.module) {
    filteredLogs = filteredLogs.filter(log => log.module === options.module);
  }
  
  if (options.level) {
    filteredLogs = filteredLogs.filter(log => log.level === options.level);
  }
  
  if (options.since) {
    filteredLogs = filteredLogs.filter(log => log.timestamp >= options.since);
  }
  
  return filteredLogs;
};

/**
 * Configure logging settings
 */
export const configureLogging = (options: {
  enabledModules?: string[];
  minLevel?: LogLevel;
  persistLogs?: boolean;
  maxStoredLogs?: number;
}): void => {
  if (options.enabledModules) {
    logSettings.enabledModules = new Set(options.enabledModules);
  }
  
  if (options.minLevel) {
    logSettings.minLevel = options.minLevel;
  }
  
  if (options.persistLogs !== undefined) {
    logSettings.persistLogs = options.persistLogs;
  }
  
  if (options.maxStoredLogs) {
    logSettings.maxStoredLogs = options.maxStoredLogs;
    
    // Trim existing logs if needed
    if (logStorage.length > options.maxStoredLogs) {
      const trimCount = logStorage.length - options.maxStoredLogs;
      logStorage.splice(0, trimCount);
    }
  }
};

// Enable all modules in development mode for easier debugging
if (import.meta.env.DEV) {
  logSettings.enabledModules.add('*');
  logSettings.minLevel = 'debug';
}

// Initialize default logger
const defaultLogger = createLogger('default');
export default defaultLogger;
