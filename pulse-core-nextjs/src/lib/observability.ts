/**
 * Observability Utilities - Logs, Metrics, and Tracing
 * 
 * Provides comprehensive observability for the AfyaHero Health system including:
 * - Structured logging with correlation IDs
 * - Distributed tracing with OpenTelemetry patterns
 * - Custom metrics collection
 * - Request/response logging with PII filtering
 */

import { randomUUID } from 'crypto';
import structuredLogger from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId: string;
  spanId: string;
  traceId: string;
  userId?: string;
  hospitalId?: string;
  requestId: string;
  component: string;
  action: string;
  timestamp: string;
  duration?: number;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface MetricData {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: Record<string, unknown>;
  timestamp: string;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  operation: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'ok' | 'error';
  attributes?: Record<string, string | number | boolean>;
  error?: {
    type: string;
    message: string;
  };
}

// ─── PII Filtering ──────────────────────────────────────────────────────────

const PII_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'email',
  'phone',
  'ssn',
  'idNumber',
  'nationalId',
  'address',
];

const PII_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
];

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // Check if value looks like PII
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(value)) {
        return '[REDACTED]';
      }
    }
    return value.length > 100 ? value.substring(0, 100) + '...' : value;
  }
  
  if (typeof value === 'object' && value !== null) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (PII_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeValue(value);
    }
  }
  
  return sanitized;
}

export function sanitizeForLogging(data: unknown): unknown {
  return sanitizeValue(data);
}

// ─── Correlation ID Management ──────────────────────────────────────────────

function generateCorrelationId(): string {
  return randomUUID();
}

function generateSpanId(): string {
  return randomUUID().substring(0, 16);
}

export function createTraceContext(): { traceId: string; spanId: string; correlationId: string } {
  const traceId = generateCorrelationId();
  const spanId = generateSpanId();
  const correlationId = traceId; // Use traceId as correlationId for simplicity
  
  return { traceId, spanId, correlationId };
}

export function createChildSpanContext(parentTraceId: string): { spanId: string; traceId: string } {
  return {
    traceId: parentTraceId,
    spanId: generateSpanId(),
  };
}

// ─── Structured Logging ─────────────────────────────────────────────────────

function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL || 'info';
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return validLevels.includes(envLevel as LogLevel) ? envLevel as LogLevel : 'info';
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLogLevel = getLogLevelFromEnv();

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

export function log(
  level: LogLevel,
  message: string,
  context: Partial<LogContext> & { component: string; action: string },
  metadata?: Record<string, unknown>,
  error?: Error,
): void {
  if (!shouldLog(level)) return;
  
  const logEntry: LogEntry = {
    level,
    message,
    context: {
      correlationId: context.correlationId || generateCorrelationId(),
      spanId: context.spanId || generateSpanId(),
      traceId: context.traceId || generateCorrelationId(),
      userId: context.userId,
      hospitalId: context.hospitalId,
      requestId: context.requestId || randomUUID(),
      component: context.component,
      action: context.action,
      timestamp: context.timestamp || new Date().toISOString(),
      duration: context.duration,
    },
    metadata,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
  };
  
  const logContext = {
    correlationId: logEntry.context.correlationId,
    traceId: logEntry.context.traceId,
    spanId: logEntry.context.spanId,
    requestId: logEntry.context.requestId,
    userId: logEntry.context.userId,
    hospitalId: logEntry.context.hospitalId,
    component: logEntry.context.component,
    action: logEntry.context.action,
    duration: logEntry.context.duration,
    metadata: logEntry.metadata ? sanitizeObject(logEntry.metadata) : undefined,
    ...(logEntry.error
      ? { error: logEntry.error.message, stack: logEntry.error.stack }
      : {}),
  };

  switch (level) {
    case 'debug':
      structuredLogger.debug(message, logContext);
      break;
    case 'info':
      structuredLogger.info(message, logContext);
      break;
    case 'warn':
      structuredLogger.warn(message, logContext);
      break;
    case 'error':
      structuredLogger.error(message, logContext);
      break;
  }
}

// Convenience methods
export const logger = {
  debug: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
    log('debug', message, context, metadata),
  
  info: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
    log('info', message, context, metadata),
  
  warn: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
    log('warn', message, context, metadata),
  
  error: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>, error?: Error) =>
    log('error', message, context, metadata, error),
  
  child: (childContext: Partial<LogContext>) => ({
    debug: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
      log('debug', message, { ...childContext, ...context }, metadata),
    info: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
      log('info', message, { ...childContext, ...context }, metadata),
    warn: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>) =>
      log('warn', message, { ...childContext, ...context }, metadata),
    error: (message: string, context: Partial<LogContext> & { component: string; action: string }, metadata?: Record<string, unknown>, error?: Error) =>
      log('error', message, { ...childContext, ...context }, metadata, error),
  }),
};

// ─── Metrics Collection ─────────────────────────────────────────────────────

// In-memory metrics store (would be replaced with Prometheus client in production)
const metricsStore: Map<string, MetricData[]> = new Map();

export function recordMetric(metric: Omit<MetricData, 'timestamp'>): void {
  const metricWithTimestamp: MetricData = {
    ...metric,
    timestamp: new Date().toISOString(),
  };
  
  const key = `${metric.name}${metric.labels ? '_' + Object.entries(metric.labels).map(([k, v]) => `${k}=${v}`).join('_') : ''}`;
  
  if (!metricsStore.has(key)) {
    metricsStore.set(key, []);
  }
  
  const metrics = metricsStore.get(key)!;
  metrics.push(metricWithTimestamp);
  
  // Keep only last 1000 data points per metric
  if (metrics.length > 1000) {
    metrics.shift();
  }
  
  // Also log metric for observability
  logger.info(`Metric recorded: ${metric.name}`, {
    component: 'metrics',
    action: 'record',
  }, {
    metricName: metric.name,
    value: metric.value,
    type: metric.type,
    labels: metric.labels,
  });
}

export function incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
  recordMetric({
    name,
    value,
    type: 'counter',
    labels,
  });
}

export function recordGauge(name: string, value: number, labels?: Record<string, string>): void {
  recordMetric({
    name,
    value,
    type: 'gauge',
    labels,
  });
}

export function recordHistogram(name: string, value: number, labels?: Record<string, unknown>): void {
  recordMetric({
    name,
    value,
    type: 'histogram',
    labels,
  });
}

export function getMetrics(): Map<string, MetricData[]> {
  return new Map(metricsStore);
}

// ─── Distributed Tracing ────────────────────────────────────────────────────

const activeSpans: Map<string, SpanData> = new Map();

export function startSpan(
  name: string,
  operation: string,
  parentTraceId?: string,
  attributes?: Record<string, string | number | boolean>,
): { spanId: string; traceId: string } {
  const { traceId, spanId } = parentTraceId 
    ? createChildSpanContext(parentTraceId)
    : createTraceContext();
  
  const span: SpanData = {
    traceId,
    spanId,
    name,
    operation,
    startTime: new Date().toISOString(),
    status: 'ok',
    attributes,
  };
  
  activeSpans.set(spanId, span);
  
  logger.debug(`Span started: ${name}`, {
    component: 'tracing',
    action: 'startSpan',
    traceId,
    spanId,
  }, { operation, attributes });
  
  return { spanId, traceId };
}

export function endSpan(
  spanId: string,
  error?: { type: string; message: string },
): number {
  const span = activeSpans.get(spanId);
  if (!span) {
    logger.warn(`Span not found: ${spanId}`, {
      component: 'tracing',
      action: 'endSpan',
    });
    return 0;
  }
  
  const endTime = new Date().toISOString();
  const duration = new Date(endTime).getTime() - new Date(span.startTime).getTime();
  
  span.endTime = endTime;
  span.duration = duration;
  span.status = error ? 'error' : 'ok';
  span.error = error;
  
  activeSpans.delete(spanId);
  
  // Record span duration as metric
  recordHistogram('span_duration_ms', duration, {
    span_name: span.name,
    operation: span.operation,
    status: span.status,
  });
  
  // Record span count
  incrementCounter('spans_completed', {
    span_name: span.name,
    status: span.status,
  });
  
  logger.debug(`Span ended: ${span.name}`, {
    component: 'tracing',
    action: 'endSpan',
    traceId: span.traceId,
    spanId: span.spanId,
    duration,
  }, { error });
  
  return duration;
}

export function getActiveSpans(): SpanData[] {
  return Array.from(activeSpans.values());
}

// ─── Request/Response Logging Middleware Helpers ───────────────────────────

export interface RequestLogData {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface ResponseLogData {
  status: number;
  duration: number;
  body?: unknown;
}

export function logRequest(
  request: RequestLogData,
  context: Partial<LogContext> & { component: string; action: string },
): void {
  logger.info(`HTTP ${request.method} ${request.url}`, {
    ...context,
    action: `${request.method} ${request.url}`,
  }, {
    method: request.method,
    url: request.url,
    query: sanitizeForLogging(request.query),
    params: sanitizeForLogging(request.params),
    // Note: body is intentionally not logged by default for security
  });
}

export function logResponse(
  response: ResponseLogData,
  context: Partial<LogContext> & { component: string; action: string },
  requestMethod?: string,
  requestUrl?: string,
): void {
  const message = `HTTP ${requestMethod || 'UNKNOWN'} ${requestUrl || 'UNKNOWN'} - ${response.status}`;
  const meta = {
    status: String(response.status),
    ...(response.duration ? { duration: String(response.duration) } : {}),
  };

  if (response.status >= 400) {
    logger.warn(message, { ...context, duration: response.duration, action: `${requestMethod || 'UNKNOWN'} ${requestUrl || 'UNKNOWN'}` }, meta);
  } else {
    logger.info(message, { ...context, duration: response.duration, action: `${requestMethod || 'UNKNOWN'} ${requestUrl || 'UNKNOWN'}` }, meta);
  }
}

// ─── Health Check Metrics ──────────────────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    latency?: number;
  }>;
  timestamp: string;
  uptime: number;
}

export function createHealthStatus(
  checks: HealthStatus['checks'],
): HealthStatus {
  const _allPassed = Object.values(checks).every(c => c.status === 'pass');
  const anyFailed = Object.values(checks).some(c => c.status === 'fail');
  
  let status: HealthStatus['status'] = 'healthy';
  if (anyFailed) {
    status = 'unhealthy';
  } else if (Object.values(checks).some(c => c.status === 'warn')) {
    status = 'degraded';
  }
  
  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

// ─── Performance Monitoring ────────────────────────────────────────────────

export function measurePerformance<T>(
  name: string,
  operation: () => T,
  context: Partial<LogContext> & { component: string; action: string },
): T {
  const startTime = performance.now();
  
  try {
    const result = operation();
    const duration = performance.now() - startTime;
    
    recordHistogram(`${name}_duration_ms`, duration, context);
    
    logger.debug(`${name} completed`, {
      ...context,
      duration,
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    recordHistogram(`${name}_duration_ms`, duration, {
      ...context,
      status: 'error',
    });
    
    logger.error(`${name} failed`, {
      ...context,
      duration,
    }, undefined, error as Error);
    
    throw error;
  }
}

export async function measurePerformanceAsync<T>(
  name: string,
  operation: () => Promise<T>,
  context: Partial<LogContext> & { component: string; action: string },
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    recordHistogram(`${name}_duration_ms`, duration, context);
    
    logger.debug(`${name} completed`, {
      ...context,
      duration,
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    recordHistogram(`${name}_duration_ms`, duration, {
      ...context,
      status: 'error',
    });
    
    logger.error(`${name} failed`, {
      ...context,
      duration,
    }, undefined, error as Error);
    
    throw error;
  }
}