import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody, validateEnumValue, validateUuid } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

/* Prisma is loaded as `any` from `@/lib/database` until the client is generated at build time. */
 

function resolveHospitalId(sessionHospitalId: string | undefined): string | NextResponse {
  if (!sessionHospitalId || sessionHospitalId === 'unknown') {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }
  const idCheck = validateUuid(sessionHospitalId, 'hospitalId');
  if (idCheck instanceof NextResponse) {
    return NextResponse.json({ error: 'Invalid hospital context.' }, { status: 400 });
  }
  return idCheck;
}

function profileIdFromSession(sessionId: string): string | null {
  const id = validateUuid(sessionId, 'profileId');
  return id instanceof NextResponse ? null : id;
}

type PatchBody = {
  status?: unknown;
};

/**
 * PATCH /api/admin/escalations/:id
 * Resolve / close an escalation (hospital-scoped).
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:admin:escalations',
    roles: ['admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hospitalId = resolveHospitalId(guard.session.hospitalId);
  if (hospitalId instanceof NextResponse) return hospitalId;

  const { id: rawId } = await ctx.params;
  const escalationId = validateUuid(rawId, 'id');
  if (escalationId instanceof NextResponse) return escalationId;

  const raw = await readJsonBody<PatchBody>(request);
  if (raw instanceof NextResponse) return raw;

  const status = validateEnumValue(raw.status, 'status', ['resolved'] as const);
  if (status instanceof NextResponse) return status;

  const resolvedById = profileIdFromSession(guard.session.id);

  try {
    const existing = await prisma.serviceEscalation.findFirst({
      where: { id: escalationId, hospitalId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Escalation not found.' }, { status: 404 });
    }

    if (existing.status === 'resolved') {
      return NextResponse.json({ error: 'Escalation is already resolved.' }, { status: 409 });
    }

    await prisma.serviceEscalation.updateMany({
      where: { id: escalationId, hospitalId, status: 'open' },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedById,
      },
    });

    const row = await prisma.serviceEscalation.findFirst({
      where: { id: escalationId, hospitalId },
      select: {
        id: true,
        title: true,
        body: true,
        serviceArea: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        createdBy: { select: { fullName: true, email: true } },
        resolvedBy: { select: { fullName: true, email: true } },
      },
    });

    if (!row) {
      return NextResponse.json({ error: 'Escalation not found.' }, { status: 404 });
    }

    return NextResponse.json({ escalation: row });
  } catch (err) {
    logger.error('[admin/escalations/:id] PATCH failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to update escalation.' }, { status: 500 });
  }
}
