import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';
import { decryptAtRest, encryptAtRest } from '@/lib/security-at-rest';

const DEFAULT_TTL_SECONDS = 300;
const MAX_MEMORY_ENTRIES = 500;

type MemoryEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, MemoryEntry<unknown>>();
let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch {
    redisClient = null;
  }

  return redisClient;
}

function pruneMemoryCache() {
  const now = Date.now();

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }

  if (memoryCache.size <= MAX_MEMORY_ENTRIES) {
    return;
  }

  const overflow = memoryCache.size - MAX_MEMORY_ENTRIES;
  let removed = 0;
  for (const key of memoryCache.keys()) {
    memoryCache.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

export function buildPromptCacheKey(...parts: unknown[]): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex');
  return `prompt-cache:${hash}`;
}

export function buildIdempotentCacheKey(baseKey: string, idempotencyKey?: string): string {
  if (!idempotencyKey) return baseKey;
  return `idempotent:${baseKey}:${idempotencyKey}`;
}

export async function getPromptCache<T>(key: string): Promise<T | null> {
  pruneMemoryCache();

  const now = Date.now();
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.value as T;
  }

  if (memoryEntry) {
    memoryCache.delete(key);
  }

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const payload = await redis.get<string>(key);
    if (!payload) {
      return null;
    }

    const decrypted = decryptAtRest(payload);
    const parsed = JSON.parse(decrypted) as T;
    return parsed;
  } catch {
    return null;
  }
}

export async function setPromptCache<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { value, expiresAt });
  pruneMemoryCache();

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const encoded = encryptAtRest(JSON.stringify(value));
    await redis.set(key, encoded, { ex: ttlSeconds });
  } catch {
    // Memory cache already set; ignore distributed cache errors.
  }
}
