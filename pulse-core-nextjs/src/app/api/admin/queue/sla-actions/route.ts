import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, validateUuid } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const SLA_QUEUE_ACTIONS = [
  'queue_sla_bulk_escalation_requested',
  'queue_sla_bulk_overflow_assign',
] as const;

/**
 * GET /api/admin/queue/sla-actions
 * Recent SLA / queue operational actions for this hospital (audit-backed).
 */
export async function GET(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:admin:queue-sla-actions',
    roles: ['admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hospitalId = guard.session.hospitalId;
  if (!hospitalId || hospitalId === 'unknown') {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const idCheck = validateUuid(hospitalId, 'hospitalId');
  if (idCheck instanceof NextResponse) {
    return NextResponse.json({ error: 'Invalid hospital context.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get('limit') ?? '40', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 40;
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  try {
    const entries = await prisma.auditLog.findMany({
      where: {
        hospitalId: idCheck,
        action: { in: [...SLA_QUEUE_ACTIONS] },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorRole: true,
        detail: true,
        createdAt: true,
      },
    });

    const hasMore = entries.length > limit;
    const page = hasMore ? entries.slice(0, limit) : entries;

    return NextResponse.json({
      entries: page.map(e => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      })),
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    });
  } catch (err) {
    logger.error('[admin/queue/sla-actions] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load SLA action history.' }, { status: 500 });
  }
}
