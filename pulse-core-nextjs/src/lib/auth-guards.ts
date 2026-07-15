/**
 * High-level auth guards for API routes.
 *
 * Thin wrappers around `enforceApiGuard` that encode common AfyaHero patterns:
 *   - superadmin-only platform endpoints
 *   - hospital-tenant endpoints (any portal role) with demo deny by default
 *   - demo-aware read-only endpoints
 *
 * These helpers do NOT replace `enforceApiGuard`; they standardize its options
 * for the most common cases so individual routes don't drift.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, type ApiGuardOptions, type ApiGuardResult } from '@/lib/api-security';
import type { PortalRole, UserSession } from '@/types';

const HOSPITAL_ROLES: PortalRole[] = ['admin', 'medical', 'reception', 'lab', 'pharmacy'];

export type SuperAdminGuardOptions = Omit<ApiGuardOptions, 'roles'>;

/**
 * Restricts a route to authenticated `super_admin` sessions.
 * Demo sessions are denied by default (override with `denyDemo: false`).
 */
export async function requireSuperAdminApi(
  req: NextRequest,
  options: SuperAdminGuardOptions = {},
): Promise<ApiGuardResult> {
  return enforceApiGuard(req, {
    denyDemo: true,
    ...options,
    roles: ['super_admin'],
  });
}

export interface HospitalGuardOptions extends Omit<ApiGuardOptions, 'roles'> {
  /** Restrict to a subset of hospital roles. Defaults to all hospital roles. */
  roles?: PortalRole[];
  /** Allow demo sessions to access this endpoint. Defaults to false. */
  allowDemo?: boolean;
}

/**
 * Restricts a route to hospital-tenant roles
 * (admin, medical, reception, lab, pharmacy).
 *
 * Demo sessions are blocked by default. Pass `allowDemo: true` for read-only
 * endpoints that intentionally serve demo data.
 */
export async function requireHospitalApi(
  req: NextRequest,
  options: HospitalGuardOptions = {},
): Promise<ApiGuardResult> {
  const { allowDemo, roles, ...rest } = options;
  return enforceApiGuard(req, {
    ...rest,
    roles: roles && roles.length > 0 ? roles : HOSPITAL_ROLES,
    denyDemo: !allowDemo,
  });
}

/**
 * Returns true if the session is a demo showcase session.
 */
export function isDemoSession(session: UserSession | null | undefined): boolean {
  return Boolean(session?.demo);
}

/**
 * Asserts a session is non-demo. Returns a 403 NextResponse if the session is
 * a demo session. Used inside route handlers when the guard ran in a mode that
 * cannot use `denyDemo` (e.g., conditional logic).
 */
export function assertNonDemo(session: UserSession | null | undefined): NextResponse | null {
  if (isDemoSession(session)) {
    return NextResponse.json(
      { error: 'Demo sessions are not permitted on this endpoint.' },
      { status: 403 },
    );
  }
  return null;
}
