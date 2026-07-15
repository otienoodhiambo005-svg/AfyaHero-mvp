/**
 * Authentication and Tenant Resolution Middleware
 *
 * Wraps Next.js route handlers to enforce:
 *   1. Session authentication (signed cookie or Bearer token)
 *   2. Role-based authorization (user must have an allowed role)
 *   3. Tenant resolution from session (never from query params)
 *
 * Usage:
 *   export const GET = withAuthzAndTenant(async (req, ctx) => { ... }, ['admin']);
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';
import type { PortalRole } from '@/types';

const HOSPITAL_TENANT_ROLES = ['reception', 'medical', 'lab', 'pharmacy', 'admin'] as const satisfies readonly PortalRole[];
const INVALID_HOSPITAL_IDS = new Set(['unknown', 'null', 'undefined']);

type HospitalTenantRole = (typeof HOSPITAL_TENANT_ROLES)[number];

export interface AuthzContext {
  hospitalId: string;
  userId: string;
  role: HospitalTenantRole;
}

type ProtectedHandler = (
  req: NextRequest,
  context: AuthzContext
) => Promise<NextResponse>;

function isHospitalTenantRole(role: unknown): role is HospitalTenantRole {
  return typeof role === 'string' && HOSPITAL_TENANT_ROLES.includes(role as HospitalTenantRole);
}

function normalizeHospitalId(hospitalId: unknown): string | null {
  if (typeof hospitalId !== 'string') {
    return null;
  }

  const normalized = hospitalId.trim();
  if (!normalized || INVALID_HOSPITAL_IDS.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
}

/**
 * Resolve auth context from signed session cookie (portal) or Bearer token (API).
 * Never reads hospitalId from query parameters.
 */
async function resolveAuthContext(req: NextRequest): Promise<AuthzContext | null> {
  try {
    const { getSessionFromRequest } = await import('@/lib/api-security');
    const cookieSession = getSessionFromRequest(req);
    const cookieHospitalId = normalizeHospitalId(cookieSession?.hospitalId);
    if (cookieSession?.id && cookieHospitalId && isHospitalTenantRole(cookieSession.role)) {
      return {
        hospitalId: cookieHospitalId,
        userId: cookieSession.id,
        role: cookieSession.role,
      };
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase credentials not configured for auth middleware');
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    const hospitalId = normalizeHospitalId(user.app_metadata?.hospitalId);
    const role = user.app_metadata?.role;

    if (!hospitalId || !isHospitalTenantRole(role)) {
      logger.warn('User session missing hospitalId or role', { userId: user.id });
      return null;
    }

    return { hospitalId, userId: user.id, role };
  } catch (error) {
    logger.error('Error resolving auth context', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Higher-order function that wraps a route handler with authentication,
 * role-based authorization, and tenant resolution.
 *
 * @param handler - The route handler receiving (req, authzContext)
 * @param allowedRoles - Roles permitted to access this route (default: ['admin'])
 */
export function withAuthzAndTenant(
  handler: ProtectedHandler,
  allowedRoles: readonly HospitalTenantRole[] = ['admin']
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const guard = await enforceApiGuard(req, {
      scope: 'api:tenant-protected',
      requireAuth: false,
      requireTrustedOrigin: false,
    });
    if (guard.response) {
      return guard.response;
    }

    if (req.nextUrl.searchParams.has('hospitalId')) {
      logger.warn('Rejected request with hospitalId query parameter', {
        path: req.nextUrl.pathname,
      });
      return NextResponse.json(
        { error: 'Tenant must be resolved from session, not query parameters' },
        { status: 403 }
      );
    }

    const ctx = await resolveAuthContext(req);

    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!allowedRoles.includes(ctx.role)) {
      logger.warn('Role not authorized for route', {
        userId: ctx.userId,
        role: ctx.role,
        allowedRoles,
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(req, ctx);
  };
}
