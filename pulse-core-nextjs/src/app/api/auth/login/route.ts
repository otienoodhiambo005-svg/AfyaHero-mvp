/**
 * Production Login API Route
 * 
 * POST /api/auth/login
 * 
 * Authenticates via Supabase Auth, exchanges for AfyaHero session cookie.
 * Supports all portal roles: admin, medical, reception, lab, pharmacy, super_admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoginSchema } from '@/lib/schemas';
import { signInWithEmail } from '@/lib/supabase-auth';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { auditAuthEvent } from '@/lib/audit-logging';
import logger from '@/lib/logger';
import { sanitizeError } from '@/lib/api-response';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';

const SESSION_COOKIE = 'afya_session';
const MAX_AGE = 8 * 60 * 60; // 8 hours

// LoginSchema is now imported from @/lib/schemas

export async function POST(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'auth:login',
    requireAuth: false,
  });
  if (guard.response) return guard.response;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (body instanceof NextResponse) return body;

  const validation = LoginSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.issues.map(i => i.message) },
      { status: 400 }
    );
  }

  const { staffId, password, portal } = validation.data;
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

  if (isStandaloneSuperAdminMode() && portal !== 'super_admin') {
    await auditAuthEvent({
      type: 'login_failed',
      email: staffId.trim().toLowerCase(),
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      reason: 'Standalone superadmin mode blocks non-superadmin portal login',
    });

    return NextResponse.json(
      { error: 'Access denied. Standalone mode requires Super Admin portal access.' },
      { status: 403 },
    );
  }

  let email: string;

  // Handle Staff ID to Email mapping
  if (portal === 'super_admin') {
    // Super admins use email directly (or we can assume staffId is the email)
    email = staffId.trim().toLowerCase();
  } else {
    try {
      const { prisma } = await import('@/lib/database');
      const profile = await prisma.profile.findFirst({
        where: { staffId: staffId.trim() },
        select: { email: true, status: true },
      });

      if (!profile || profile.status !== 'active') {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 },
        );
      }

      email = profile.email;
    } catch (err) {
      const { error } = sanitizeError(err, {
        context: '[auth/login] mapping lookup failed',
        clientMessage: 'Authentication service error',
      });
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  // Attempt Supabase Auth sign-in
  const result = await signInWithEmail(email, password);

  if ('error' in result) {
    // Audit failed login
    await auditAuthEvent({
      type: 'login_failed',
      email,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      reason: result.error,
    });

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // Verify the user's role matches the requested portal
  if (result.user.role !== portal) {
    await auditAuthEvent({
      type: 'login_failed',
      email,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      reason: `Role mismatch: user is ${result.user.role}, requested ${portal}`,
    });

    return NextResponse.json(
      { error: 'Access denied. Use the correct portal for your account.' },
      { status: 403 }
    );
  }

  if (result.user.role !== 'super_admin') {
    try {
      const { prisma } = await import('@/lib/database');
      const profile = await prisma.profile.findFirst({
        where: { email },
        select: { status: true },
      });
      if (profile && profile.status !== 'active') {
        await auditAuthEvent({
          type: 'login_failed',
          email,
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') ?? 'unknown',
          reason: `Profile not active: ${profile.status}`,
        });
        return NextResponse.json(
          { error: `Account is ${profile.status}. Please wait for approval or contact your hospital administrator.` },
          { status: 403 },
        );
      }
    } catch (statusErr) {
      sanitizeError(statusErr, { context: '[auth/login] profile status check failed' });
    }
  }

  // Set session cookie
  const response = NextResponse.json({
    success: true,
    user: {
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      hospitalId: result.user.hospitalId,
    },
    redirectTo: `/portal/${portal}`,
  });

  response.cookies.set(SESSION_COOKIE, result.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  });

  // Audit successful login
  await auditAuthEvent({
    type: 'login_success',
    userId: result.user.id,
    email,
    role: result.user.role,
    hospitalId: result.user.hospitalId,
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  });

  logger.info('User logged in', {
    userId: result.user.id,
    role: result.user.role,
    portal,
  });

  return response;
}

