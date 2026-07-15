/**
 * Application Monitoring Module
 * 
 * Provides performance monitoring, error tracking, and metrics collection
 * for the AfyaHero application. Supports integration with various monitoring services.
 */

import logger from './logger';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface ErrorEvent {
  message: string;
  stack?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  level: 'error' | 'warning' | 'info';
  userId?: string;
  hospitalId?: string;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: number;
}

class MonitoringService {
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorEvent[] = [];
  private maxMetrics: number = 1000;
  private maxErrors: number = 500;
  private isEnabled: boolean = true;

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Track a performance metric
   */
  trackMetric(name: string, duration: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (duration > 1000) {
      logger.warn(`Slow operation: ${name}`, { duration, tags });
    }

    // Send to external monitoring service if configured
    this.sendMetric(metric);
  }

  /**
   * Track an error event
   */
  trackError(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const errorEvent: ErrorEvent = {
      message,
      stack: error?.stack,
      timestamp: Date.now(),
      context,
      level: 'error',
    };

    this.errors.push(errorEvent);

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log the error
    logger.error(message, context || {});

    // Send to external monitoring service if configured
    this.sendError(errorEvent);
  }

  /**
   * Track a warning event
   */
  trackWarning(message: string, context?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    logger.warn(message, context);
  }

  /**
   * Get performance metrics for a specific operation
   */
  getMetrics(name?: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (since) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    return filtered;
  }

  /**
   * Get statistics for a specific metric
   */
  getMetricStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name);
    
    if (metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = durations[0];
    const max = durations[count - 1];

    const p50 = durations[Math.floor(count * 0.5)];
    const p95 = durations[Math.floor(count * 0.95)];
    const p99 = durations[Math.floor(count * 0.99)];

    return { count, avg, min, max, p50, p95, p99 };
  }

  /**
   * Get recent errors
   */
  getErrors(since?: number): ErrorEvent[] {
    if (since) {
      return this.errors.filter(e => e.timestamp >= since);
    }
    return this.errors;
  }

  /**
   * Perform a health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const checks: Record<string, boolean> = {
      database: false,
      cache: false,
      api: false,
    };

    try {
      // Check database connection
      const { prisma } = await import('./database');
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      logger.error('Database health check failed', { error });
    }

    try {
      // Check cache connection (if configured)
      if (process.env.UPSTASH_REDIS_REST_URL) {
        // Simple cache check would go here
        checks.cache = true;
      } else {
        checks.cache = true; // No cache configured, mark as healthy
      }
    } catch (error) {
      logger.error('Cache health check failed', { error });
    }

    // API check (always true if we're running)
    checks.api = true;

    const failedChecks = Object.values(checks).filter(v => !v).length;
    const status = failedChecks === 0 ? 'healthy' : failedChecks === 1 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      timestamp: Date.now(),
    };
  }

  /**
   * Send metric to external monitoring service
   * (Placeholder for integration with Application Insights, Datadog, etc.)
   */
  private sendMetric(metric: PerformanceMetric): void {
    // Integration with external monitoring services would go here
    // For now, we'll just log it
    if (process.env.NODE_ENV === 'production') {
      // Send to Application Insights, Datadog, or similar
      // Example: telemetryClient.trackMetric({ name: metric.name, value: metric.duration });
    }
  }

  /**
   * Send error to external monitoring service
   * (Placeholder for integration with Sentry, Application Insights, etc.)
   */
  private sendError(errorEvent: ErrorEvent): void {
    // Integration with external monitoring services would go here
    // For now, we'll just log it
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry, Application Insights, or similar
      // Example: telemetryClient.trackException({ exception: new Error(errorEvent.message) });
    }
  }

  /**
   * Clear stored metrics and errors
   */
  clear(): void {
    this.metrics = [];
    this.errors = [];
  }

  /**
   * Get monitoring summary
   */
  getSummary(): {
    totalMetrics: number;
    totalErrors: number;
    recentErrors: number;
    slowOperations: number;
    avgResponseTime: number;
  } {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);
    const recentErrors = this.errors.filter(e => e.timestamp >= oneHourAgo);
    const slowOps = recentMetrics.filter(m => m.duration > 1000);
    const avgTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      : 0;

    return {
      totalMetrics: this.metrics.length,
      totalErrors: this.errors.length,
      recentErrors: recentErrors.length,
      slowOperations: slowOps.length,
      avgResponseTime: avgTime,
    };
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

/**
 * Decorator to measure function performance
 */
export function measurePerformance(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        monitoring.trackMetric(metricName, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        monitoring.trackError(`Error in ${metricName}`, error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Hook to measure React component render performance
 */
export function usePerformanceMonitor(componentName: string) {
  return {
    measureRender: (callback: () => void) => {
      const start = Date.now();
      callback();
      const duration = Date.now() - start;
      monitoring.trackMetric(`${componentName}.render`, duration);
    },
  };
}

/**
 * API route monitoring middleware
 */
export function withMonitoring(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();
    const url = new URL(req.url);
    const metricName = `api.${url.pathname}`;

    try {
      const response = await handler(req);
      const duration = Date.now() - start;
      monitoring.trackMetric(metricName, duration, {
        method: req.method,
        status: response.status.toString(),
      });
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      monitoring.trackError(`API Error: ${metricName}`, error as Error, {
        method: req.method,
        url: url.pathname,
        duration,
      });
      throw error;
    }
  };
}
