/**
 * Next.js Proxy for AfyaHero Health
 *
 * Handles:
 * - CORS headers for all API routes
 * - Security headers
 * - Request tracing
 * - Origin validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { isOriginAllowed, handlePreflight, standardCorsOptions, fhirCorsOptions } from '@/lib/cors';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';

// Paths that should use FHIR-specific CORS
const FHIR_PATHS = ['/api/fhir'];

// Paths that should use standard CORS
const API_PATHS = ['/api'];

// Paths excluded from CORS (static assets, images, etc.)
const EXCLUDED_PATHS = [
  '/_next/static',
  '/_next/image',
  '/images',
  '/icons',
  '/favicon',
];

const SUPERADMIN_AUTH_PAGE_PREFIXES = [
  '/auth/superadmin',
  '/auth/reset-password',
];

const SUPERADMIN_API_PREFIXES = [
  '/api/admin',
  '/api/health',
  '/api/settings',
  '/api/superadmin',
];

const SUPERADMIN_AUTH_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/2fa/verify',
];

const SUPERADMIN_BLOCKED_PAGE_PREFIXES = [
  '/demo',
  '/portal/superadmin/demo',
];

const SUPERADMIN_BLOCKED_API_PREFIXES = [
  '/api/auth/demo-',
  '/api/admin/demo',
];

const hasPrefix = (pathname: string, prefixes: readonly string[]): boolean => (
  prefixes.some((prefix) => pathname.startsWith(prefix))
);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths
  if (EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (isStandaloneSuperAdminMode()) {
    if (pathname === '/' || pathname === '/auth/login') {
      return NextResponse.redirect(new URL('/auth/superadmin/login', request.url));
    }

    if (hasPrefix(pathname, SUPERADMIN_BLOCKED_PAGE_PREFIXES)) {
      return NextResponse.redirect(new URL('/portal/superadmin', request.url));
    }

    if (hasPrefix(pathname, SUPERADMIN_BLOCKED_API_PREFIXES)) {
      return NextResponse.json(
        { error: 'Endpoint unavailable in standalone superadmin mode.' },
        { status: 403 },
      );
    }

    if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/superadmin')) {
      return NextResponse.redirect(new URL('/portal/superadmin', request.url));
    }

    if (pathname.startsWith('/auth') && !hasPrefix(pathname, SUPERADMIN_AUTH_PAGE_PREFIXES)) {
      return NextResponse.redirect(new URL('/auth/superadmin/login', request.url));
    }

    if (pathname.startsWith('/api/auth') && !hasPrefix(pathname, SUPERADMIN_AUTH_API_PREFIXES)) {
      return NextResponse.json(
        { error: 'Endpoint unavailable in standalone superadmin mode.' },
        { status: 403 },
      );
    }

    if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth') && !hasPrefix(pathname, SUPERADMIN_API_PREFIXES)) {
      return NextResponse.json(
        { error: 'Endpoint unavailable in standalone superadmin mode.' },
        { status: 403 },
      );
    }
  }

  // Handle preflight requests for API routes
  if (request.method === 'OPTIONS' && API_PATHS.some(path => pathname.startsWith(path))) {
    const corsOptions = FHIR_PATHS.some(path => pathname.startsWith(path))
      ? fhirCorsOptions
      : standardCorsOptions;

    const preflightResponse = handlePreflight(request, corsOptions);
    if (preflightResponse) {
      return preflightResponse;
    }
  }

  // Add request ID for tracing
  const requestId = request.headers.get('X-Request-ID') ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-Request-ID', requestId);

  // For non-OPTIONS requests, we'll add CORS headers via response manipulation
  // This is handled in individual route handlers using withCors()

  // Add security headers to all responses and propagate request headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  // X-XSS-Protection is deprecated; CSP handles XSS protection
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(self)');

  response.headers.set('X-Request-ID', requestId);

  // Log CORS-related requests in development
  if (process.env.NODE_ENV === 'development' && request.headers.get('origin')) {
    const origin = request.headers.get('origin');
    const isAllowed = isOriginAllowed(origin);
    // console.log(`[CORS] ${request.method} ${pathname} - Origin: ${origin} - Allowed: ${isAllowed}`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
