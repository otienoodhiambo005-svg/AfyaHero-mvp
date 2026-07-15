/**
 * GET  /api/superadmin/hospitals/[id]/governance — oversight drill-down (incidents, breaches, audits, controls).
 * POST /api/superadmin/hospitals/[id]/governance — record oversight action (audit trail).
 * super_admin only.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import {
  governanceSummaryOrEmpty,
  loadGovernanceSummariesForHospitals,
} from '@/lib/superadmin/hospital-governance';
import { loadFacilityAnomalyAlerts } from '@/lib/superadmin/governance-anomalies';

const postBodySchema = z.object({
  type: z.enum(['mark_reviewed', 'request_follow_up']),
  note: z.string().max(2000).optional(),
});

const OPEN_INCIDENT = ['open', 'investigating'] as const;
const BREACH_CLOSED = ['resolved', 'closed'] as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:hospitals:governance',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { id: hospitalId } = await context.params;
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        _count: { select: { profiles: true, patients: true } },
      },
    });

    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [govMap, openIncidents, activeBreaches, sensitiveAudits, controlBreakdown, lastOversight, anomalyAlerts] =
      await Promise.all([
        loadGovernanceSummariesForHospitals(prisma, [hospital]),
        prisma.securityIncident.findMany({
          where: { hospitalId, status: { in: [...OPEN_INCIDENT] } },
          orderBy: { detectedAt: 'desc' },
          take: 15,
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            category: true,
            detectedAt: true,
          },
        }),
        prisma.dataBreachLog.findMany({
          where: {
            hospitalId,
            status: { notIn: [...BREACH_CLOSED] },
          },
          orderBy: { detectedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            breachType: true,
            severity: true,
            status: true,
            affectedRecords: true,
            detectedAt: true,
            description: true,
          },
        }),
        prisma.auditLog.findMany({
          where: {
            hospitalId,
            createdAt: { gte: since },
            OR: [
              { action: { contains: 'EXPORT', mode: 'insensitive' } },
              { action: { contains: 'export', mode: 'insensitive' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            action: true,
            actorEmail: true,
            actorRole: true,
            resourceType: true,
            resourceId: true,
            createdAt: true,
          },
        }),
        prisma.securityControl.groupBy({
          by: ['implementationStatus'],
          where: { hospitalId },
          _count: { _all: true },
        }),
        prisma.auditLog.findFirst({
          where: {
            hospitalId,
            action: { in: ['FACILITY_OVERSIGHT_REVIEWED', 'FACILITY_OVERSIGHT_FOLLOW_UP'] },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            createdAt: true,
            actorEmail: true,
            detail: true,
          },
        }),
        loadFacilityAnomalyAlerts(prisma, hospitalId),
      ]);

    return NextResponse.json({
      hospital: {
        id: hospital.id,
        name: hospital.name,
        isActive: hospital.isActive,
        email: hospital.email,
        licenseNumber: hospital.licenseNumber,
        location: hospital.location,
        _count: hospital._count,
      },
      governance: governanceSummaryOrEmpty(govMap, hospital.id),
      drilldown: {
        openIncidents,
        activeBreaches,
        sensitiveAudits30d: sensitiveAudits,
        securityControlBreakdown: controlBreakdown.map(r => ({
          implementationStatus: r.implementationStatus,
          count: r._count._all,
        })),
        lastOversightAction: lastOversight,
        anomalyAlerts,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin hospital governance GET error', { error: err.message });
    Sentry.captureException(err, {
      tags: { endpoint: '/api/superadmin/hospitals/[id]/governance', method: 'GET' },
    });
    return NextResponse.json({ error: 'Failed to load governance drill-down' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:hospitals:governance',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const bodyUnknown = await readJsonBody(request);
    if (bodyUnknown instanceof NextResponse) return bodyUnknown;

    const parsed = postBodySchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id: hospitalId } = await context.params;
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true },
    });
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital not found' }, { status: 404 });
    }

    const { session } = guard;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const action =
      parsed.data.type === 'mark_reviewed'
        ? 'FACILITY_OVERSIGHT_REVIEWED'
        : 'FACILITY_OVERSIGHT_FOLLOW_UP';

    const log = await prisma.auditLog.create({
      data: {
        action,
        actorId: session.id,
        actorEmail: session.email,
        actorRole: 'super_admin',
        hospitalId,
        resourceType: 'Hospital',
        resourceId: hospitalId,
        detail: {
          facilityName: hospital.name,
          note: parsed.data.note?.trim() || undefined,
          oversightType: parsed.data.type,
        },
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      ok: true,
      auditLogId: log.id,
      action: log.action,
      message:
        parsed.data.type === 'mark_reviewed'
          ? 'Oversight review recorded on the audit trail.'
          : 'Follow-up request recorded; facility admins should be notified per your internal process.',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin hospital governance POST error', { error: err.message });
    Sentry.captureException(err, {
      tags: { endpoint: '/api/superadmin/hospitals/[id]/governance', method: 'POST' },
    });
    return NextResponse.json({ error: 'Failed to record oversight action' }, { status: 500 });
  }
}
