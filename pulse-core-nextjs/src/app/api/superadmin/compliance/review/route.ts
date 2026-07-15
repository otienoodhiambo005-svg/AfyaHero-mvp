/**
 * Record super-admin review of a high-risk compliance audit row (appends audit trail).
 * POST /api/superadmin/compliance/review
 */
 
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import type { UserSession } from '@/types';
import {
  auditActionLooksHighRiskCompliance,
  COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
} from '@/lib/superadmin/compliance-queries';

const BodySchema = z.object({
  auditLogId: z.string().uuid('Invalid audit log id'),
  note: z.string().max(2000).optional(),
});

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

export async function POST(request: NextRequest) {
  try {
    const guard = await enforceApiGuard(request, {
      scope: 'api:superadmin:compliance:review',
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const hospitalDenied = ensureGlobalSuperAdmin(guard.session);
    if (hospitalDenied) return hospitalDenied;

    const session = guard.session;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await readJsonBody(request);
    if (raw instanceof NextResponse) return raw;

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const target = await prisma.auditLog.findUnique({
      where: { id: parsed.data.auditLogId },
    });
    if (!target) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 });
    }
    if (!target.hospitalId) {
      return NextResponse.json(
        { error: 'Only facility-scoped compliance events can be reviewed from this screen.' },
        { status: 400 },
      );
    }
    if (!auditActionLooksHighRiskCompliance(target.action)) {
      return NextResponse.json({ error: 'This audit entry is not eligible for compliance review.' }, { status: 400 });
    }

    const existing = await prisma.auditLog.findFirst({
      where: {
        action: COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
        resourceId: parsed.data.auditLogId,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Already reviewed', auditLogId: existing.id },
        { status: 409 },
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const log = await prisma.auditLog.create({
      data: {
        action: COMPLIANCE_SUPERADMIN_REVIEW_ACTION,
        actorId: session.id,
        actorEmail: session.email,
        actorRole: 'super_admin',
        hospitalId: target.hospitalId,
        resourceType: 'audit_log',
        resourceId: parsed.data.auditLogId,
        detail: {
          originalAction: target.action,
          originalCreatedAt: target.createdAt.toISOString(),
          note: parsed.data.note?.trim() || undefined,
        },
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      ok: true,
      reviewAuditLogId: log.id,
      message: 'Review recorded on the audit trail.',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Superadmin compliance review API error', { error: err.message });
    Sentry.captureException(err, { tags: { endpoint: '/api/superadmin/compliance/review', method: 'POST' } });
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 });
  }
}
