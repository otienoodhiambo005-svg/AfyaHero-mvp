type CacheEntry = {
  status: number;
  payload: unknown;
  expiresAt: number;
};

const inMemoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of inMemoryCache.entries()) {
    if (entry.expiresAt <= now) {
      inMemoryCache.delete(key);
    }
  }
}

export function readIdempotencyCache(key: string): CacheEntry | null {
  cleanupExpired();
  const entry = inMemoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    inMemoryCache.delete(key);
    return null;
  }
  return entry;
}

export function writeIdempotencyCache(
  key: string,
  value: { status: number; payload: unknown },
  ttlMs = DEFAULT_TTL_MS,
): void {
  cleanupExpired();
  inMemoryCache.set(key, {
    status: value.status,
    payload: value.payload,
    expiresAt: Date.now() + ttlMs,
  });
}
/**
 * Idempotency Utilities - Ensure operations can be safely retried
 * 
 * Provides idempotency handling for the AfyaHero Health system including:
 * - Idempotency key generation and validation
 * - Request deduplication
 * - Response caching for idempotent requests
 * - TTL-based cleanup of idempotency keys
 */

import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';
import { logger, measurePerformanceAsync } from './observability';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IdempotencyKey {
  key: string;
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  hospitalId?: string;
  createdAt: number;
  expiresAt: number;
}

export interface IdempotencyRecord {
  key: IdempotencyKey;
  response?: {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  };
  error?: {
    name: string;
    message: string;
  };
  processed: boolean;
  processedAt?: number;
}

export interface IdempotencyConfig {
  ttl: number; // Time to live in seconds
  keyPrefix?: string;
}

// ─── Redis Client ───────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis not configured - idempotency disabled', {
      component: 'idempotency',
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
    logger.error('Failed to initialize Redis client for idempotency', {
      component: 'idempotency',
      action: 'getRedisClient',
    }, undefined, error as Error);
    
    return null;
  }
}

// ─── In-Memory Store ────────────────────────────────────────────────────────

class InMemoryIdempotencyStore {
  private store: Map<string, IdempotencyRecord> = new Map();

  private expiryTimers: Map<string, NodeJS.Timeout> = new Map();
  
  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.store.get(key);
    
    if (!record) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > record.key.expiresAt) {
      this.store.delete(key);
      const timer = this.expiryTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.expiryTimers.delete(key);
      }
      return null;
    }
    
    return record;
  }
  
  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    // Clear existing timer if any
    const existingTimer = this.expiryTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    this.store.set(key, record);
    
    // Set expiry timer
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.expiryTimers.delete(key);
    }, ttlSeconds * 1000);
    
    this.expiryTimers.set(key, timer);
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    const timer = this.expiryTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(key);
    }
  }
  
  async clear(): Promise<void> {
    this.store.clear();
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
  }
  
  async tryAcquire(
    key: string,
    idempotencyKey: IdempotencyKey,
    ttlSeconds: number,
  ): Promise<{ acquired: boolean; existing?: IdempotencyRecord }> {
    const existing = await this.get(key);
    
    if (existing) {
      return { acquired: false, existing };
    }
    
    // Try to acquire the lock
    const newRecord: IdempotencyRecord = {
      key: idempotencyKey,
      processed: false,
    };
    
    await this.set(key, newRecord, ttlSeconds);
    
    return { acquired: true };
  }
}

const inMemoryStore = new InMemoryIdempotencyStore();

// ─── Idempotency Service ────────────────────────────────────────────────────

class IdempotencyService {
  private redis: Redis | null;

  private useRedis: boolean;
  
  constructor() {
    this.redis = getRedisClient();
    this.useRedis = this.redis !== null;
  }
  
  private generateKey(idempotencyKey: string, userId?: string, path?: string): string {
    const baseKey = `${userId || 'anonymous'}:${path || 'api'}:${idempotencyKey}`;
    return `idempotency:${baseKey}`;
  }
  
  /**
   * Generate a unique idempotency key for a request
   */
  generateIdempotencyKey(request: {
    method: string;
    path: string;
    body?: unknown;
    userId?: string;
    timestamp?: number;
  }): string {
    const { method, path, body, userId, timestamp = Date.now() } = request;
    
    // Create a deterministic hash from the request
    const bodyHash = body ? this.hashBody(body) : 'no-body';
    
    return `${method}:${path}:${userId || 'anon'}:${timestamp}:${bodyHash}`;
  }
  
  /**
   * Create an idempotency key record
   */
  createIdempotencyKey(
    key: string,
    request: {
      method: string;
      path: string;
      userId?: string;
      hospitalId?: string;
    },
    config: IdempotencyConfig,
  ): IdempotencyKey {
    return {
      key,
      requestId: randomUUID(),
      method: request.method,
      path: request.path,
      userId: request.userId,
      hospitalId: request.hospitalId,
      createdAt: Date.now(),
      expiresAt: Date.now() + config.ttl * 1000,
    };
  }
  
  /**
   * Try to acquire an idempotency lock
   * Returns true if this is a new request, false if it's a duplicate
   */
  async tryAcquire(
    idempotencyKey: string,
    request: {
      method: string;
      path: string;
      userId?: string;
      hospitalId?: string;
    },
    config: IdempotencyConfig = { ttl: 86400 }, // 24 hours default
  ): Promise<{
    acquired: boolean;
    record?: IdempotencyRecord;
    key: IdempotencyKey;
  }> {
    const fullKey = this.generateKey(idempotencyKey, request.userId, request.path);
    const idempotencyKeyRecord = this.createIdempotencyKey(idempotencyKey, request, config);
    
    return measurePerformanceAsync(
      `idempotency_acquire_${idempotencyKey}`,
      async () => {
        // Try in-memory store first
        const inMemoryResult = await inMemoryStore.tryAcquire(
          fullKey,
          idempotencyKeyRecord,
          config.ttl,
        );
        
        if (!inMemoryResult.acquired && inMemoryResult.existing) {
          logger.info('Idempotency key already processed (in-memory)', {
            component: 'idempotency',
            action: 'tryAcquire',
          }, {
            key: idempotencyKey,
            requestId: inMemoryResult.existing.key.requestId,
            processed: inMemoryResult.existing.processed,
          });
          
          return {
            acquired: false,
            record: inMemoryResult.existing,
            key: idempotencyKeyRecord,
          };
        }
        
        // Try Redis if available
        if (this.useRedis && this.redis) {
          try {
            // Use SETNX for atomic acquire
            const acquired = await this.redis.set(fullKey, JSON.stringify({
              ...idempotencyKeyRecord,
              processed: false,
            }), {
              nx: true, // Only set if not exists
              ex: config.ttl,
            });
            
            if (acquired === 'OK') {
              logger.debug('Idempotency lock acquired (Redis)', {
                component: 'idempotency',
                action: 'tryAcquire',
              }, { key: idempotencyKey });
              
              return {
                acquired: true,
                key: idempotencyKeyRecord,
              };
            }
            
            // Key already exists - get existing record
            const existingData = await this.redis.get<string>(fullKey);
            if (existingData) {
              const existingRecord: IdempotencyRecord = JSON.parse(existingData);
              
              logger.info('Idempotency key already processed (Redis)', {
                component: 'idempotency',
                action: 'tryAcquire',
              }, {
                key: idempotencyKey,
                requestId: existingRecord.key.requestId,
                processed: existingRecord.processed,
              });
              
              return {
                acquired: false,
                record: existingRecord,
                key: idempotencyKeyRecord,
              };
            }
          } catch (error) {
            logger.warn('Redis idempotency acquire failed, using in-memory', {
              component: 'idempotency',
              action: 'tryAcquire',
            }, { key: idempotencyKey, error: (error as Error).message });
          }
        }
        
        if (inMemoryResult.acquired) {
          logger.debug('Idempotency lock acquired (in-memory)', {
            component: 'idempotency',
            action: 'tryAcquire',
          }, { key: idempotencyKey });
        }
        
        return {
          acquired: inMemoryResult.acquired,
          key: idempotencyKeyRecord,
        };
      },
      { component: 'idempotency', action: 'tryAcquire' },
    );
  }
  
  /**
   * Store the response for an idempotency key
   */
  async storeResponse(
    idempotencyKey: string,
    request: {
      method: string;
      path: string;
      userId?: string;
      hospitalId?: string;
    },
    response: {
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    },
    config: IdempotencyConfig = { ttl: 86400 },
  ): Promise<void> {
    const fullKey = this.generateKey(idempotencyKey, request.userId, request.path);
    
    return measurePerformanceAsync(
      `idempotency_store_${idempotencyKey}`,
      async () => {
        const record: IdempotencyRecord = {
          key: this.createIdempotencyKey(idempotencyKey, request, config),
          response,
          processed: true,
          processedAt: Date.now(),
        };
        
        // Update in-memory store
        await inMemoryStore.set(fullKey, record, config.ttl);
        
        // Update Redis if available
        if (this.useRedis && this.redis) {
          try {
            await this.redis.set(fullKey, JSON.stringify(record), {
              xx: true, // Only update if exists
              ex: config.ttl,
            });
            
            logger.debug('Idempotency response stored (Redis)', {
              component: 'idempotency',
              action: 'storeResponse',
            }, { key: idempotencyKey, status: response.status });
          } catch (error) {
            logger.warn('Redis idempotency store failed', {
              component: 'idempotency',
              action: 'storeResponse',
            }, { key: idempotencyKey, error: (error as Error).message });
          }
        }
        
        logger.debug('Idempotency response stored', {
          component: 'idempotency',
          action: 'storeResponse',
        }, { key: idempotencyKey, status: response.status });
      },
      { component: 'idempotency', action: 'storeResponse' },
    );
  }
  
  /**
   * Store an error for an idempotency key
   */
  async storeError(
    idempotencyKey: string,
    request: {
      method: string;
      path: string;
      userId?: string;
      hospitalId?: string;
    },
    error: Error,
    config: IdempotencyConfig = { ttl: 86400 },
  ): Promise<void> {
    const fullKey = this.generateKey(idempotencyKey, request.userId, request.path);
    
    const record: IdempotencyRecord = {
      key: this.createIdempotencyKey(idempotencyKey, request, config),
      error: {
        name: error.name,
        message: error.message,
      },
      processed: true,
      processedAt: Date.now(),
    };
    
    await inMemoryStore.set(fullKey, record, config.ttl);
    
    if (this.useRedis && this.redis) {
      try {
        await this.redis.set(fullKey, JSON.stringify(record), {
          xx: true,
          ex: config.ttl,
        });
      } catch {
        // Silently fail - error storage is best effort
      }
    }
  }
  
  /**
   * Get the cached response for an idempotency key
   */
  async getResponse(
    idempotencyKey: string,
    request: {
      method: string;
      path: string;
      userId?: string;
    },
  ): Promise<{
    found: boolean;
    response?: { status: number; body: unknown; headers?: Record<string, string> };
    error?: { name: string; message: string };
  }> {
    const fullKey = this.generateKey(idempotencyKey, request.userId, request.path);
    
    const record = await inMemoryStore.get(fullKey);
    
    if (record) {
      if (record.response) {
        return {
          found: true,
          response: record.response,
        };
      }
      if (record.error) {
        return {
          found: true,
          error: record.error,
        };
      }
    }
    
    // Try Redis if available
    if (this.useRedis && this.redis) {
      try {
        const redisData = await this.redis.get<string>(fullKey);
        if (redisData) {
          const redisRecord: IdempotencyRecord = JSON.parse(redisData);
          
          if (redisRecord.response) {
            return {
              found: true,
              response: redisRecord.response,
            };
          }
          if (redisRecord.error) {
            return {
              found: true,
              error: redisRecord.error,
            };
          }
        }
      } catch {
        // Silently fail
      }
    }
    
    return { found: false };
  }
  
  /**
   * Delete an idempotency key
   */
  async delete(
    idempotencyKey: string,
    request: {
      userId?: string;
      path?: string;
    },
  ): Promise<void> {
    const fullKey = this.generateKey(idempotencyKey, request.userId, request.path);
    
    await inMemoryStore.delete(fullKey);
    
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch {
        // Silently fail
      }
    }
  }
  
  /**
   * Extract idempotency key from request headers
   */
  extractFromRequest(headers: Headers): string | null {
    return headers.get('Idempotency-Key') || headers.get('X-Idempotency-Key') || null;
  }
  
  /**
   * Create a response for duplicate request
   */
  createDuplicateResponse(originalKey: IdempotencyKey): Response {
    return new Response(JSON.stringify({
      error: 'Duplicate Request',
      message: 'This request has already been processed',
      originalRequestId: originalKey.requestId,
      originalProcessedAt: originalKey.createdAt,
    }), {
      status: 409, // Conflict
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': originalKey.key,
        'X-Original-Request-Id': originalKey.requestId,
      },
    });
  }
  
  /**
   * Create a cached response
   */
  createCachedResponse(response: {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  }, idempotencyKey: string): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-From-Cache': 'true',
    };
    
    if (response.headers) {
      Object.assign(headers, response.headers);
    }
    
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers,
    });
  }
  
  /**
   * Hash request body for idempotency key generation
   */
  private hashBody(body: unknown): string {
    const serialized = JSON.stringify(body);
    
    // Simple hash - in production, use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// ─── Export Singleton ───────────────────────────────────────────────────────

export const idempotency = new IdempotencyService();

// ─── Middleware Helper ──────────────────────────────────────────────────────

export interface IdempotencyMiddlewareResult {
  isDuplicate: boolean;
  cachedResponse?: Response;
  idempotencyKey?: string;
  shouldProceed: boolean;
}

export async function withIdempotency(
  request: Request,
  handler: () => Promise<Response>,
  config: IdempotencyConfig = { ttl: 86400 },
): Promise<Response> {
  const idempotencyKey = idempotency.extractFromRequest(request.headers);
  
  // If no idempotency key, proceed normally
  if (!idempotencyKey) {
    return handler();
  }
  
  const userId = request.headers.get('X-User-ID') || undefined;
  const path = new URL(request.url).pathname;
  
  // Try to acquire lock
  const result = await idempotency.tryAcquire(idempotencyKey, {
    method: request.method,
    path,
    userId,
  }, config);
  
  if (!result.acquired && result.record) {
    // Check if we have a cached response
    const cached = await idempotency.getResponse(idempotencyKey, {
      method: request.method,
      path,
      userId,
    });
    
    if (cached.found && cached.response) {
      logger.info('Returning cached idempotent response', {
        component: 'idempotency',
        action: 'withIdempotency',
      }, { idempotencyKey, status: cached.response.status });
      
      return idempotency.createCachedResponse(cached.response, idempotencyKey);
    }
    
    // If processing but no response yet, return conflict
    if (!result.record.processed) {
      logger.warn('Duplicate request while processing', {
        component: 'idempotency',
        action: 'withIdempotency',
      }, { idempotencyKey });
      
      return idempotency.createDuplicateResponse(result.record.key);
    }
  }
  
  // Execute handler
  try {
    const response = await handler();
    
    // Store successful response
    if (response.ok || response.status < 500) {
      const body = await response.clone().json().catch(() => null);
      
      await idempotency.storeResponse(idempotencyKey, {
        method: request.method,
        path,
        userId,
      }, {
        status: response.status,
        body,
        headers: Object.fromEntries(response.headers),
      }, config);
    }
    
    return response;
  } catch (error) {
    // Store error
    await idempotency.storeError(
      idempotencyKey,
      {
        method: request.method,
        path,
        userId,
      },
      error as Error,
      config,
    );
    
    throw error;
  }
}

// ─── Utility Functions ──────────────────────────────────────────────────────

export function generateIdempotencyKey(
  method: string,
  path: string,
  body?: unknown,
  userId?: string,
): string {
  return idempotency.generateIdempotencyKey({
    method,
    path,
    body,
    userId,
  });
}