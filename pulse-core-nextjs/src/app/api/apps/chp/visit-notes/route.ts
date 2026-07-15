/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { auditChpAction, chpError, requireChpPrincipal } from '@/lib/apps/chp/guard';

const VisitNoteSchema = z.object({
  patientId: z.string().uuid(),
  note: z.string().trim().min(5).max(5000),
  visitDate: z.coerce.date().optional(),
  region: z.string().trim().min(2).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const guard = await requireChpPrincipal(req, 'fhir:write');
  if (guard.response) return guard.response;
  const principal = guard.principal;
  if (!principal) return chpError(401, 'UNAUTHORIZED', 'Missing CHP principal.');

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return chpError(400, 'BAD_REQUEST', 'Invalid JSON payload.');
  }

  const parsed = VisitNoteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid visit note payload.',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  try {
    const { prisma } = await import('@/lib/database');
    const payload = parsed.data;

    const patient = await prisma.patient.findFirst({
      where: {
        id: payload.patientId,
        hospitalId: principal.hospitalId,
      },
      select: { id: true, name: true },
    });

    if (!patient) {
      return chpError(403, 'FORBIDDEN', 'Patient is outside CHP tenant scope.');
    }

    const created = await prisma.auditLog.create({
      data: {
        action: 'chp_app.visit_note.create',
        actorId: principal.subjectId ?? principal.appId,
        actorEmail: `${principal.appId}@chp.app`,
        actorRole: 'chp_app',
        hospitalId: principal.hospitalId,
        resourceType: 'VisitNote',
        resourceId: payload.patientId,
        detail: {
          patientId: payload.patientId,
          patientName: patient.name,
          note: payload.note,
          visitDate: payload.visitDate?.toISOString() ?? null,
          region: payload.region ?? null,
          tags: payload.tags ?? [],
        },
      },
    });

    await auditChpAction(req, principal, 'chp_app.visit_note.audit', 'VisitNote', {
      patientId: payload.patientId,
      auditId: created.id,
    });

    return NextResponse.json(
      {
        ok: true,
        visitNoteId: created.id,
        patientId: payload.patientId,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('chp visit-notes POST failed', {
      appId: principal.appId,
      hospitalId: principal.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unable to persist visit note.' },
      },
      { status: 500 },
    );
  }
}
