/**
 * Security Headers Utility
 * 
 * Provides utilities for adding security headers to API responses
 * to protect against common web vulnerabilities.
 */

import { NextResponse } from 'next/server';

interface SecurityHeadersConfig {
  enableStrictTransportSecurity?: boolean;
  enableXFrameOptions?: boolean;
  enableXContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
  enablePermissionsPolicy?: boolean;
  enableCSP?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Default security headers configuration
 */
const DEFAULT_CONFIG: SecurityHeadersConfig = {
  enableStrictTransportSecurity: process.env.NODE_ENV === 'production',
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
  enableCSP: false, // CSP should be configured per application
  customHeaders: {},
};

/**
 * Add security headers to a NextResponse
 */
export function addSecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = DEFAULT_CONFIG
): NextResponse {
  const {
    enableStrictTransportSecurity,
    enableXFrameOptions,
    enableXContentTypeOptions,
    enableReferrerPolicy,
    enablePermissionsPolicy,
    enableCSP,
    customHeaders,
  } = { ...DEFAULT_CONFIG, ...config };

  // Strict-Transport-Security (HSTS)
  if (enableStrictTransportSecurity) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // X-Frame-Options (prevent clickjacking)
  if (enableXFrameOptions) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  // X-Content-Type-Options (prevent MIME sniffing)
  if (enableXContentTypeOptions) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // Referrer-Policy
  if (enableReferrerPolicy) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // Permissions-Policy (formerly Feature-Policy)
  if (enablePermissionsPolicy) {
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );
  }

  // Content-Security-Policy (basic CSP for API responses)
  if (enableCSP) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    );
  }

  // X-XSS-Protection (legacy, but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Custom headers
  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

/**
 * Pre-configured security headers for different environments
 */
export const SECURITY_HEADERS_PRESETS: Record<string, SecurityHeadersConfig> = {
  production: {
    enableStrictTransportSecurity: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    enableCSP: true,
  },
  development: {
    enableStrictTransportSecurity: false,
    enableXFrameOptions: false,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    enableCSP: false,
  },
  api: {
    enableStrictTransportSecurity: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: false,
    enableCSP: false,
    customHeaders: {
      'X-API-Version': '1.0.0',
    },
  },
};

/**
 * Middleware helper to add security headers
 */
export function withSecurityHeaders(
  handler: (req: Request) => Promise<NextResponse>,
  preset: keyof typeof SECURITY_HEADERS_PRESETS | SecurityHeadersConfig = 'api'
) {
  const config = typeof preset === 'string' ? SECURITY_HEADERS_PRESETS[preset] : preset;

  return async (req: Request): Promise<NextResponse> => {
    const response = await handler(req);
    return addSecurityHeaders(response, config);
  };
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(
  response: NextResponse,
  options: {
    origin?: string | string[];
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  } = {}
): NextResponse {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

  response.headers.set('Access-Control-Allow-Origin', Array.isArray(origin) ? origin.join(', ') : origin);
  response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  response.headers.set('Access-Control-Max-Age', maxAge.toString());

  if (credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Add AI-specific security headers
 */
export function addAISecurityHeaders(response: NextResponse): NextResponse {
  // Add headers specific to AI endpoints
  response.headers.set('X-AI-Provider', 'AfyaHero-AI');
  response.headers.set('X-AI-Version', '1.0.0');
  response.headers.set('X-Content-Source', 'AI-Generated');

  // Add rate limit info if available
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-RateLimit-Remaining', '99');
  response.headers.set('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());

  return response;
}
