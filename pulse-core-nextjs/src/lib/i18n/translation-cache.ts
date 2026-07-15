/**
 * Translation Cache Layer
 * 
 * Provides Redis-backed caching for frequently used translations
 * to minimize API calls and reduce costs.
 * 
 * Cache strategy:
 * - Cache key: `translation:{language}:{term}`
 * - TTL: 7 days for static terms, 1 hour for dynamic content
 * - Batch invalidation when glossary is updated
 */

import { SupportedLanguage } from './translations';

// In-memory fallback cache (used when Redis is unavailable)
const memoryCache = new Map<string, { value: string; expires: number }>();
const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TranslationCacheEntry {
  term: string;
  language: SupportedLanguage;
  translation: string;
  context?: string;
}

/**
 * Generate cache key for a translation
 */
function getCacheKey(term: string, language: SupportedLanguage, context?: string): string {
  return `translation:${language}:${term.toLowerCase().replace(/\s+/g, '_')}${context ? `:${context}` : ''}`;
}

/**
 * Get cached translation from memory cache
 */
function getFromMemoryCache(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Store translation in memory cache
 */
function setInMemoryCache(key: string, value: string, ttlMs: number = MEMORY_TTL_MS): void {
  memoryCache.set(key, {
    value,
    expires: Date.now() + ttlMs,
  });
}

/**
 * Get cached translation
 * Tries Redis first, falls back to memory cache
 */
export async function getCachedTranslation(
  term: string,
  language: SupportedLanguage,
  context?: string
): Promise<string | null> {
  const key = getCacheKey(term, language, context);

  // Try memory cache first (fastest)
  const memoryResult = getFromMemoryCache(key);
  if (memoryResult) return memoryResult;

  // Try Redis if available
  try {
    const { Redis } = await import('@upstash/redis');
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const cached = await redis.get<string>(key);

      if (cached) {
        // Also store in memory cache for faster subsequent access
        setInMemoryCache(key, cached);
        return cached;
      }
    }
  } catch {
    // Redis not available, continue with memory cache only
  }

  return null;
}

/**
 * Store translation in cache
 * Stores in both Redis (if available) and memory cache
 */
export async function setCachedTranslation(
  term: string,
  language: SupportedLanguage,
  translation: string,
  context?: string,
  ttlSeconds: number = 7 * 24 * 60 * 60 // 7 days
): Promise<void> {
  const key = getCacheKey(term, language, context);

  // Store in memory cache
  setInMemoryCache(key, translation, ttlSeconds * 1000);

  // Store in Redis if available
  try {
    const { Redis } = await import('@upstash/redis');
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      await redis.set(key, translation, { ex: ttlSeconds });
    }
  } catch {
    // Redis not available, memory cache only
  }
}

/**
 * Batch cache multiple translations
 */
export async function batchCacheTranslations(
  entries: TranslationCacheEntry[],
  ttlSeconds: number = 7 * 24 * 60 * 60
): Promise<void> {
  const promises = entries.map((entry) =>
    setCachedTranslation(entry.term, entry.language, entry.translation, entry.context, ttlSeconds)
  );

  await Promise.all(promises);
}

/**
 * Invalidate cached translations for a specific language
 */
export async function invalidateLanguageCache(language: SupportedLanguage): Promise<void> {
  // Clear memory cache entries for this language
  const keysToDelete: string[] = [];
  for (const [key] of memoryCache) {
    if (key.startsWith(`translation:${language}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => memoryCache.delete(key));

  // Invalidate Redis keys if available
  try {
    const { Redis } = await import('@upstash/redis');
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      // Simplified invalidation - delete known pattern keys
      // Production should use proper key scanning with SCAN command
      const pattern = `translation:${language}:*`;
       
      let cursor: any = 0;
      do {
         
        const result = await (redis as any).scan(cursor, { match: pattern, count: 100 });
        cursor = result?.[0] ?? 0;
        const keys = result?.[1] ?? [];
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== 0);
    }
  } catch {
    // Redis not available
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { memoryEntries: number; memorySize: string } {
  const memoryEntries = memoryCache.size;
  // Rough estimate of memory usage
  const memorySize = `${Math.round((memoryEntries * 100) / 1024)} KB`;

  return { memoryEntries, memorySize };
}
