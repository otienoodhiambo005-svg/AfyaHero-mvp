/**
 * Caching Utilities - Redis-based caching with fallback strategies
 * 
 * Provides comprehensive caching for the AfyaHero Health system including:
 * - Redis caching via Upstash
 * - In-memory caching for frequently accessed data
 * - Cache invalidation strategies
 * - Cache warming capabilities
 * - Distributed cache coordination
 */

import { Redis } from '@upstash/redis';
import { logger, measurePerformanceAsync } from './observability';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CacheStrategy = 'cache-aside' | 'write-through' | 'write-behind' | 'refresh-ahead';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  version?: string;
}

export interface CacheConfig<T> {
  ttl: number; // Time to live in seconds
  strategy?: CacheStrategy;
  tags?: string[];
  version?: string;
  serialize?: (data: T) => string;
  deserialize?: (data: string) => T;
  staleWhileRevalidate?: number; // Allow stale data while revalidating
  keyPrefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  evictions: number;
  hitRate: number;
  avgLatency: number;
}

// ─── Redis Client ───────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    logger.warn('Redis not configured - caching disabled', {
      component: 'cache',
      action: 'getRedisClient',
    });
    return null;
  }
  
  try {
    redisClient = new Redis({
      url,
      token,
      automaticDeserialization: false,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.min(100 * Math.pow(2, retryCount), 5000),
      },
    });
    
    logger.info('Redis client initialized', {
      component: 'cache',
      action: 'getRedisClient',
    });
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client', {
      component: 'cache',
      action: 'getRedisClient',
    }, undefined, error as Error);
    
    return null;
  }
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────

class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    evictions: 0,
    hitRate: 0,
    avgLatency: 0,
  };

  private maxItems: number = 1000;
  
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }
      
      // Check if expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        this.stats.evictions++;
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      this.updateLatency(startTime);
      
      return entry.data as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('In-memory cache get error', {
        component: 'cache',
        action: 'get',
      }, { key }, error as Error);
      
      return null;
    }
  }
  
  async set<T>(key: string, data: T, config: CacheConfig<T>): Promise<void> {
    try {
      // Evict oldest items if at capacity
      if (this.cache.size >= this.maxItems) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
          this.stats.evictions++;
        }
      }
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: config.ttl,
        tags: config.tags,
        version: config.version,
      };
      
      this.cache.set(key, entry);
      
      logger.debug('In-memory cache set', {
        component: 'cache',
        action: 'set',
      }, { key, ttl: config.ttl, tags: config.tags });
    } catch (error) {
      this.stats.errors++;
      logger.error('In-memory cache set error', {
        component: 'cache',
        action: 'set',
      }, { key }, error as Error);
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      this.cache.delete(key);
      
      logger.debug('In-memory cache delete', {
        component: 'cache',
        action: 'delete',
      }, { key });
    } catch (error) {
      this.stats.errors++;
      logger.error('In-memory cache delete error', {
        component: 'cache',
        action: 'delete',
      }, { key }, error as Error);
    }
  }
  
  async deleteByTag(tag: string): Promise<void> {
    try {
      let deleted = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags?.includes(tag)) {
          this.cache.delete(key);
          deleted++;
        }
      }
      
      logger.debug('In-memory cache delete by tag', {
        component: 'cache',
        action: 'deleteByTag',
      }, { tag, deleted });
    } catch (error) {
      this.stats.errors++;
      logger.error('In-memory cache delete by tag error', {
        component: 'cache',
        action: 'deleteByTag',
      }, { tag }, error as Error);
    }
  }
  
  async clear(): Promise<void> {
    try {
      this.cache.clear();
      
      logger.info('In-memory cache cleared', {
        component: 'cache',
        action: 'clear',
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('In-memory cache clear error', {
        component: 'cache',
        action: 'clear',
      }, undefined, error as Error);
    }
  }
  
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }
  
  private updateLatency(startTime: number) {
    const latency = performance.now() - startTime;
    // Simple moving average
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgLatency = this.stats.avgLatency * ((totalRequests - 1) / totalRequests) + latency / totalRequests;
  }
}

const inMemoryCache = new InMemoryCache();

// ─── Cache Service ──────────────────────────────────────────────────────────

class CacheService {
  private redis: Redis | null;

  private useRedis: boolean;
  
  constructor() {
    this.redis = getRedisClient();
    this.useRedis = this.redis !== null;
  }
  
  private generateKey(key: string, prefix?: string): string {
    const baseKey = prefix ? `${prefix}:${key}` : key;
    return `afyahero:${baseKey}`;
  }
  
  private serialize<T>(data: T, customSerializer?: (data: T) => string): string {
    if (customSerializer) {
      return customSerializer(data);
    }
    return JSON.stringify(data);
  }
  
  private deserialize<T>(data: string, customDeserializer?: (data: string) => T): T {
    if (customDeserializer) {
      return customDeserializer(data);
    }
    try {
      return JSON.parse(data) as T;
    } catch {
      return null as T;
    }
  }
  
  async get<T>(
    key: string,
    config: CacheConfig<T>,
  ): Promise<T | null> {
    const fullKey = this.generateKey(key, config.keyPrefix);
    
    return measurePerformanceAsync(
      `cache_get_${key}`,
      async () => {
        // Try in-memory cache first
        const inMemoryResult = await inMemoryCache.get<T>(fullKey);
        if (inMemoryResult !== null) {
          return inMemoryResult;
        }
        
        // Try Redis if available
        if (this.useRedis && this.redis) {
          try {
            const redisResult = await this.redis.get<string>(fullKey);
            
            if (redisResult) {
              const deserialized = config.deserialize 
                ? config.deserialize(redisResult)
                : this.deserialize<T>(redisResult);
              
              // Populate in-memory cache
              await inMemoryCache.set(fullKey, deserialized, config);
              
              logger.debug('Cache hit (Redis)', {
                component: 'cache',
                action: 'get',
              }, { key: fullKey });
              
              return deserialized;
            }
          } catch (error) {
            logger.warn('Redis get failed, falling back to in-memory', {
              component: 'cache',
              action: 'get',
            }, { key: fullKey, error: error instanceof Error ? error.message : String(error) });
          }
        }
        
        logger.debug('Cache miss', {
          component: 'cache',
          action: 'get',
        }, { key: fullKey });
        
        return null;
      },
      { component: 'cache', action: 'get' },
    );
  }
  
  async set<T>(
    key: string,
    data: T,
    config: CacheConfig<T>,
  ): Promise<void> {
    const fullKey = this.generateKey(key, config.keyPrefix);
    
    return measurePerformanceAsync(
      `cache_set_${key}`,
      async () => {
        // Always update in-memory cache
        await inMemoryCache.set(fullKey, data, config);
        
        // Update Redis if available
        if (this.useRedis && this.redis) {
          try {
            const serialized = config.serialize
              ? config.serialize(data)
              : this.serialize(data);
            
            await this.redis.set(fullKey, serialized, { ex: config.ttl });
            
            // Index by tags for tag-based invalidation
            if (config.tags && config.tags.length > 0) {
              const tagKeys = config.tags.map(tag => `tag:${tag}`);
              // Add the key to each tag set
              await Promise.all(tagKeys.map(tagKey => 
                this.redis!.sadd(tagKey, fullKey)
              ));
              // Set expiry on tag sets
              await Promise.all(tagKeys.map(tagKey => 
                this.redis!.expire(tagKey, config.ttl + 60) // Slightly longer than data TTL
              ));
            }
            
            logger.debug('Cache set (Redis)', {
              component: 'cache',
              action: 'set',
            }, { key: fullKey, ttl: config.ttl, tags: config.tags });
          } catch (error) {
            logger.warn('Redis set failed, using in-memory only', {
              component: 'cache',
              action: 'set',
            }, { key: fullKey, error: error instanceof Error ? error.message : String(error) });
          }
        }
      },
      { component: 'cache', action: 'set' },
    );
  }
  
  async delete(key: string, prefix?: string): Promise<void> {
    const fullKey = this.generateKey(key, prefix);
    
    return measurePerformanceAsync(
      `cache_delete_${key}`,
      async () => {
        // Delete from in-memory cache
        await inMemoryCache.delete(fullKey);
        
        // Delete from Redis if available
        if (this.useRedis && this.redis) {
          try {
            await this.redis.del(fullKey);
            
            logger.debug('Cache delete (Redis)', {
              component: 'cache',
              action: 'delete',
            }, { key: fullKey });
          } catch (error) {
            logger.warn('Redis delete failed', {
              component: 'cache',
              action: 'delete',
            }, { key: fullKey, error: error instanceof Error ? error.message : String(error) });
          }
        }
      },
      { component: 'cache', action: 'delete' },
    );
  }
  
  async deleteByTag(tag: string): Promise<void> {
    return measurePerformanceAsync(
      `cache_deleteByTag_${tag}`,
      async () => {
        // Delete from in-memory cache by tag
        await inMemoryCache.deleteByTag(tag);
        
        // Delete from Redis if available
        if (this.useRedis && this.redis) {
          try {
            const tagKey = `tag:${tag}`;
            const keys = await this.redis.smembers(tagKey);
            
            if (keys.length > 0) {
              await this.redis.del(...keys);
              await this.redis.del(tagKey);
              
              logger.debug('Cache delete by tag (Redis)', {
                component: 'cache',
                action: 'deleteByTag',
              }, { tag, deletedCount: keys.length });
            }
          } catch (error) {
            logger.warn('Redis delete by tag failed', {
              component: 'cache',
              action: 'deleteByTag',
            }, { tag, error: error instanceof Error ? error.message : String(error) });
          }
        }
      },
      { component: 'cache', action: 'deleteByTag' },
    );
  }
  
  async clear(): Promise<void> {
    return measurePerformanceAsync(
      'cache_clear',
      async () => {
        // Clear in-memory cache
        await inMemoryCache.clear();
        
        // Clear Redis if available
        if (this.useRedis && this.redis) {
          try {
            // Use SCAN to find and delete all keys with our prefix
            const cursor = 0;
            const keysToDelete: string[] = [];
            
            do {
              const result = await this.redis.scan(cursor, {
                match: 'afyahero:*',
                count: 100,
              });
              
              if (result[1].length > 0) {
                keysToDelete.push(...result[1]);
              }
              
              if (result[0] === '0') break;
            } while (true);
            
            if (keysToDelete.length > 0) {
              await this.redis.del(...keysToDelete);
              
              logger.info('Cache cleared (Redis)', {
                component: 'cache',
                action: 'clear',
              }, { deletedCount: keysToDelete.length });
            }
          } catch (error) {
            logger.error('Redis clear failed', {
              component: 'cache',
              action: 'clear',
            }, undefined, error as Error);
          }
        }
      },
      { component: 'cache', action: 'clear' },
    );
  }
  
  async getStats(): Promise<{
    inMemory: CacheStats;
    redis: { connected: boolean; mode: string };
  }> {
    const inMemoryStats = inMemoryCache.getStats();
    
    let redisInfo = { connected: false, mode: 'disabled' };
    
    if (this.useRedis && this.redis) {
      try {
        // Use a simple ping to check connectivity
        await this.redis.ping();
        redisInfo = { connected: true, mode: 'redis' };
      } catch {
        redisInfo = { connected: false, mode: 'error' };
      }
    }
    
    return {
      inMemory: inMemoryStats,
      redis: redisInfo,
    };
  }
  
  // ─── Cache-Aside Pattern ──────────────────────────────────────────────
  
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig<T>,
  ): Promise<T> {
    const _fullKey = this.generateKey(key, config.keyPrefix);
    
    return measurePerformanceAsync(
      `cache_getOrSet_${key}`,
      async () => {
        // Try to get from cache
        const cached = await this.get(key, config);
        if (cached !== null) {
          return cached;
        }
        
        // Fetch fresh data
        const data = await fetcher();
        
        // Store in cache
        await this.set(key, data, config);
        
        return data;
      },
      { component: 'cache', action: 'getOrSet' },
    );
  }
  
  // ─── Stale-While-Revalidate Pattern ───────────────────────────────────
  
  async getStaleWhileRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig<T>,
  ): Promise<{ data: T; isStale: boolean }> {
    const fullKey = this.generateKey(key, config.keyPrefix);
    
    return measurePerformanceAsync(
      `cache_swr_${key}`,
      async () => {
        const cached = await this.get(key, config);
        
        if (cached !== null) {
          // Check if we should revalidate in background
          const entry = await inMemoryCache.get<CacheEntry<T>>(fullKey);
          const shouldRevalidate = config.staleWhileRevalidate && entry && 
            (Date.now() - entry.timestamp) > (config.ttl * 1000);
          
          if (shouldRevalidate) {
            // Trigger background revalidation (fire and forget)
            fetcher().then(freshData => {
              this.set(key, freshData, config).catch(error => {
                logger.error('Background cache revalidation failed', {
                  component: 'cache',
                  action: 'swr',
                }, { key: fullKey, error: error instanceof Error ? error.message : String(error) });
              });
            }).catch(error => {
              logger.error('Background cache revalidation fetch failed', {
                component: 'cache',
                action: 'swr',
              }, { key: fullKey, error: error instanceof Error ? error.message : String(error) });
            });
          }
          
          return { data: cached, isStale: Boolean(shouldRevalidate) };
        }
        
        // Cache miss - fetch fresh data
        const data = await fetcher();
        await this.set(key, data, config);
        
        return { data, isStale: false };
      },
      { component: 'cache', action: 'swr' },
    );
  }
  
  // ─── Cache Warming ────────────────────────────────────────────────────
  
  async warmCache<T>(
    key: string,
    data: T,
    config: CacheConfig<T>,
  ): Promise<void> {
    logger.info('Warming cache', {
      component: 'cache',
      action: 'warm',
    }, { key, ttl: config.ttl });
    
    await this.set(key, data, config);
  }
  
  async warmMultiple<T>(
    items: Array<{ key: string; data: T; config?: Partial<CacheConfig<T>> }>,
    defaultConfig: CacheConfig<T>,
  ): Promise<void> {
    logger.info('Warming multiple cache entries', {
      component: 'cache',
      action: 'warmMultiple',
    }, { count: items.length });
    
    await Promise.all(
      items.map(item => {
        const config = { ...defaultConfig, ...item.config };
        return this.set(item.key, item.data, config);
      }),
    );
  }
}

// ─── Export Singleton ───────────────────────────────────────────────────────

export const cache = new CacheService();

// ─── Convenience Functions ──────────────────────────────────────────────────

export async function getCached<T>(
  key: string,
  config: CacheConfig<T>,
): Promise<T | null> {
  return cache.get(key, config);
}

export async function setCached<T>(
  key: string,
  data: T,
  config: CacheConfig<T>,
): Promise<void> {
  return cache.set(key, data, config);
}

export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: CacheConfig<T>,
): Promise<T> {
  return cache.getOrSet(key, fetcher, config);
}

export async function invalidateCache(key: string, prefix?: string): Promise<void> {
  return cache.delete(key, prefix);
}

export async function invalidateCacheByTag(tag: string): Promise<void> {
  return cache.deleteByTag(tag);
}

// ─── Common Cache Configurations ────────────────────────────────────────────

export const cacheConfigs = {
  // FHIR resources - short TTL for clinical data freshness
  fhirResource: (resourceType: string) => ({
    ttl: 300, // 5 minutes
    keyPrefix: 'fhir',
    tags: ['fhir', resourceType.toLowerCase()],
  }) as CacheConfig<unknown>,
  
  // User sessions - medium TTL
  userSession: {
    ttl: 1800, // 30 minutes
    keyPrefix: 'session',
    tags: ['session'],
  } as CacheConfig<unknown>,
  
  // Formulary data - longer TTL (changes infrequently)
  formulary: {
    ttl: 3600, // 1 hour
    keyPrefix: 'formulary',
    tags: ['formulary', 'drugs'],
  } as CacheConfig<unknown>,
  
  // Inventory data - short TTL (changes frequently)
  inventory: {
    ttl: 120, // 2 minutes
    keyPrefix: 'inventory',
    tags: ['inventory'],
  } as CacheConfig<unknown>,
  
  // Patient data - medium TTL with privacy considerations
  patient: (patientId: string) => ({
    ttl: 600, // 10 minutes
    keyPrefix: 'patient',
    tags: ['patient', `patient:${patientId}`],
  }) as CacheConfig<unknown>,
  
  // Metadata and capabilities - long TTL
  metadata: {
    ttl: 3600, // 1 hour
    keyPrefix: 'metadata',
    tags: ['metadata'],
  } as CacheConfig<unknown>,
};

// ─── Cache Middleware for API Routes ────────────────────────────────────────

export function createCacheMiddleware<T>(
  keyGenerator: (req: any) => string,
  config: CacheConfig<T>,
  shouldCache?: (req: any, res: any) => boolean,
) {
  return async (req: any, next: () => Promise<T>): Promise<T> => {
    // Check if we should cache this request
    if (shouldCache && !shouldCache(req, null)) {
      return next();
    }
    
    const key = keyGenerator(req);
    
    return getOrSetCached(key, next, config);
  };
}