/**
 * Load Balancing Utilities - Traffic management and rate limiting
 * 
 * Provides load balancing capabilities for the AfyaHero Health system including:
 * - Rate limiting with token bucket algorithm
 * - Circuit breaker pattern for external services
 * - Connection pooling configuration
 * - Health check enhancements
 * - Traffic shaping and prioritization
 */

import { Redis } from '@upstash/redis';
import { logger, measurePerformanceAsync } from './observability';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RateLimitScope = 'global' | 'user' | 'ip' | 'endpoint' | 'hospital';

export interface RateLimitConfig {
  scope: RateLimitScope;
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  openedAt?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms before trying again after opening
  monitorPeriod: number; // ms to monitor failures
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  message?: string;
  timestamp: string;
}

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'random';
  healthCheckInterval: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
}

// ─── Redis Client ───────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis not configured - rate limiting disabled', {
      component: 'load-balancing',
      action: 'getRedisClient',
    });
    return null;
  }
  
  try {
    redisClient = new Redis({
      url,
      token,
      automaticDeserialization: false,
    });
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client for load balancing', {
      component: 'load-balancing',
      action: 'getRedisClient',
    }, undefined, error as Error);
    
    return null;
  }
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

class RateLimiter {
  private redis: Redis | null;

  private useRedis: boolean;

  private localCounters: Map<string, { count: number; resetAt: number }> = new Map();
  
  constructor() {
    this.redis = getRedisClient();
    this.useRedis = this.redis !== null;
  }
  
  private generateKey(scope: RateLimitScope, identifier?: string, prefix?: string): string {
    const baseKey = `${prefix || 'ratelimit'}:${scope}:${identifier || 'global'}`;
    return baseKey;
  }
  
  /**
   * Check if a request should be allowed
   */
  async checkLimit(
    identifier: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const key = this.generateKey(config.scope, identifier, config.keyPrefix);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.windowSeconds;
    
    return measurePerformanceAsync(
      `ratelimit_check_${config.scope}`,
      async () => {
        // Try Redis first
        if (this.useRedis && this.redis) {
          try {
            // Use sliding window with sorted set
            const redisKey = `ratelimit:${key}:${windowStart}`;
            
            // Add current request
            const pipeline = this.redis.pipeline();
            pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
            pipeline.zremrangebyscore(redisKey, 0, windowStart);
            pipeline.zcard(redisKey);
            pipeline.expire(redisKey, config.windowSeconds + 1);
            
            const results = await pipeline.exec();
            const count = results[2] as number;
            
            if (count > config.maxRequests) {
              const resetAt = windowStart + config.windowSeconds;
              
              logger.warn('Rate limit exceeded', {
                component: 'load-balancing',
                action: 'checkLimit',
              }, {
                key,
                scope: config.scope,
                count,
                max: config.maxRequests,
                resetAt,
              });
              
              return {
                allowed: false,
                remaining: 0,
                resetAt: resetAt * 1000,
                retryAfter: resetAt - now,
              };
            }
            
            return {
              allowed: true,
              remaining: config.maxRequests - count,
              resetAt: (windowStart + config.windowSeconds) * 1000,
            };
          } catch (error) {
            logger.warn('Redis rate limit check failed, using local', {
              component: 'load-balancing',
              action: 'checkLimit',
            }, { key, error: (error as Error).message });
          }
        }
        
        // Fallback to local rate limiting
        return this.checkLocalLimit(key, config);
      },
      { component: 'load-balancing', action: 'checkLimit' },
    );
  }
  
  private checkLocalLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const counter = this.localCounters.get(key);
    
    if (!counter || now > counter.resetAt) {
      // Reset counter
      this.localCounters.set(key, {
        count: 1,
        resetAt: now + config.windowSeconds * 1000,
      });
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowSeconds * 1000,
      };
    }
    
    if (counter.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: counter.resetAt,
        retryAfter: Math.ceil((counter.resetAt - now) / 1000),
      };
    }
    
    counter.count++;
    
    return {
      allowed: true,
      remaining: config.maxRequests - counter.count,
      resetAt: counter.resetAt,
    };
  }
  
  /**
   * Create rate limit headers for response
   */
  createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': result.remaining.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toUTCString(),
      ...(result.retryAfter && {
        'Retry-After': result.retryAfter.toString(),
      }),
    };
  }
}

const rateLimiter = new RateLimiter();

// ─── Circuit Breaker ────────────────────────────────────────────────────────

class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();

  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000, // 1 minute
    monitorPeriod: 60000, // 1 minute
  };
  
  private getState(key: string): CircuitBreakerState {
    if (!this.states.has(key)) {
      this.states.set(key, {
        status: 'closed',
        failures: 0,
        successes: 0,
      });
    }
    return this.states.get(key)!;
  }
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {},
  ): Promise<T> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const state = this.getState(key);
    const now = Date.now();
    
    // Check if circuit is open
    if (state.status === 'open') {
      if (state.openedAt && now - state.openedAt > mergedConfig.timeout) {
        // Try half-open
        state.status = 'half-open';
        logger.info('Circuit breaker half-open, attempting recovery', {
          component: 'load-balancing',
          action: 'execute',
        }, { key, timeout: mergedConfig.timeout });
      } else {
        logger.warn('Circuit breaker open, rejecting request', {
          component: 'load-balancing',
          action: 'execute',
        }, { key, status: state.status });
        
        throw new Error(`Circuit breaker open for ${key}`);
      }
    }
    
    try {
      const result = await fn();
      
      // Success
      state.successes++;
      state.lastSuccessAt = now;
      state.failures = 0;
      
      if (state.status === 'half-open' && state.successes >= mergedConfig.successThreshold) {
        state.status = 'closed';
        state.successes = 0;
        
        logger.info('Circuit breaker closed, service recovered', {
          component: 'load-balancing',
          action: 'execute',
        }, { key });
      }
      
      return result;
    } catch (error) {
      // Failure
      state.failures++;
      state.lastFailureAt = now;
      
      if (state.status === 'half-open') {
        state.status = 'open';
        state.openedAt = now;
        state.successes = 0;
        
        logger.error('Circuit breaker opened from half-open', {
          component: 'load-balancing',
          action: 'execute',
        }, { key }, error as Error);
      } else if (state.failures >= mergedConfig.failureThreshold) {
        state.status = 'open';
        state.openedAt = now;
        
        logger.error('Circuit breaker opened due to failures', {
          component: 'load-balancing',
          action: 'execute',
        }, { key, failures: state.failures, threshold: mergedConfig.failureThreshold }, error as Error);
      }
      
      throw error;
    }
  }
  
  /**
   * Get circuit breaker state
   */
  getStateInfo(key: string): CircuitBreakerState {
    return this.getState(key);
  }
  
  /**
   * Reset circuit breaker
   */
  reset(key: string): void {
    this.states.delete(key);
  }
  
  /**
   * Force open circuit breaker
   */
  forceOpen(key: string): void {
    const state = this.getState(key);
    state.status = 'open';
    state.openedAt = Date.now();
    state.failures = 0;
    state.successes = 0;
  }
  
  /**
   * Force close circuit breaker
   */
  forceClose(key: string): void {
    const state = this.getState(key);
    state.status = 'closed';
    state.failures = 0;
    state.successes = 0;
    state.openedAt = undefined;
  }
}

const circuitBreaker = new CircuitBreaker();

// ─── Health Check Service ───────────────────────────────────────────────────

class HealthCheckService {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();

  private results: Map<string, HealthCheckResult> = new Map();

  private interval?: NodeJS.Timeout;
  
  /**
   * Register a health check
   */
  register(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
  }
  
  /**
   * Run all health checks
   */
  async runAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    
    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await check();
        results.set(name, result);
        this.results.set(name, result);
      } catch (error) {
        const failedResult: HealthCheckResult = {
          service: name,
          status: 'unhealthy',
          latency: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        results.set(name, failedResult);
        this.results.set(name, failedResult);
      }
    }
    
    return results;
  }
  
  /**
   * Get latest health check results
   */
  getResults(): Map<string, HealthCheckResult> {
    return new Map(this.results);
  }
  
  /**
   * Get overall health status
   */
  getOverallStatus(): {
    status: 'healthy' | 'unhealthy' | 'degraded';
    details: Map<string, HealthCheckResult>;
    timestamp: string;
  } {
    const details = this.getResults();
    const statuses = Array.from(details.values()).map(r => r.status);
    
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      status = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      status = 'degraded';
    }
    
    return {
      status,
      details,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 30000): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    this.runAll().catch(error => {
      logger.error('Periodic health check failed', {
        component: 'load-balancing',
        action: 'startPeriodicChecks',
      }, undefined, error);
    });
    
    this.interval = setInterval(() => {
      this.runAll().catch(error => {
        logger.error('Periodic health check failed', {
          component: 'load-balancing',
          action: 'startPeriodicChecks',
        }, undefined, error);
      });
    }, intervalMs);
    
    logger.info('Periodic health checks started', {
      component: 'load-balancing',
      action: 'startPeriodicChecks',
    }, { intervalMs });
  }
  
  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}

const healthCheckService = new HealthCheckService();

// ─── Predefined Health Checks ──────────────────────────────────────────────

// Database health check
healthCheckService.register('database', async () => {
  const startTime = Date.now();
  
  try {
    // Check Supabase connection
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    
    const { error } = await supabase.from('hospitals').select('count');
    const latency = Date.now() - startTime;
    
    if (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        latency,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
    
    return {
      service: 'database',
      status: 'healthy',
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
});

// Redis health check
healthCheckService.register('redis', async () => {
  const startTime = Date.now();
  
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      return {
        service: 'redis',
        status: 'degraded',
        latency: 0,
        message: 'Redis not configured',
        timestamp: new Date().toISOString(),
      };
    }
    
    await redis.ping();
    const latency = Date.now() - startTime;
    
    return {
      service: 'redis',
      status: 'healthy',
      latency,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
});

// ─── Export Utilities ───────────────────────────────────────────────────────

export { rateLimiter, circuitBreaker, healthCheckService };

// ─── Predefined Rate Limit Configs ─────────────────────────────────────────

export const rateLimitConfigs = {
  // API rate limits
  apiRead: {
    scope: 'user' as RateLimitScope,
    maxRequests: 100,
    windowSeconds: 60,
    keyPrefix: 'api-read',
  } as RateLimitConfig,
  
  apiWrite: {
    scope: 'user' as RateLimitScope,
    maxRequests: 30,
    windowSeconds: 60,
    keyPrefix: 'api-write',
  } as RateLimitConfig,
  
  fhirRead: {
    scope: 'user' as RateLimitScope,
    maxRequests: 200,
    windowSeconds: 60,
    keyPrefix: 'fhir-read',
  } as RateLimitConfig,
  
  fhirWrite: {
    scope: 'user' as RateLimitScope,
    maxRequests: 50,
    windowSeconds: 60,
    keyPrefix: 'fhir-write',
  } as RateLimitConfig,
  
  // Authentication rate limits
  auth: {
    scope: 'ip' as RateLimitScope,
    maxRequests: 5,
    windowSeconds: 60,
    keyPrefix: 'auth',
  } as RateLimitConfig,
  
  // AI query rate limits
  aiQuery: {
    scope: 'user' as RateLimitScope,
    maxRequests: 10,
    windowSeconds: 60,
    keyPrefix: 'ai-query',
  } as RateLimitConfig,
};

// ─── Middleware Helpers ─────────────────────────────────────────────────────

export interface RateLimitMiddlewareResult {
  allowed: boolean;
  headers: Record<string, string>;
  retryAfter?: number;
}

export async function withRateLimit(
  request: Request,
  handler: () => Promise<Response>,
  config: RateLimitConfig,
): Promise<Response> {
  // Extract identifier based on scope
  let identifier: string;
  
  switch (config.scope) {
    case 'user':
      identifier = request.headers.get('X-User-ID') || 'anonymous';
      break;
    case 'ip':
      identifier = request.headers.get('X-Forwarded-For') || 
                   request.headers.get('X-Real-IP') || 
                   'unknown';
      break;
    case 'endpoint':
      identifier = new URL(request.url).pathname;
      break;
    case 'hospital':
      identifier = request.headers.get('X-Hospital-ID') || 'unknown';
      break;
    default:
      identifier = 'global';
  }
  
  const result = await rateLimiter.checkLimit(identifier, config);
  const headers = rateLimiter.createRateLimitHeaders(result);
  
  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      component: 'load-balancing',
      action: 'withRateLimit',
    }, { identifier, scope: config.scope });
    
    return new Response(JSON.stringify({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
    }), {
      status: 429,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Execute handler and add rate limit headers to response
  const response = await handler();
  
  // Add rate limit headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

// ─── Connection Pool Configuration ─────────────────────────────────────────

export const connectionPoolConfig = {
  // Database connection pool
  database: {
    max: 20, // Maximum connections
    min: 5, // Minimum connections
    idleTimeoutMs: 30000, // Close idle connections after 30s
    connectionTimeoutMs: 10000, // Timeout for getting connection
  },
  
  // Redis connection pool
  redis: {
    maxRetries: 3,
    retryDelay: 100,
    timeout: 5000,
  },
};

// ─── Traffic Shaping ───────────────────────────────────────────────────────

export interface TrafficPriority {
  path: string | RegExp;
  priority: number; // Higher = more important
  rateLimit?: RateLimitConfig;
}

export const trafficPriorities: TrafficPriority[] = [
  // Critical - emergency and auth endpoints
  { path: '/api/emergency', priority: 100 },
  { path: '/api/auth', priority: 90 },
  { path: '/api/health', priority: 90 },
  
  // High - clinical operations
  { path: '/api/patients', priority: 80 },
  { path: '/api/encounters', priority: 80 },
  { path: '/api/vitals', priority: 80 },
  { path: '/api/prescriptions', priority: 80 },
  
  // Medium - queries and reads
  { path: '/api/fhir', priority: 60 },
  { path: '/api/lab', priority: 60 },
  
  // Low - background and analytics
  { path: '/api/analytics', priority: 30 },
  { path: '/api/reports', priority: 30 },
];

export function getTrafficPriority(path: string): number {
  for (const { path: pattern, priority } of trafficPriorities) {
    if (typeof pattern === 'string' && path.startsWith(pattern)) {
      return priority;
    }
    if (pattern instanceof RegExp && pattern.test(path)) {
      return priority;
    }
  }
  return 50; // Default priority
}

// ─── Initialize ─────────────────────────────────────────────────────────────

// Start periodic health checks in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  healthCheckService.startPeriodicChecks(30000);
}