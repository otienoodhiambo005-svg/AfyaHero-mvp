/**
 * CORS Configuration Utility for AfyaHero Health
 * 
 * Provides centralized CORS handling for Next.js API routes with:
 * - Environment-based origin allowlisting
 * - Configurable methods, headers, and credentials
 * - Preflight caching
 * - Security-focused defaults for healthcare applications
 * 
 * Usage:
 * ```ts
 * import { withCors, getCorsHeaders } from '@/lib/cors';
 * 
 * // In API route handler:
 * export async function GET(request: NextRequest) {
 *   return withCors(request, NextResponse.json({ data: 'ok' }));
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorsOptions {
  /** Allowed origins. Defaults to environment-configured origins */
  origins?: string[];
  /** Allowed HTTP methods */
  methods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers for client access */
  exposedHeaders?: string[];
  /** Whether to allow credentials */
  credentials?: boolean;
  /** Preflight cache max age in seconds */
  maxAge?: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-CSRF-Token',
  'Accept',
  'Origin',
  'X-Idempotency-Key',
  'X-Request-ID',
];

const DEFAULT_EXPOSED_HEADERS = [
  'Content-Type',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
  'X-Request-ID',
];

const DEFAULT_MAX_AGE = 86400; // 24 hours

/**
 * Get allowed origins from environment configuration
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  
  // Always allow the app's own origin
  if (typeof window !== 'undefined') {
    origins.add(window.location.origin);
  }
  
  // Add configured origins
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    envOrigins.split(',').forEach((origin) => {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    });
  }
  
  // Add public app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) origins.add(appUrl);
  
  // Add app origin
  const appOrigin = process.env.APP_ORIGIN;
  if (appOrigin) origins.add(appOrigin);
  
  // Add Supabase URL (for direct API access)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) origins.add(supabaseUrl);
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://127.0.0.1:3001');
  }
  
  return Array.from(origins);
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null, allowedOrigins?: string[]): boolean {
  if (!origin) return false;
  
  const origins = allowedOrigins ?? getAllowedOrigins();
  
  // Check exact match
  if (origins.includes(origin)) return true;
  
  // Check wildcard patterns
  for (const pattern of origins) {
    if (pattern === '*') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      if (regex.test(origin)) return true;
    }
  }
  
  return false;
}

/**
 * Get CORS headers for a response
 */
export function getCorsHeaders(
  request: NextRequest,
  options: CorsOptions = {}
): Record<string, string> {
  const {
    origins,
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_HEADERS,
    exposedHeaders = DEFAULT_EXPOSED_HEADERS,
    credentials = true,
    maxAge = DEFAULT_MAX_AGE,
  } = options;
  
  const origin = request.headers.get('origin');
  const allowedOrigins = origins ?? getAllowedOrigins();
  
  // Determine the origin to return
  let responseOrigin = '*';
  if (credentials || allowedOrigins.some(o => o !== '*')) {
    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      responseOrigin = origin;
    } else if (allowedOrigins.length === 1) {
      responseOrigin = allowedOrigins[0];
    } else {
      // If no specific origin matches and credentials are required, don't set CORS headers
      if (credentials) {
        return {};
      }
    }
  }
  
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Methods': methods.join(', '),
    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
    'Access-Control-Expose-Headers': exposedHeaders.join(', '),
    'Access-Control-Max-Age': String(maxAge),
  };
  
  if (credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  // Add Vary header when using dynamic origins
  if (responseOrigin !== '*') {
    headers.Vary = 'Origin';
  }
  
  return headers;
}

/**
 * Apply CORS headers to a response
 */
export function applyCorsHeaders(
  response: NextResponse,
  headers: Record<string, string>
): NextResponse {
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Handle CORS preflight requests
 * Returns a preflight response if the request is OPTIONS, null otherwise
 */
export function handlePreflight(
  request: NextRequest,
  options: CorsOptions = {}
): NextResponse | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  
  const headers = getCorsHeaders(request, options);
  
  // If no CORS headers were set, the origin is not allowed
  if (Object.keys(headers).length === 0) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    );
  }
  
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, headers);
}

/**
 * Wrap a response with CORS headers
 * Handles both preflight and regular requests
 */
export function withCors(
  request: NextRequest,
  response: NextResponse,
  options: CorsOptions = {}
): NextResponse {
  // Handle preflight
  if (request.method === 'OPTIONS') {
    const preflight = handlePreflight(request, options);
    if (preflight) return preflight;
  }
  
  // Apply CORS headers to the response
  const headers = getCorsHeaders(request, options);
  if (Object.keys(headers).length > 0) {
    return applyCorsHeaders(response, headers);
  }
  
  return response;
}

/**
 * Create a CORS middleware-style wrapper for API routes
 */
export function createCorsHandler(options: CorsOptions = {}) {
  return {
    /**
     * Handle preflight requests - call at the start of your handler
     */
    preflight(request: NextRequest): NextResponse | null {
      return handlePreflight(request, options);
    },
    
    /**
     * Wrap response with CORS headers - wrap your response with this
     */
    response(request: NextRequest, response: NextResponse): NextResponse {
      return withCors(request, response, options);
    },
    
    /**
     * Get headers for manual application
     */
    getHeaders(request: NextRequest): Record<string, string> {
      return getCorsHeaders(request, options);
    },
  };
}

/**
 * Validate CORS configuration
 * Returns validation result with any configuration issues
 */
export function validateCorsConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check for wildcard in production with credentials
  if (process.env.NODE_ENV === 'production') {
    const origins = getAllowedOrigins();
    if (origins.includes('*')) {
      warnings.push('CORS wildcard (*) is used with credentials enabled. This is a security risk.');
    }
    
    // Check if ALLOWED_ORIGINS is set
    if (!process.env.ALLOWED_ORIGINS && !process.env.NEXT_PUBLIC_APP_URL) {
      warnings.push('No explicit CORS origins configured. Only default origins will be allowed.');
    }
  }
  
  // Check for common misconfigurations
  const maxAge = parseInt(process.env.CORS_MAX_AGE ?? '86400', 10);
  if (maxAge > 604800) {
    warnings.push('CORS max-age exceeds 7 days. Some browsers may ignore values this high.');
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// ─── Preset Configurations ────────────────────────────────────────────────────

/** Strict CORS for sensitive endpoints (auth, admin) */
export const strictCorsOptions: CorsOptions = {
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  maxAge: 3600, // 1 hour
  exposedHeaders: ['Content-Type', 'X-Request-ID'],
};

/** Standard CORS for general API endpoints */
export const standardCorsOptions: CorsOptions = {
  methods: DEFAULT_METHODS,
  credentials: true,
  maxAge: 86400, // 24 hours
};

/** Relaxed CORS for public/read-only endpoints */
export const publicCorsOptions: CorsOptions = {
  methods: ['GET', 'OPTIONS', 'HEAD'],
  credentials: false,
  maxAge: 604800, // 7 days
};

/** FHIR-compliant CORS for healthcare interoperability */
export const fhirCorsOptions: CorsOptions = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    ...DEFAULT_HEADERS,
    'Prefer',
    'If-Match',
    'If-None-Match',
    'X-FHIR-Version',
  ],
  exposedHeaders: [
    ...DEFAULT_EXPOSED_HEADERS,
    'ETag',
    'Last-Modified',
    'Location',
    'Preference-Applied',
    'Content-Location',
  ],
  credentials: true,
  maxAge: 86400,
};