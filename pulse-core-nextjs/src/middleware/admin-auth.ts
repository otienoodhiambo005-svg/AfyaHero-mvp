/**
 * Admin Authentication Middleware
 * Provides authentication and authorization for admin API endpoints
 */
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// Admin API routes that require authentication
const ADMIN_ROUTES = [
  '/api/admin/system-health',
  '/api/admin/audit-logs',
  '/api/admin/security-events',
  '/api/admin/users',
];

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

function safeTokenEquals(token: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(token);
  const expectedBytes = encoder.encode(expected);
  const length = Math.max(tokenBytes.length, expectedBytes.length);
  let diff = tokenBytes.length ^ expectedBytes.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (tokenBytes[i] ?? 0) ^ (expectedBytes[i] ?? 0);
  }

  return diff === 0;
}

/**
 * Middleware to authenticate admin API requests
 */
export function adminAuthMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is an admin route
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  // Skip authentication for OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Extract and verify API key from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Check for Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Invalid authorization format. Use: Bearer <token>', code: 'INVALID_AUTH_FORMAT' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Verify token (in production, verify JWT or check against database)
  if (!verifyAdminToken(token)) {
    // Log failed authentication attempt
    logger.warn('Failed admin authentication', {
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1',
      pathname,
    });

    return NextResponse.json(
      { error: 'Invalid or expired token', code: 'AUTH_FAILED' },
      { status: 401 }
    );
  }

  // Add admin user info to request headers for downstream handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-admin-id', 'super_admin');
  requestHeaders.set('x-admin-role', 'super_admin');
  requestHeaders.set('x-admin-email', 'admin@afyahero.com');

  // Allow the request to proceed
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Generate admin API token (for initial setup)
 * In production, this would be handled by an authentication service
 */
export function generateAdminToken(): string {
  if (!ADMIN_API_KEY) {
    throw new Error('ADMIN_API_KEY is not configured');
  }

  return ADMIN_API_KEY;
}

/**
 * Verify admin token
 */
export function verifyAdminToken(token: string): boolean {
  if (!ADMIN_API_KEY) {
    return false;
  }

  return safeTokenEquals(token, ADMIN_API_KEY);
}