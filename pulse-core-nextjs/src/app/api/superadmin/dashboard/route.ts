/**
 * Super Admin consolidated dashboard — live aggregates (super_admin only).
 * GET /api/superadmin/dashboard
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import os from 'os';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';

const CACHE_TTL_MS = 25_000;
let cache: { payload: unknown; expiresAt: number } | null = null;

type DailyCountRow = {
  day: Date | string;
  c: bigint | number;
};

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Oldest→newest daily counts; x = 0..n-1; project y at x = n..n+6 */
function forecastNext7Total(dailyLast7: number[]): {
  projectedTotal: number;
  last7Total: number;
  deltaPctVsLast7: number;
} {
  const y = dailyLast7;
  const n = y.length;
  if (n === 0) {
    return { projectedTotal: 0, last7Total: 0, deltaPctVsLast7: 0 };
  }
  const sumY = y.reduce((a, b) => a + b, 0);
  if (sumY === 0) {
    return { projectedTotal: 0, last7Total: 0, deltaPctVsLast7: 0 };
  }
  const xs = y.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * y[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  let projected = 0;
  for (let x = n; x < n + 7; x += 1) {
    projected += Math.max(0, Math.round(intercept + slope * x));
  }
  const deltaPctVsLast7 = Math.round(((projected - sumY) / sumY) * 100);
  return { projectedTotal: projected, last7Total: sumY, deltaPctVsLast7 };
}

function deriveSystemStatus(input: {
  openIncidents: number;
  criticalIncidents: number;
  heapUtilizationPct: number;
  paymentSuccessPct: number;
}): 'healthy' | 'warning' | 'critical' {
  if (input.criticalIncidents > 0 || input.heapUtilizationPct >= 92) return 'critical';
  if (input.openIncidents >= 5 || input.paymentSuccessPct < 90 || input.heapUtilizationPct >= 80) {
    return 'warning';
  }
  return 'healthy';
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:dashboard',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return NextResponse.json(cache.payload, {
        headers: { 'Cache-Control': 'private, max-age=25' },
      });
    }

    const d24 = new Date(now - 24 * 60 * 60 * 1000);
    const d48 = new Date(now - 48 * 60 * 60 * 1000);
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const d14 = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const labStuckBefore = new Date(now - 48 * 60 * 60 * 1000);

    const mem = process.memoryUsage();
    const heapUsedMb = mem.heapUsed / 1024 / 1024;
    const heapTotalMb = Math.max(mem.heapTotal / 1024 / 1024, 0.0001);
    const heapUtilizationPct = Math.round((heapUsedMb / heapTotalMb) * 100);
    const rssMb = mem.rss / 1024 / 1024;

    const auditSince = new Date(now - 14 * 24 * 60 * 60 * 1000);

    const [
      totalHospitals,
      totalUsers,
      activeUsers24h,
      activeUsersPrev24h,
      openErrors,
      criticalOpenIncidents,
      hospitalsLast30,
      hospitalsPrev30,
      profilesLast7,
      profilesPrev7,
      newIncidents7d,
      newIncidentsPrev7d,
      paymentsOk,
      paymentsFail,
      auditLast24h,
      auditPrev24h,
      appointments24h,
      appointmentsPrev24h,
      labReq24h,
      labReqPrev24h,
      checkins24h,
      checkinsPrev24h,
      consultations24h,
      consultationsPrev24h,
      queueDepth,
      labStuck,
      stuckExchanges,
      dailyAuditRows,
      dailyAppointmentRows,
      queueByHospital,
      topAuditActions,
    ] = await Promise.all([
      prisma.hospital.count(),
      prisma.profile.count(),
      prisma.profile.count({ where: { lastLogin: { gte: d24 } } }),
      prisma.profile.count({
        where: { lastLogin: { gte: d48, lt: d24 } },
      }),
      prisma.securityIncident.count({
        where: { status: { in: ['open', 'investigating'] } },
      }),
      prisma.securityIncident.count({
        where: { status: { in: ['open', 'investigating'] }, severity: 'critical' },
      }),
      prisma.hospital.count({ where: { createdAt: { gte: d30 } } }),
      prisma.hospital.count({ where: { createdAt: { gte: d60, lt: d30 } } }),
      prisma.profile.count({ where: { createdAt: { gte: d7 } } }),
      prisma.profile.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
      prisma.securityIncident.count({ where: { detectedAt: { gte: d7 } } }),
      prisma.securityIncident.count({ where: { detectedAt: { gte: d14, lt: d7 } } }),
      prisma.paymentTransaction.count({
        where: { createdAt: { gte: d7 }, status: 'completed' },
      }),
      prisma.paymentTransaction.count({
        where: { createdAt: { gte: d7 }, status: 'failed' },
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: d24 } } }),
      prisma.auditLog.count({
        where: { createdAt: { gte: d48, lt: d24 } },
      }),
      prisma.appointment.count({ where: { createdAt: { gte: d24 } } }),
      prisma.appointment.count({
        where: { createdAt: { gte: d48, lt: d24 } },
      }),
      prisma.labRequest.count({ where: { orderedAt: { gte: d24 } } }),
      prisma.labRequest.count({
        where: { orderedAt: { gte: d48, lt: d24 } },
      }),
      prisma.receptionCheckin.count({ where: { createdAt: { gte: d24 } } }),
      prisma.receptionCheckin.count({
        where: { createdAt: { gte: d48, lt: d24 } },
      }),
      prisma.consultation.count({ where: { createdAt: { gte: d24 } } }),
      prisma.consultation.count({
        where: { createdAt: { gte: d48, lt: d24 } },
      }),
      prisma.hospitalQueue.count({
        where: { status: { in: ['waiting', 'in_progress'] } },
      }),
      prisma.labRequest.count({
        where: {
          status: { in: ['ordered', 'sample-collected', 'processing'] },
          orderedAt: { lt: labStuckBefore },
        },
      }),
      prisma.healthDataExchange.count({
        where: { status: 'failed', createdAt: { gte: d7 } },
      }),
      prisma.$queryRaw<DailyCountRow[]>(
        Prisma.sql`
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS c
          FROM audit_logs
          WHERE created_at >= ${auditSince}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      prisma.$queryRaw<DailyCountRow[]>(
        Prisma.sql`
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS c
          FROM appointments
          WHERE created_at >= ${auditSince}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      prisma.hospitalQueue.groupBy({
        by: ['hospitalId'],
        where: { status: { in: ['waiting', 'in_progress'] } },
        _count: true,
        orderBy: { _count: { hospitalId: 'desc' } },
        take: 5,
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: d24 } },
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 5,
      }),
    ]);

    const dayMap = new Map<string, number>();
    for (const row of dailyAuditRows) {
      const d = new Date(row.day);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, Number(row.c));
    }

    const dailyLast7: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = new Date(
        Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() - i),
      );
      const key = dayStart.toISOString().slice(0, 10);
      dailyLast7.push(dayMap.get(key) ?? 0);
    }

    const forecast = forecastNext7Total(dailyLast7);

    const appointmentDayMap = new Map<string, number>();
    for (const row of dailyAppointmentRows) {
      const d = new Date(row.day);
      const key = d.toISOString().slice(0, 10);
      appointmentDayMap.set(key, Number(row.c));
    }

    const appointmentsDailyLast7: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dayStart = new Date(
        Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() - i),
      );
      const key = dayStart.toISOString().slice(0, 10);
      appointmentsDailyLast7.push(appointmentDayMap.get(key) ?? 0);
    }

    const appointmentForecast = forecastNext7Total(appointmentsDailyLast7);

    const clinicalEvents24h =
      appointments24h + labReq24h + checkins24h + consultations24h;
    const clinicalEventsPrev24h =
      appointmentsPrev24h + labReqPrev24h + checkinsPrev24h + consultationsPrev24h;

    const hospitalIds = queueByHospital.map(q => q.hospitalId);
    const hospitals =
      hospitalIds.length > 0
        ? await prisma.hospital.findMany({
            where: { id: { in: hospitalIds } },
            select: { id: true, name: true },
          })
        : [];
    const hospitalNameById = new Map(hospitals.map(h => [h.id, h.name]));

    const paymentDenom = paymentsOk + paymentsFail;
    const apiSuccessRate =
      paymentDenom === 0 ? 100 : Math.round((paymentsOk / paymentDenom) * 100);

    const systemStatus = deriveSystemStatus({
      openIncidents: openErrors,
      criticalIncidents: criticalOpenIncidents,
      heapUtilizationPct,
      paymentSuccessPct: apiSuccessRate,
    });

    const payload = {
      timestamp: new Date(now).toISOString(),
      stats: {
        totalHospitals,
        totalUsers,
        activeUsers24h,
        openErrors,
        systemStatus,
        apiSuccessRate,
      },
      trends: {
        hospitalsPct: pctChange(hospitalsLast30, hospitalsPrev30),
        usersPct: pctChange(profilesLast7, profilesPrev7),
        activeUsersPct: pctChange(activeUsers24h, activeUsersPrev24h),
        incidentsPct: pctChange(newIncidents7d, newIncidentsPrev7d),
        auditEvents24hPct: pctChange(auditLast24h, auditPrev24h),
      },
      capacity: {
        nodeHeapUsedMb: Math.round(heapUsedMb * 10) / 10,
        nodeHeapTotalMb: Math.round(heapTotalMb * 10) / 10,
        nodeRssMb: Math.round(rssMb * 10) / 10,
        heapUtilizationPct,
        cpuCores: os.cpus().length,
        auditEvents24h: auditLast24h,
        globalQueueDepth: queueDepth,
        redisConfigured: Boolean(
          process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
        ),
      },
      performance: {
        clinicalEvents24h,
        clinicalEventsPrev24h,
        throughputVsPrior24hPct: pctChange(clinicalEvents24h, clinicalEventsPrev24h),
        breakdown: {
          appointments: appointments24h,
          labOrders: labReq24h,
          checkins: checkins24h,
          consultations: consultations24h,
        },
      },
      sparkline: {
        auditDailyLast7: dailyLast7,
        appointmentsDailyLast7: appointmentsDailyLast7,
      },
      bottlenecks: {
        topQueues: queueByHospital.map(row => ({
          hospitalId: row.hospitalId,
          hospitalName: hospitalNameById.get(row.hospitalId) ?? 'Unknown facility',
          tokens: row._count,
        })),
        topAuditActions24h: topAuditActions.map(row => ({
          action: row.action,
          count: row._count,
        })),
        labRequestsOver48h: labStuck,
        failedDataExchanges7d: stuckExchanges,
      },
      forecast: {
        auditEventsNext7d: forecast.projectedTotal,
        auditEventsLast7d: forecast.last7Total,
        deltaPctVsLast7: forecast.deltaPctVsLast7,
        method: 'linear_trend_on_daily_audit_counts',
      },
      forecastAppointments: {
        appointmentsNext7d: appointmentForecast.projectedTotal,
        appointmentsLast7d: appointmentForecast.last7Total,
        deltaPctVsLast7: appointmentForecast.deltaPctVsLast7,
        method: 'linear_trend_on_daily_appointment_creates_utc',
      },
    };

    cache = { payload, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=25' },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin dashboard API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/superadmin/dashboard', method: 'GET' } });
    return NextResponse.json({ error: 'Failed to build dashboard metrics' }, { status: 500 });
  }
}

