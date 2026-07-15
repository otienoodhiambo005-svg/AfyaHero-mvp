/**
 * Structured Logging Utility for AfyaHero Health
 * 
 * Provides a consistent, secure logging framework that:
 * - Replaces console logging with structured logs
 * - Prevents sensitive data leakage
 * - Supports environment-based log levels
 * - Includes context and metadata
 * - Is production-ready with performance in mind
 */

import type { NextRequest } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  hospitalId?: string;
  requestId?: string;
  action?: string;
  resource?: string;
  duration?: number;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'ssn',
  'phone',
  'email',
  'address',
];

const isProduction = process.env.NODE_ENV === 'production';
const currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Sensitive Data Sanitization ──────────────────────────────────────────────

/**
 * Recursively sanitize sensitive data from context objects
 */
function sanitizeContext(context: LogContext): LogContext {
  const sanitized: LogContext = {};
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ─── Logger Implementation ────────────────────────────────────────────────────

class Logger {
  private defaultContext: LogContext = {};

  /**
   * Set default context for all subsequent logs
   */
  setContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Clear default context
   */
  clearContext(): void {
    this.defaultContext = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.setContext({ ...this.defaultContext, ...context });
    return childLogger;
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: LogContext | Error): void {
    if (context instanceof Error) {
      this.log('error', message, { error: context.message, stack: context.stack });
    } else {
      this.log('error', message, context);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check if this log level should be output
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizeContext({ ...this.defaultContext, ...context }),
    };

    // In production, output as JSON for easy parsing
    if (isProduction) {
      const logOutput = JSON.stringify(entry);
      
      switch (level) {
        case 'error':
          console.error(logOutput);
          break;
        case 'warn':
          console.warn(logOutput);
          break;
        default:
           
          console.log(logOutput);
      }
    } else {
      // In development, output in a more readable format
      const contextStr = entry.context && Object.keys(entry.context).length > 0
        ? ` ${JSON.stringify(entry.context)}`
        : '';
      
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];

      const color = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      }[level];

      const reset = '\x1b[0m';
      
       
      console.log(`${color}${emoji} [${level.toUpperCase()}]${reset} ${message}${contextStr}`);
    }
  }
}

// ─── Request-scoped Logger ────────────────────────────────────────────────────

/**
 * Extract request ID from Next.js request headers
 * Falls back to generating a new UUID if not present
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? generateRequestId();
}

/**
 * Create a logger for a specific request with request ID and user context
 */
export function createRequestLogger(
  requestId: string,
  userId?: string,
  hospitalId?: string
): Logger {
  const logger = new Logger();
  logger.setContext({
    requestId,
    userId,
    hospitalId,
    component: 'api',
  });
  return logger;
}

/**
 * Create a request-scoped logger from a Next.js request
 * Automatically extracts request ID from headers
 */
export function createLoggerFromRequest(
  request: NextRequest,
  userId?: string,
  hospitalId?: string
): Logger {
  const requestId = getRequestId(request);
  return createRequestLogger(requestId, userId, hospitalId);
}

// ─── Performance Logging ──────────────────────────────────────────────────────

/**
 * Measure and log the duration of an async operation
 */
export async function measureAsync<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  logger.debug(`Starting: ${operation}`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.info(`Completed: ${operation}`, { duration });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Failed: ${operation}`, { 
      duration, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

/**
 * Measure and log the duration of a sync operation
 */
export function measure<T>(
  logger: Logger,
  operation: string,
  fn: () => T
): T {
  const start = Date.now();
  logger.debug(`Starting: ${operation}`);
  
  try {
    const result = fn();
    const duration = Date.now() - start;
    logger.info(`Completed: ${operation}`, { duration });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Failed: ${operation}`, { 
      duration, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}

// ─── Export Default Instance ──────────────────────────────────────────────────

const logger = new Logger();
export default logger;

// ─── Usage Examples ───────────────────────────────────────────────────────────

/**
 * Basic usage:
 * 
 * import logger from '@/lib/logger';
 * 
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Database connection failed', { database: 'patients' });
 * logger.warn('Rate limit approaching', { current: 90, limit: 100 });
 * 
 * Request-scoped usage:
 * 
 * import { createRequestLogger } from '@/lib/logger';
 * 
 * const requestLogger = createRequestLogger(requestId, userId);
 * requestLogger.info('Processing request');
 * 
 * Performance measurement:
 * 
 * import { measureAsync } from '@/lib/logger';
 * 
 * const result = await measureAsync(logger, 'fetch patient data', () => fetchPatient(id));
 */
