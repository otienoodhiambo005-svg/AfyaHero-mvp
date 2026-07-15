/**
 * CDN Cache Configuration for Static AI Assets
 * 
 * Provides utilities for configuring CDN caching headers for static assets
 * including AI models, documentation, and other resources.
 */

import { NextResponse } from 'next/server';

interface CacheConfig {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  public?: boolean;
  private?: boolean;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
}

/**
 * Cache configuration presets for different asset types
 */
export const CACHE_PRESETS: Record<string, CacheConfig> = {
  // AI models - long cache since they don't change frequently
  ai_model: {
    maxAge: 86400 * 30, // 30 days
    sMaxAge: 86400 * 30,
    staleWhileRevalidate: 86400 * 7, // 7 days
    public: true,
  },

  // Documentation - medium cache
  documentation: {
    maxAge: 86400 * 7, // 7 days
    sMaxAge: 86400 * 7,
    staleWhileRevalidate: 86400, // 1 day
    public: true,
  },

  // Static assets (images, fonts) - long cache
  static_asset: {
    maxAge: 86400 * 365, // 1 year
    sMaxAge: 86400 * 365,
    staleWhileRevalidate: 86400 * 30, // 30 days
    public: true,
  },

  // API responses that can be cached
  api_cacheable: {
    maxAge: 300, // 5 minutes
    sMaxAge: 300,
    staleWhileRevalidate: 60, // 1 minute
    public: true,
  },

  // Dynamic content - no cache
  dynamic: {
    noCache: true,
    noStore: true,
  },

  // Private user data - no CDN cache
  private: {
    maxAge: 0,
    private: true,
    noCache: true,
  },
};

/**
 * Generate Cache-Control header from config
 */
export function generateCacheControl(config: CacheConfig): string {
  const directives: string[] = [];

  if (config.public) directives.push('public');
  if (config.private) directives.push('private');

  if (config.noCache) {
    directives.push('no-cache');
  }

  if (config.noStore) {
    directives.push('no-store');
  }

  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (config.maxAge) {
    directives.push(`max-age=${config.maxAge}`);
  }

  if (config.sMaxAge) {
    directives.push(`s-maxage=${config.sMaxAge}`);
  }

  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.staleIfError) {
    directives.push(`stale-if-error=${config.staleIfError}`);
  }

  return directives.join(', ');
}

/**
 * Add CDN cache headers to NextResponse
 */
export async function addCDNCacheHeaders(
  response: NextResponse,
  preset: keyof typeof CACHE_PRESETS | CacheConfig
): Promise<NextResponse> {
  const config = typeof preset === 'string' ? CACHE_PRESETS[preset] : preset;
  const cacheControl = generateCacheControl(config);

  response.headers.set('Cache-Control', cacheControl);

  // Add CDN-specific headers
  response.headers.set('CDN-Cache-Control', cacheControl);

  // Add ETag for cache validation
  if (!config.noCache && !config.noStore) {
    const etag = await generateETag(response);
    if (etag) {
      response.headers.set('ETag', etag);
    }
  }

  return response;
}

/**
 * Generate ETag for response
 */
async function generateETag(response: NextResponse): Promise<string | null> {
  try {
    const data = response.headers.get('content-type')?.includes('application/json')
      ? JSON.stringify(await response.clone().json())
      : null;

    if (data) {
      // Simple hash-based ETag
      const hash = Buffer.from(data).toString('base64').substring(0, 16);
      return `"${hash}"`;
    }
  } catch {
    // ETag generation failed
  }

  return null;
}

/**
 * Check if request supports caching
 */
export function isCacheableRequest(req: Request): boolean {
  const method = req.method;
  const cacheControl = req.headers.get('cache-control') || '';

  // Only GET requests are cacheable
  if (method !== 'GET') return false;

  // Check for no-cache directive
  if (cacheControl.includes('no-cache')) return false;

  return true;
}

/**
 * Generate cache key for static assets
 */
export function generateCacheKey(
  path: string,
  version?: string,
  params?: Record<string, string>
): string {
  let key = path;

  if (version) {
    key += `?v=${version}`;
  }

  if (params) {
    const paramString = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    key += version ? '&' : '?';
    key += paramString;
  }

  return key;
}

/**
 * CDN cache middleware for Next.js API routes
 */
export function withCDNCache(
  handler: (req: Request) => Promise<NextResponse>,
  preset: keyof typeof CACHE_PRESETS | CacheConfig = 'api_cacheable'
) {
  return async (req: Request): Promise<NextResponse> => {
    const response = await handler(req);
    return addCDNCacheHeaders(response, preset);
  };
}
