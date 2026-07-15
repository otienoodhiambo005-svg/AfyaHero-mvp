import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const CarePlanPayloadSchema = z.object({
  patientRef: z.string().trim().min(1).max(64),
  patientName: z.string().trim().min(2).max(160).optional(),
  carePlan: z.string().trim().min(3).max(10000),
  communityFollowUpRequired: z.boolean(),
  followUpReason: z.string().trim().max(2000).optional(),
  followUpDueAt: z.string().datetime().optional(),
  source: z.string().trim().max(80).optional(),
});

const CARE_PLAN_ACTION = 'chp_app.care_plan.upsert';
const CARE_PLAN_RESOURCE = 'CHPCarePlan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:apps:chp:care-plan',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ ok: false, error: 'Missing hospital context.' }, { status: 400 });
  }

  const patientRef = req.nextUrl.searchParams.get('patientRef')?.trim();
  if (!patientRef) {
    return NextResponse.json(
      { ok: false, error: 'patientRef query parameter is required.' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.auditLog.findFirst({
      where: {
        hospitalId: guard.session.hospitalId,
        action: CARE_PLAN_ACTION,
        resourceType: CARE_PLAN_RESOURCE,
        resourceId: patientRef,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        actorId: true,
        actorEmail: true,
        actorRole: true,
        detail: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: true, found: false, patientRef, message: 'No CHP care plan found for patient.' },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        found: true,
        patientRef,
        carePlanId: existing.id,
        recordedAt: existing.createdAt.toISOString(),
        actor: {
          id: existing.actorId,
          email: existing.actorEmail,
          role: existing.actorRole,
        },
        payload: existing.detail,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('CHP care plan lookup failed', {
      patientRef,
      hospitalId: guard.session.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to load CHP care plan for patient.',
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:apps:chp:care-plan',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ ok: false, error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = CarePlanPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid care plan payload.',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const now = new Date();

  try {
    const existing = await prisma.auditLog.findFirst({
      where: {
        hospitalId: guard.session.hospitalId,
        action: CARE_PLAN_ACTION,
        resourceType: CARE_PLAN_RESOURCE,
        resourceId: payload.patientRef,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const detailPayload: Prisma.InputJsonObject = {
      patientRef: payload.patientRef,
      patientName: payload.patientName ?? null,
      carePlan: payload.carePlan,
      communityFollowUpRequired: payload.communityFollowUpRequired,
      followUpReason: payload.followUpReason ?? null,
      followUpDueAt: payload.followUpDueAt ?? null,
      source: payload.source ?? 'medical-portal',
      updatedAt: now.toISOString(),
      supersedesId: existing?.id ?? null,
    };

    const saved = await prisma.auditLog.create({
      data: {
        action: CARE_PLAN_ACTION,
        actorId: guard.session.id,
        actorEmail: guard.session.email ?? undefined,
        actorRole: guard.session.role,
        hospitalId: guard.session.hospitalId,
        resourceType: CARE_PLAN_RESOURCE,
        resourceId: payload.patientRef,
        detail: detailPayload,
      },
    });

    logger.info('CHP care plan version appended', {
      carePlanId: saved.id,
      patientRef: payload.patientRef,
      followUpRequired: payload.communityFollowUpRequired,
      hospitalId: guard.session.hospitalId,
      actorId: guard.session.id,
      mode: 'append',
      supersedesId: existing?.id ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        action: CARE_PLAN_ACTION,
        mode: 'created',
        carePlanId: saved.id,
        patientRef: payload.patientRef,
        communityFollowUpRequired: payload.communityFollowUpRequired,
        auditable: {
          actorId: guard.session.id,
          actorRole: guard.session.role,
          hospitalId: guard.session.hospitalId,
          recordedAt: saved.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('CHP care plan upsert failed', {
      patientRef: payload.patientRef,
      hospitalId: guard.session.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to save CHP care plan.',
        },
      },
      { status: 500 },
    );
  }
}
