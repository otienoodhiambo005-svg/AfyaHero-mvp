import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVE_STATUSES,
  DEPT_BUCKETS,
  type DeptKey,
  isDeptAtRisk,
  type QueueRowLite,
} from '@/lib/admin-hospital-queue-monitor';
import { enforceApiGuard, readJsonBody, validateUuid } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const BodySchema = z.object({
  action: z.enum(['escalation_requested', 'overflow_assign']),
  /** Optional subset of department labels; must still be at-risk when omitted means all at-risk. */
  departments: z.array(z.string()).optional(),
});

const AUDIT_ACTION = {
  escalation_requested: 'queue_sla_bulk_escalation_requested',
  overflow_assign: 'queue_sla_bulk_overflow_assign',
} as const;

/**
 * POST /api/admin/queue/bulk-at-risk
 * Bulk operational response for departments currently over ~80% SLA (avg wait).
 */
export async function POST(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:admin:queue-bulk-at-risk',
    roles: ['admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = guard.session;
  const hospitalId = session.hospitalId;
  if (!hospitalId || hospitalId === 'unknown') {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const idCheck = validateUuid(hospitalId, 'hospitalId');
  if (idCheck instanceof NextResponse) {
    return NextResponse.json({ error: 'Invalid hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(request);
  if (body instanceof NextResponse) return body;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid bulk action payload.' }, { status: 400 });
  }

  const { action } = parsed.data;
  const deptFilter = parsed.data.departments?.map((d) => d.trim()).filter(Boolean);

  try {
    const allServiceTypes = DEPT_BUCKETS.flatMap((b) => b.serviceTypes).filter(Boolean);
    const rows = await prisma.hospitalQueue.findMany({
      where: {
        hospitalId: idCheck,
        status: { notIn: ['completed', 'cancelled'] },
        ...(allServiceTypes.length > 0 ? { serviceType: { in: allServiceTypes } } : {}),
      },
      select: {
        serviceType: true,
        status: true,
        waitMinutes: true,
        arrivedAt: true,
      },
    });

    const rowLite: QueueRowLite[] = rows.map((r: QueueRowLite) => ({
      serviceType: r.serviceType,
      status: r.status,
      waitMinutes: r.waitMinutes,
      arrivedAt: r.arrivedAt,
    }));

    let targetBuckets = DEPT_BUCKETS.filter((b) => isDeptAtRisk(b, rowLite));
    if (deptFilter?.length) {
      const allowed = new Set(deptFilter);
      targetBuckets = targetBuckets.filter((b) => allowed.has(b.dept));
    }

    if (targetBuckets.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No at-risk departments match this request.',
        departments: [] as string[],
        ticketsUpdated: 0,
      });
    }

    let ticketsUpdated = 0;
    const perDept: { dept: DeptKey; updated: number }[] = [];

    for (const bucket of targetBuckets) {
      if (!bucket.serviceTypes.length) {
        perDept.push({ dept: bucket.dept, updated: 0 });
        continue;
      }

      if (action === 'escalation_requested') {
        const r = await prisma.hospitalQueue.updateMany({
          where: {
            hospitalId: idCheck,
            serviceType: { in: bucket.serviceTypes },
            status: { in: [...ACTIVE_STATUSES] },
            priority: 'normal',
          },
          data: { priority: 'urgent' },
        });
        ticketsUpdated += r.count;
        perDept.push({ dept: bucket.dept, updated: r.count });
      } else {
        const r = await prisma.hospitalQueue.updateMany({
          where: {
            hospitalId: idCheck,
            serviceType: { in: bucket.serviceTypes },
            status: 'waiting',
          },
          data: { assignedTo: session.id },
        });
        ticketsUpdated += r.count;
        perDept.push({ dept: bucket.dept, updated: r.count });
      }
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined;

    await prisma.auditLog.create({
      data: {
        action: AUDIT_ACTION[action],
        actorId: session.id,
        actorEmail: session.email,
        actorRole: session.role,
        hospitalId: idCheck,
        resourceType: 'HospitalQueue',
        detail: {
          kind: action,
          departments: targetBuckets.map((b) => b.dept),
          perDept,
          ticketsUpdated,
        },
        ipAddress,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        action === 'escalation_requested'
          ? `Escalation priority applied to waiting flows in ${targetBuckets.length} department(s).`
          : `Overflow coordinator assignment applied to waiting tickets in ${targetBuckets.length} department(s).`,
      departments: targetBuckets.map((b) => b.dept),
      ticketsUpdated,
      perDept,
    });
  } catch (err) {
    logger.error('[admin/queue/bulk-at-risk] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Bulk queue action failed.' }, { status: 500 });
  }
}
