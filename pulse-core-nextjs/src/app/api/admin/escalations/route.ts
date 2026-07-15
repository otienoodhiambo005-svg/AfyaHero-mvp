import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody, requireString, validateOptionalString, validateUuid } from '@/lib/api-security';
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

/**
 * GET /api/admin/escalations?status=open|all
 * Lists escalations for the signed-in hospital (strict hospitalId).
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') ?? 'open';
  const statusFilter = rawStatus === 'all' ? 'all' : 'open';
  const where =
    statusFilter === 'all'
      ? { hospitalId }
      : { hospitalId, status: 'open' };

  try {
    const escalations = await prisma.serviceEscalation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
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

    return NextResponse.json({ escalations });
  } catch (err) {
    logger.error('[admin/escalations] GET failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load escalations.' }, { status: 500 });
  }
}

type CreateBody = {
  title?: unknown;
  body?: unknown;
  serviceArea?: unknown;
};

/**
 * POST /api/admin/escalations
 * Creates a new open escalation for the current hospital.
 */
export async function POST(request: NextRequest) {
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

  const raw = await readJsonBody<CreateBody>(request);
  if (raw instanceof NextResponse) return raw;

  const title = requireString(raw.title, 'title', { min: 2, max: 200 });
  if (title instanceof NextResponse) return title;

  const body = requireString(raw.body, 'body', { min: 2, max: 8000 });
  if (body instanceof NextResponse) return body;

  const serviceArea = validateOptionalString(raw.serviceArea, 'serviceArea', { max: 120 });
  if (serviceArea instanceof NextResponse) return serviceArea;

  const createdById = profileIdFromSession(guard.session.id);

  try {
    const row = await prisma.serviceEscalation.create({
      data: {
        hospitalId,
        title,
        body,
        serviceArea: serviceArea ?? null,
        status: 'open',
        createdById,
      },
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

    return NextResponse.json({ escalation: row }, { status: 201 });
  } catch (err) {
    logger.error('[admin/escalations] POST failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to create escalation.' }, { status: 500 });
  }
}
