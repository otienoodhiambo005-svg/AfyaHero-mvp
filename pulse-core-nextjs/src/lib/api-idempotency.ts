const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/;

export const DEFAULT_API_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CachedApiResponse<TPayload> = {
  payload: TPayload;
  expiresAt: number;
};

type ValidateIdempotencyKeyResult = {
  key: string | null;
  isValid: boolean;
  reason?: 'missing' | 'too_short' | 'too_long' | 'invalid_format';
};

const responseCache = new Map<string, CachedApiResponse<unknown>>();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [cacheKey, entry] of responseCache.entries()) {
    if (entry.expiresAt <= now) {
      responseCache.delete(cacheKey);
    }
  }
}

export function validateIdempotencyKey(
  rawKey: string | null | undefined,
): ValidateIdempotencyKeyResult {
  const key = rawKey?.trim() ?? '';
  if (!key) {
    return { key: null, isValid: false, reason: 'missing' };
  }
  if (key.length < IDEMPOTENCY_KEY_MIN_LENGTH) {
    return { key, isValid: false, reason: 'too_short' };
  }
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return { key, isValid: false, reason: 'too_long' };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { key, isValid: false, reason: 'invalid_format' };
  }
  return { key, isValid: true };
}

export function buildApiIdempotencyScopeKey(input: {
  scope: string;
  idempotencyKey: string;
  actorKey: string;
}): string {
  return `${input.scope}:${input.idempotencyKey}:${input.actorKey}`;
}

export function getCachedIdempotentResponse<TPayload>(
  scopedCacheKey: string,
): TPayload | null {
  cleanupExpiredEntries();
  const entry = responseCache.get(scopedCacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(scopedCacheKey);
    return null;
  }
  return entry.payload as TPayload;
}

export function cacheIdempotentSuccessResponse<TPayload>(
  scopedCacheKey: string,
  payload: TPayload,
  ttlMs = DEFAULT_API_IDEMPOTENCY_TTL_MS,
): void {
  cleanupExpiredEntries();
  responseCache.set(scopedCacheKey, {
    payload,
    expiresAt: Date.now() + Math.max(1, ttlMs),
  });
}
