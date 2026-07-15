/**
 * Super Admin compliance overview + high-risk audit events (super_admin, global only).
 * GET /api/superadmin/compliance
 */
 
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard } from '@/lib/api-security';
import type { UserSession } from '@/types';
import {
  COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
  highRiskComplianceAuditWhere,
} from '@/lib/superadmin/compliance-queries';
import {
  governanceSummaryOrEmpty,
  loadGovernanceSummariesForHospitals,
} from '@/lib/superadmin/hospital-governance';

const HOSPITAL_CAP = 250;
const EVENTS_LIMIT = 40;
const UNRESOLVED_SCAN_CAP = 4000;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function ensureGlobalSuperAdmin(session: UserSession | null): NextResponse | null {
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.hospitalId) {
    return NextResponse.json({ error: 'Global super administrator required.' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:compliance',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const hospitalDenied = ensureGlobalSuperAdmin(guard.session);
    if (hospitalDenied) return hospitalDenied;

    const since30 = new Date(Date.now() - WINDOW_MS);

    const hospitals = await prisma.hospital.findMany({
      orderBy: { name: 'asc' },
      take: HOSPITAL_CAP,
      select: {
        id: true,
        name: true,
        isActive: true,
        email: true,
        licenseNumber: true,
        _count: { select: { profiles: true, patients: true } },
      },
    });

    const govMap = await loadGovernanceSummariesForHospitals(prisma, hospitals);

    const byRiskLevel = { low: 0, medium: 0, high: 0, critical: 0 };
    let openSecurityIncidents = 0;
    let criticalOpenIncidents = 0;
    for (const h of hospitals) {
      const g = governanceSummaryOrEmpty(govMap, h.id);
      byRiskLevel[g.riskLevel] += 1;
      openSecurityIncidents += g.openIncidents;
      criticalOpenIncidents += g.criticalOpenIncidents;
    }

    const [totalHighRisk30d, scanRows] = await Promise.all([
      prisma.auditLog.count({ where: highRiskComplianceAuditWhere(since30) }),
      prisma.auditLog.findMany({
        where: highRiskComplianceAuditWhere(since30),
        orderBy: { createdAt: 'desc' },
        take: UNRESOLVED_SCAN_CAP,
        select: { id: true },
      }),
    ]);

    const scanIds = scanRows.map(r => r.id);
    const reviewHits =
      scanIds.length === 0
        ? []
        : await prisma.auditLog.findMany({
            where: {
              action: COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
              resourceId: { in: scanIds },
            },
            select: { resourceId: true },
          });
    const reviewedIds = new Set(
      reviewHits.map(r => r.resourceId).filter((id): id is string => Boolean(id)),
    );
    const unresolvedInScan = scanIds.filter(id => !reviewedIds.has(id)).length;
    const scanIncomplete = scanRows.length >= UNRESOLVED_SCAN_CAP && totalHighRisk30d > UNRESOLVED_SCAN_CAP;

    const events = await prisma.auditLog.findMany({
      where: highRiskComplianceAuditWhere(since30),
      orderBy: { createdAt: 'desc' },
      take: EVENTS_LIMIT,
    });

    const eventIds = events.map(e => e.id);
    const reviewsForEvents =
      eventIds.length === 0
        ? []
        : await prisma.auditLog.findMany({
            where: {
              action: COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
              resourceId: { in: eventIds },
            },
            select: { resourceId: true, createdAt: true, actorEmail: true, id: true },
            orderBy: { createdAt: 'desc' },
          });
    const latestReviewByTarget = new Map<string, { reviewedAt: string; reviewerEmail: string | null }>();
    for (const r of reviewsForEvents) {
      if (!r.resourceId) continue;
      if (!latestReviewByTarget.has(r.resourceId)) {
        latestReviewByTarget.set(r.resourceId, {
          reviewedAt: r.createdAt.toISOString(),
          reviewerEmail: r.actorEmail,
        });
      }
    }

    const hospitalIds = [...new Set(events.map(e => e.hospitalId).filter((id): id is string => Boolean(id)))];
    const hospitalRows =
      hospitalIds.length === 0
        ? []
        : await prisma.hospital.findMany({
            where: { id: { in: hospitalIds } },
            select: { id: true, name: true },
          });
    const hospitalNameById = new Map(hospitalRows.map(h => [h.id, h.name]));

    const eventsOut = events.map(e => {
      const reviewed = latestReviewByTarget.get(e.id);
      return {
        id: e.id,
        action: e.action,
        hospitalId: e.hospitalId,
        hospitalName: e.hospitalId ? hospitalNameById.get(e.hospitalId) ?? null : null,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        actorEmail: e.actorEmail,
        actorRole: e.actorRole,
        createdAt: e.createdAt.toISOString(),
        detail: e.detail ?? null,
        reviewed: Boolean(reviewed),
        reviewedAt: reviewed?.reviewedAt ?? null,
        reviewedByEmail: reviewed?.reviewerEmail ?? null,
      };
    });

    const hospitalsOut = hospitals.map(h => ({
      id: h.id,
      name: h.name,
      isActive: h.isActive,
      _count: h._count,
      governance: governanceSummaryOrEmpty(govMap, h.id),
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      scan: {
        unresolvedHighRiskInSample: unresolvedInScan,
        totalHighRiskMatched30d: totalHighRisk30d,
        unresolvedScanCap: UNRESOLVED_SCAN_CAP,
        scanIncomplete,
      },
      totals: {
        hospitalsListed: hospitalsOut.length,
        byRiskLevel,
        openSecurityIncidents,
        criticalOpenIncidents,
      },
      hospitals: hospitalsOut,
      events: eventsOut,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin compliance API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/superadmin/compliance', method: 'GET' } });
    return NextResponse.json({ error: 'Failed to load compliance overview' }, { status: 500 });
  }
}
