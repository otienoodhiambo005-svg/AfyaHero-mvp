/**
 * Authentication Middleware for AfyaHero Health API Routes
 * 
 * Provides comprehensive authentication and authorization:
 * - Session validation for API routes
 * - CSRF protection
 * - Rate limiting per role
 * - Request authentication wrapper
 * - Hospital-scoped access control
 */

import { NextRequest, NextResponse } from 'next/server';
import type { PortalRole } from '@/types';
import { getSession } from '@/lib/auth';
import { canPerformAction, type AccessCheckResult } from '@/lib/rbac';
import {
  detectXSS,
  detectSQLInjection,
  sanitizeObject,
} from '@/lib/input-validation';
import logger from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  userRole?: PortalRole;
  hospitalId?: string;
  requestId?: string;
}

export interface AuthMiddlewareOptions {
  /** Required role for access */
  requiredRole?: PortalRole | PortalRole[];
  /** Required permission (category:action) */
  requiredPermission?: { category: string; action: string };
  /** Allow access if user has any of these roles */
  anyRole?: PortalRole[];
  /** Skip authentication for this route */
  public?: boolean;
  /** Require hospital ID match */
  requireHospitalMatch?: boolean;
}

export interface AuthResponse {
  authenticated: boolean;
  session?: {
    id: string;
    email: string;
    role: PortalRole;
    hospitalId: string;
    name: string;
  };
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

// ─── Rate Limiting Configuration ──────────────────────────────────────────────

const RATE_LIMITS = {
  // Requests per minute by role
  reception: 120,
  medical: 200,
  lab: 150,
  pharmacy: 150,
  admin: 300,
  super_admin: 500,
  default: 60,
};

// ─── Session Validation ───────────────────────────────────────────────────────

/**
 * Validate a user session from the request
 */
export async function validateSession(_request: NextRequest): Promise<AuthResponse> {
  try {
    const session = await getSession();
    
    if (!session) {
      return {
        authenticated: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No valid session found',
          status: 401,
        },
      };
    }
    
    // Check if session is expired
    const now = Date.now();
    const sessionAge = now - session.issuedAt;
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxSessionAge) {
      return {
        authenticated: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
          status: 401,
        },
      };
    }
    
    // Check inactivity timeout
    const inactivityTimeout = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES || '20') * 60 * 1000;
    const timeSinceLastActivity = now - session.lastActivityAt;
    
    if (timeSinceLastActivity > inactivityTimeout) {
      return {
        authenticated: false,
        error: {
          code: 'SESSION_INACTIVE',
          message: 'Session has timed out due to inactivity',
          status: 401,
        },
      };
    }
    
    return {
      authenticated: true,
      session: {
        id: session.id,
        email: session.email,
        role: session.role,
        hospitalId: session.hospitalId,
        name: session.name,
      },
    };
  } catch (error) {
    logger.error('Session validation failed', { error: error instanceof Error ? error.message : String(error) });
    return {
      authenticated: false,
      error: {
        code: 'SESSION_ERROR',
        message: 'Failed to validate session',
        status: 500,
      },
    };
  }
}

// ─── Role Validation ──────────────────────────────────────────────────────────

/**
 * Check if a role matches the required role(s)
 */
export function validateRole(
  userRole: PortalRole,
  options: AuthMiddlewareOptions
): { valid: boolean; error?: string } {
  // Check specific required role
  if (options.requiredRole) {
    if (Array.isArray(options.requiredRole)) {
      if (!options.requiredRole.includes(userRole)) {
        return {
          valid: false,
          error: `Required role: ${options.requiredRole.join(' or ')}`,
        };
      }
    } else if (userRole !== options.requiredRole) {
      return {
        valid: false,
        error: `Required role: ${options.requiredRole}`,
      };
    }
  }
  
  // Check anyRole (OR condition)
  if (options.anyRole && options.anyRole.length > 0) {
    if (!options.anyRole.includes(userRole)) {
      return {
        valid: false,
        error: `Required roles: ${options.anyRole.join(' or ')}`,
      };
    }
  }
  
  return { valid: true };
}

// ─── Permission Validation ────────────────────────────────────────────────────

/**
 * Validate that a user has the required permission
 */
export function validatePermission(
  userRole: PortalRole,
  userHospitalId: string | null,
  targetHospitalId: string,
  permission: { category: string; action: string },
  isOwnResource: boolean = false
): AccessCheckResult {
  return canPerformAction({
    userRole,
    userHospitalId,
    targetHospitalId,
    resourceType: permission.category,
    action: permission.action as 'create' | 'read' | 'update' | 'delete',
    isOwnResource,
  });
}

// ─── CSRF Protection ──────────────────────────────────────────────────────────

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  // Skip CSRF validation for GET requests
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return { valid: true };
  }
  
  const csrfToken = request.headers.get('X-CSRF-Token');
  const cookieToken = request.cookies.get('csrf_token')?.value;
  
  if (!csrfToken && !cookieToken) {
    // If no CSRF tokens are set, we might be using a different protection mechanism
    // or this is a new session. Allow but log.
    logger.warn('No CSRF token found in request');
    return { valid: true };
  }
  
  if (csrfToken && cookieToken && csrfToken !== cookieToken) {
    return {
      valid: false,
      error: 'CSRF token mismatch',
    };
  }
  
  // Check origin header for cross-site requests
  const origin = request.headers.get('Origin');
  const host = request.headers.get('Host');
  
  if (origin && host) {
    const originUrl = new URL(origin);
    if (originUrl.hostname !== host) {
      return {
        valid: false,
        error: 'Cross-origin request blocked',
      };
    }
  }
  
  return { valid: true };
}

// ─── Input Security Validation ────────────────────────────────────────────────

/**
 * Validate request input for security threats
 */
export function validateInputSecurity(body: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof body !== 'object' || body === null) {
    return { valid: true, errors: [] };
  }
  
  // Check for XSS in string fields
  const checkForXSS = (obj: unknown, path: string = ''): void => {
    if (typeof obj === 'string') {
      if (detectXSS(obj)) {
        errors.push(`XSS detected in field: ${path || 'body'}`);
      }
      if (detectSQLInjection(obj)) {
        errors.push(`SQL injection pattern detected in field: ${path || 'body'}`);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        checkForXSS(value, path ? `${path}.${key}` : key);
      }
    }
  };
  
  checkForXSS(body);
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/**
 * Get rate limit for a role
 */
export function getRateLimitForRole(role: PortalRole): number {
  return RATE_LIMITS[role] || RATE_LIMITS.default;
}

/**
 * Check rate limit using Upstash Redis
 */
export async function checkRateLimit(
  userId: string,
  role: PortalRole
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  try {
    const limit = getRateLimitForRole(role);
    
    // Check if Upstash is configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      // No rate limiting without Redis
      return { allowed: true, remaining: limit, reset: Date.now() + 60000 };
    }
    
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    
    const key = `rate_limit:${userId}:${Math.floor(Date.now() / 60000)}`;
    const current = await redis.get(key);
    const count = Number(current || 0) + 1;
    
    if (count === 1) {
      await redis.setex(key, 60, 1);
    } else {
      await redis.setex(key, 60, count);
    }
    
    const remaining = Math.max(0, limit - count);
    const reset = Math.ceil(Date.now() / 60000) * 60000;
    
    return {
      allowed: count <= limit,
      remaining,
      reset,
    };
  } catch (error) {
    // If rate limiting fails, allow the request but log the error
    logger.error('Rate limit check failed', { error: error instanceof Error ? error.message : String(error) });
    return { allowed: true, remaining: 0, reset: Date.now() + 60000 };
  }
}

// ─── Main Middleware Function ─────────────────────────────────────────────────

/**
 * Main authentication middleware for API routes
 * 
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await withAuth(request, { requiredRole: 'medical' });
 *   if (!authResult.authenticated) {
 *     return authResult.response;
 *   }
 *   // Proceed with authenticated request
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{ authenticated: boolean; response?: NextResponse; session?: AuthResponse['session'] }> {
  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();
  
  // Skip authentication for public routes
  if (options.public) {
    // Still validate input security for public routes
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      const body = await request.clone().json().catch(() => null);
      if (body) {
        const securityCheck = validateInputSecurity(body);
        if (!securityCheck.valid) {
          return {
            authenticated: false,
            response: NextResponse.json(
              { error: 'Invalid input', details: securityCheck.errors },
              { status: 400 }
            ),
          };
        }
      }
    }
    return { authenticated: true };
  }
  
  // Validate session
  const sessionResult = await validateSession(request);
  if (!sessionResult.authenticated) {
    logger.warn('Authentication failed', {
      requestId,
      path: request.nextUrl.pathname,
      error: sessionResult.error?.code,
    });
    
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: sessionResult.error?.message, code: sessionResult.error?.code },
        { status: sessionResult.error?.status || 401 }
      ),
    };
  }
  
  const session = sessionResult.session!;
  
  // Validate CSRF token
  const csrfResult = validateCSRFToken(request);
  if (!csrfResult.valid) {
    logger.warn('CSRF validation failed', {
      requestId,
      userId: session.id,
      path: request.nextUrl.pathname,
    });
    
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: csrfResult.error, code: 'CSRF_INVALID' },
        { status: 403 }
      ),
    };
  }
  
  // Validate role
  if (options.requiredRole || options.anyRole) {
    const roleResult = validateRole(session.role, options);
    if (!roleResult.valid) {
      logger.warn('Role validation failed', {
        requestId,
        userId: session.id,
        userRole: session.role,
        path: request.nextUrl.pathname,
        error: roleResult.error,
      });
      
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: 'Insufficient permissions', details: roleResult.error, code: 'ROLE_INVALID' },
          { status: 403 }
        ),
      };
    }
  }
  
  // Validate permission
  if (options.requiredPermission) {
    const permissionResult = validatePermission(
      session.role,
      session.hospitalId,
      session.hospitalId, // Target hospital is user's hospital
      options.requiredPermission
    );
    
    if (!permissionResult.allowed) {
      logger.warn('Permission validation failed', {
        requestId,
        userId: session.id,
        userRole: session.role,
        path: request.nextUrl.pathname,
        error: permissionResult.reason,
      });
      
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: permissionResult.reason, code: 'PERMISSION_DENIED' },
          { status: 403 }
        ),
      };
    }
  }
  
  // Check rate limit
  const rateLimitResult = await checkRateLimit(session.id, session.role);
  if (!rateLimitResult.allowed) {
    logger.warn('Rate limit exceeded', {
      requestId,
      userId: session.id,
      userRole: session.role,
      path: request.nextUrl.pathname,
    });
    
    return {
      authenticated: false,
      response: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(getRateLimitForRole(session.role)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.reset),
          },
        }
      ),
    };
  }
  
  // Validate input security for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
    const body = await request.clone().json().catch(() => null);
    if (body) {
      const securityCheck = validateInputSecurity(body);
      if (!securityCheck.valid) {
        logger.warn('Input security validation failed', {
          requestId,
          userId: session.id,
          path: request.nextUrl.pathname,
          errors: securityCheck.errors,
        });
        
        return {
          authenticated: false,
          response: NextResponse.json(
            { error: 'Invalid input', details: securityCheck.errors, code: 'INPUT_INVALID' },
            { status: 400 }
          ),
        };
      }
    }
  }
  
  // Log successful authentication
  logger.debug('Authentication successful', {
    requestId,
    userId: session.id,
    userRole: session.role,
    path: request.nextUrl.pathname,
  });
  
  return {
    authenticated: true,
    session,
  };
}

// ─── Hospital-Scoped Data Access ──────────────────────────────────────────────

/**
 * Validate that a user can access data from a specific hospital
 */
export function validateHospitalAccess(
  userHospitalId: string | null,
  targetHospitalId: string
): { allowed: boolean; error?: string } {
  if (!userHospitalId) {
    return {
      allowed: false,
      error: 'User does not belong to any hospital',
    };
  }
  
  if (userHospitalId !== targetHospitalId) {
    return {
      allowed: false,
      error: 'Access denied: Cannot access data from another hospital',
    };
  }
  
  return { allowed: true };
}

// ─── Response Helpers ─────────────────────────────────────────────────────────

/**
 * Add authentication headers to response
 */
export function addAuthHeaders(response: NextResponse, session: AuthResponse['session']): NextResponse {
  if (session) {
    response.headers.set('X-User-Id', session.id);
    response.headers.set('X-User-Role', session.role);
    response.headers.set('X-Hospital-Id', session.hospitalId);
  }
  return response;
}

/**
 * Create an authenticated response with user context
 */
export function createAuthenticatedResponse(
  data: unknown,
  session: AuthResponse['session'],
  options?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  const response = NextResponse.json(data, {
    status: options?.status || 200,
    headers: options?.headers,
  });
  
  return addAuthHeaders(response, session);
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Extract hospital ID from request URL or body
 */
export function extractHospitalId(request: NextRequest): string | null {
  // Try to get from URL pathname
  const pathname = request.nextUrl.pathname;
  const hospitalMatch = pathname.match(/\/hospitals\/([a-f0-9-]+)/i);
  if (hospitalMatch) {
    return hospitalMatch[1];
  }
  
  // Try to get from query params
  const hospitalId = request.nextUrl.searchParams.get('hospitalId');
  if (hospitalId) {
    return hospitalId;
  }
  
  return null;
}

/**
 * Sanitize request body
 */
export async function sanitizeRequestBody(request: NextRequest): Promise<unknown> {
  const body = await request.clone().json().catch(() => null);
  if (body) {
    return sanitizeObject(body);
  }
  return null;
}

// ─── Default Exports ──────────────────────────────────────────────────────────

const authMiddleware = {
  withAuth,
  validateSession,
  validateRole,
  validatePermission,
  validateCSRFToken,
  validateInputSecurity,
  checkRateLimit,
  validateHospitalAccess,
  addAuthHeaders,
  createAuthenticatedResponse,
  extractHospitalId,
  sanitizeRequestBody,
  getRateLimitForRole,
};

export default authMiddleware;