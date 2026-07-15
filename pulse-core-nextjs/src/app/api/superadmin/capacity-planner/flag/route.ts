/**
 * POST /api/superadmin/capacity-planner/flag — flag facility for proactive support (audit trail).
 * super_admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import type { UserSession } from '@/types';

function requireGlobalSuperAdminScope(session: UserSession | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.hospitalId) {
    return NextResponse.json({ error: 'Global super administrator required.' }, { status: 403 });
  }
  return null;
}

const bodySchema = z.object({
  hospitalId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:capacity-planner:flag',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const scopeErr = requireGlobalSuperAdminScope(guard.session);
    if (scopeErr) return scopeErr;

    const bodyUnknown = await readJsonBody(request);
    if (bodyUnknown instanceof NextResponse) return bodyUnknown;

    const parsed = bodySchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: parsed.data.hospitalId },
      select: { id: true, name: true, isActive: true },
    });
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    const session = guard.session;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Non-null after enforceApiGuard(super_admin) + requireGlobalSuperAdminScope
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const log = await prisma.auditLog.create({
      data: {
        action: 'CAPACITY_PROACTIVE_SUPPORT_FLAG',
        actorId: session.id,
        actorEmail: session.email,
        actorRole: 'super_admin',
        hospitalId: hospital.id,
        resourceType: 'Hospital',
        resourceId: hospital.id,
        detail: {
          facilityName: hospital.name,
          isActive: hospital.isActive,
          note: parsed.data.note?.trim() || undefined,
        },
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      ok: true,
      auditLogId: log.id,
      message: 'Facility flagged for proactive support. Logged on the audit trail.',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin capacity planner flag POST error', { error: err.message });
    Sentry.captureException(err, {
      tags: { endpoint: '/api/superadmin/capacity-planner/flag', method: 'POST' },
    });
    return NextResponse.json({ error: 'Failed to record flag' }, { status: 500 });
  }
}
