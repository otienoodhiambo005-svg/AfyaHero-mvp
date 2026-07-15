/**
 * GET /api/superadmin/capacity-planner — cross-facility capacity signals (super_admin only).
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';
import type { UserSession } from '@/types';
import {
  forecastNext7Total,
  forecastNextDay,
  seriesFromDayMap,
  utcDayKeysLast7,
} from '@/lib/superadmin/capacity-planner-forecast';

/** After enforceApiGuard(roles: super_admin), require platform scope (no hospital binding). */
function requireGlobalSuperAdminScope(session: UserSession | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.hospitalId) {
    return NextResponse.json({ error: 'Global super administrator required.' }, { status: 403 });
  }
  return null;
}

type QueueAggRow = {
  hospital_id: string;
  active_queue: bigint;
  avg_wait: number | null;
  urgent_queue: bigint;
};

type DailyQueueRow = {
  hospital_id: string;
  day: Date;
  c: bigint;
};

type LabStuckRow = {
  hospital_id: string;
  c: bigint;
};

type BedAggRow = {
  hospital_id: string;
  status: string;
  c: bigint;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function queuePressureScore(active: number, avgWait: number, urgent: number): number {
  const depth = active * 4.2;
  const wait = Math.min(avgWait, 120) * 0.35;
  const pri = urgent * 12;
  return Math.round(clamp(depth + wait + pri, 0, 100));
}

function bottleneckScore(occupancyPct: number | null, queuePressure: number, labStuck: number): number {
  const occ = occupancyPct == null ? 35 : occupancyPct;
  const lab = Math.min(100, labStuck * 18);
  return Math.round(clamp(occ * 0.48 + queuePressure * 0.32 + lab * 0.2, 0, 100));
}

export async function GET(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:superadmin:capacity-planner',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const scopeErr = requireGlobalSuperAdminScope(guard.session);
    if (scopeErr) return scopeErr;

    const now = Date.now();
    const since = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const labStuckBefore = new Date(now - 48 * 60 * 60 * 1000);
    const dayKeys = utcDayKeysLast7(now);
    const queueAggQuery = prisma.$queryRaw<QueueAggRow[]>(Prisma.sql`
      SELECT
        hq.hospital_id::text AS hospital_id,
        COUNT(*) FILTER (WHERE hq.status IN ('waiting', 'in_progress'))::bigint AS active_queue,
        AVG(hq.wait_minutes) FILTER (WHERE hq.status IN ('waiting', 'in_progress')) AS avg_wait,
        COUNT(*) FILTER (
          WHERE hq.status IN ('waiting', 'in_progress')
            AND LOWER(COALESCE(hq.priority, 'normal')) IN ('urgent', 'critical')
        )::bigint AS urgent_queue
      FROM hospital_queue hq
      GROUP BY hq.hospital_id
    `);
    const dailyQueueQuery = prisma.$queryRaw<DailyQueueRow[]>(Prisma.sql`
      SELECT
        hq.hospital_id::text AS hospital_id,
        date_trunc('day', hq.created_at AT TIME ZONE 'UTC') AS day,
        COUNT(*)::bigint AS c
      FROM hospital_queue hq
      WHERE hq.created_at >= ${since}
      GROUP BY hq.hospital_id, 2
      ORDER BY hq.hospital_id, 2 ASC
    `);
    const labStuckQuery = prisma.$queryRaw<LabStuckRow[]>(Prisma.sql`
      SELECT lr.hospital_id::text AS hospital_id, COUNT(*)::bigint AS c
      FROM lab_requests lr
      WHERE lr.status IN ('ordered', 'sample-collected', 'processing')
        AND lr.ordered_at < ${labStuckBefore}
      GROUP BY lr.hospital_id
    `);
    const bedAggQuery = prisma.$queryRaw<BedAggRow[]>(Prisma.sql`
      SELECT hb.hospital_id::text AS hospital_id, hb.status, COUNT(*)::bigint AS c
      FROM hospital_beds hb
      GROUP BY hb.hospital_id, hb.status
    `);

    const [hospitals, queueAgg, dailyQueue, labStuck, bedAgg, recentFlags] = await Promise.all([
      prisma.hospital.findMany({
        where: { isActive: true },
        select: { id: true, name: true, location: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
      queueAggQuery,
      dailyQueueQuery,
      labStuckQuery,
      bedAggQuery,
      prisma.auditLog.findMany({
        where: {
          action: 'CAPACITY_PROACTIVE_SUPPORT_FLAG',
          hospitalId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
        select: {
          hospitalId: true,
          createdAt: true,
          actorEmail: true,
          detail: true,
        },
      }),
    ]);

    const queueByHospital = new Map<
      string,
      { active: number; avgWait: number; urgent: number }
    >();
    for (const row of queueAgg) {
      queueByHospital.set(row.hospital_id, {
        active: Number(row.active_queue),
        avgWait: row.avg_wait == null ? 0 : Number(row.avg_wait),
        urgent: Number(row.urgent_queue),
      });
    }

    const labStuckByHospital = new Map<string, number>();
    for (const row of labStuck) {
      labStuckByHospital.set(row.hospital_id, Number(row.c));
    }

    const dailyByHospital = new Map<string, Map<string, number>>();
    for (const row of dailyQueue) {
      const hid = row.hospital_id;
      const key = new Date(row.day).toISOString().slice(0, 10);
      if (!dailyByHospital.has(hid)) dailyByHospital.set(hid, new Map());
      dailyByHospital.get(hid)!.set(key, Number(row.c));
    }

    const bedsByHospital = new Map<string, { total: number; occupied: number }>();
    for (const row of bedAgg) {
      const hid = row.hospital_id;
      if (!bedsByHospital.has(hid)) bedsByHospital.set(hid, { total: 0, occupied: 0 });
      const cur = bedsByHospital.get(hid)!;
      const c = Number(row.c);
      cur.total += c;
      if (row.status === 'occupied') cur.occupied += c;
    }

    const latestFlagByHospital = new Map<
      string,
      { flaggedAt: string; actorEmail: string | null; note?: string }
    >();
    for (const f of recentFlags) {
      if (!f.hospitalId) continue;
      if (latestFlagByHospital.has(f.hospitalId)) continue;
      const detail = f.detail as { note?: string } | null;
      latestFlagByHospital.set(f.hospitalId, {
        flaggedAt: f.createdAt.toISOString(),
        actorEmail: f.actorEmail,
        note: typeof detail?.note === 'string' ? detail.note : undefined,
      });
    }

    const facilities = hospitals.map(h => {
      const beds = bedsByHospital.get(h.id) ?? { total: 0, occupied: 0 };
      const occupancyPct =
        beds.total > 0 ? Math.round((beds.occupied / beds.total) * 1000) / 10 : null;
      const q = queueByHospital.get(h.id) ?? { active: 0, avgWait: 0, urgent: 0 };
      const queuePressure = queuePressureScore(q.active, q.avgWait, q.urgent);
      const stuck = labStuckByHospital.get(h.id) ?? 0;
      const bottleneck = bottleneckScore(occupancyPct, queuePressure, stuck);

      const dayMap = dailyByHospital.get(h.id) ?? new Map<string, number>();
      const dailySeries = seriesFromDayMap(dayMap, dayKeys);
      const f24 = forecastNextDay(dailySeries);
      const f7 = forecastNext7Total(dailySeries);

      const forecast24h = {
        projectedQueueArrivals: f24.projectedNextDay,
        priorDayArrivals: f24.lastDay,
        deltaPctVsPriorDay: f24.deltaPctVsPriorDay,
        method: 'linear_trend_on_daily_queue_creates_utc' as const,
      };
      const forecast7d = {
        projectedQueueArrivals: f7.projectedTotal,
        last7dArrivals: f7.last7Total,
        deltaPctVsLast7: f7.deltaPctVsLast7,
        method: 'linear_trend_on_daily_queue_creates_utc' as const,
      };

      const support = latestFlagByHospital.get(h.id) ?? null;

      return {
        hospitalId: h.id,
        name: h.name,
        location: h.location,
        isActive: h.isActive,
        occupancyPct,
        bedsTotal: beds.total,
        bedsOccupied: beds.occupied,
        activeQueue: q.active,
        avgWaitMinutes: Math.round(q.avgWait * 10) / 10,
        urgentInQueue: q.urgent,
        queuePressure,
        labStuckOver48h: stuck,
        bottleneckScore: bottleneck,
        forecast24h,
        forecast7d,
        proactiveSupport: support,
      };
    });

    return NextResponse.json({
      generatedAt: new Date(now).toISOString(),
      facilities,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin capacity planner GET error', { error: err.message });
    Sentry.captureException(err, {
      tags: { endpoint: '/api/superadmin/capacity-planner', method: 'GET' },
    });
    return NextResponse.json({ error: 'Failed to load capacity planner data' }, { status: 500 });
  }
}
