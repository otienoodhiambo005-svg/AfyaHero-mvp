import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, validateUuid } from '@/lib/api-security';
import {
  ACTIVE_STATUSES,
  DEPT_BUCKETS,
  IN_SERVICE_STATUSES,
  waitMinutesLive,
} from '@/lib/admin-hospital-queue-monitor';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

type AdminQueueSummaryDept = {
  dept: string;
  waiting: number;
  inService: number;
  avgWait: number;
  slaTarget: number;
  alerts: string[];
};

/**
 * GET /api/admin/queue/summary
 * Aggregated hospital_queue snapshot for hospital admins (strict hospitalId).
 */
export async function GET(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:admin:queue-summary',
    roles: ['admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  const hospitalId = guard.session?.hospitalId;
  if (!hospitalId || hospitalId === 'unknown') {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const idCheck = validateUuid(hospitalId, 'hospitalId');
  if (idCheck instanceof NextResponse) {
    return NextResponse.json({ error: 'Invalid hospital context.' }, { status: 400 });
  }

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

    const departments: AdminQueueSummaryDept[] = DEPT_BUCKETS.map(({ dept, serviceTypes, slaTarget }) => {
      const bucketRows = serviceTypes.length
        ? rows.filter(r => serviceTypes.includes(r.serviceType))
        : [];

      const waiting = bucketRows.filter(r =>
        (ACTIVE_STATUSES as readonly string[]).includes(r.status),
      ).length;
      const inService = bucketRows.filter(r =>
        (IN_SERVICE_STATUSES as readonly string[]).includes(r.status),
      ).length;

      const waits = bucketRows.map(r => waitMinutesLive(r.arrivedAt, r.waitMinutes));
      const avgWait =
        waits.length > 0 ? Math.round(waits.reduce((a: number, b: number) => a + b, 0) / waits.length) : 0;

      const nearSla = waits.filter((w: number) => w >= slaTarget * 0.8).length;
      const breach = waits.filter((w: number) => w > slaTarget).length;
      const alerts: string[] = [];
      if (breach > 0) {
        alerts.push(`${breach} ticket${breach === 1 ? '' : 's'} over SLA (${slaTarget} min)`);
      } else if (nearSla > 0) {
        alerts.push(`${nearSla} ticket${nearSla === 1 ? '' : 's'} near SLA threshold`);
      }

      return { dept, waiting, inService, avgWait, slaTarget, alerts };
    });

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      departments,
    });
  } catch (err) {
    logger.error('[admin/queue/summary] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load queue summary.' }, { status: 500 });
  }
}
