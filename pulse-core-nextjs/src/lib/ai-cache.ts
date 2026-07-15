/**
 * AI Response Caching Layer
 * 
 * Provides caching for AI orchestration responses to reduce API calls
 * and improve performance. Uses in-memory cache with configurable TTL.
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

class AICache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: number = 300000; // 5 minutes in milliseconds

  /**
   * Generate cache key from request parameters
   */
  private generateKey(taskType: string, prompt: string, additionalParams: Record<string, unknown> = {}): string {
    const paramsStr = JSON.stringify(additionalParams);
    return `${taskType}:${prompt}:${paramsStr}`;
  }

  /**
   * Get cached response
   */
  get(taskType: string, prompt: string, additionalParams: Record<string, unknown> = {}): unknown | null {
    const key = this.generateKey(taskType, prompt, additionalParams);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached response
   */
  set(taskType: string, prompt: string, data: unknown, ttl?: number, additionalParams: Record<string, unknown> = {}): void {
    const key = this.generateKey(taskType, prompt, additionalParams);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Invalidate cache for a specific task type
   */
  invalidate(taskType?: string): void {
    if (!taskType) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${taskType}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    this.clearExpired();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const aiCache = new AICache();

/**
 * Cache decorator for AI orchestration functions
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    taskType: string;
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const { taskType, ttl, keyGenerator } = options;
    
    // Generate cache key
    let cacheKey: string;
    if (keyGenerator) {
      cacheKey = keyGenerator(...args);
    } else {
      const prompt = args[0] as string;
      const additionalParams = args[1] as Record<string, unknown> || {};
      cacheKey = aiCache['generateKey'](taskType, prompt, additionalParams);
    }

    // Check cache
    const cached = aiCache.get(taskType, cacheKey);
    if (cached) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Cache result
    aiCache.set(taskType, cacheKey, result, ttl);

    return result;
  }) as T;
}

/**
 * Cache TTL constants for different task types
 */
export const CACHE_TTL = {
  DIAGNOSIS: 600000, // 10 minutes - diagnoses don't change rapidly
  PROTOCOL_LOOKUP: 1800000, // 30 minutes - protocols are stable
  DRUG_INTERACTION: 300000, // 5 minutes - drug interactions are relatively stable
  DOCUMENTATION: 120000, // 2 minutes - documentation suggestions
  ALERTS: 60000, // 1 minute - alerts need to be fresh
  POPULATION_HEALTH: 3600000, // 1 hour - population data changes slowly
  DEFAULT: 300000, // 5 minutes - default
};
