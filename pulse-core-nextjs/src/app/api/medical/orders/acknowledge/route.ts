import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const BodySchema = z.object({
  labRequestId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:orders-ack',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { labRequestId } = parsed.data;
  const hospitalId = guard.session.hospitalId;

  try {
    const lab = await prisma.labRequest.findFirst({
      where: { id: labRequestId, hospitalId },
      select: {
        id: true,
        status: true,
        testName: true,
        patientId: true,
      },
    });

    if (!lab) {
      return NextResponse.json({ error: 'Lab request not found.' }, { status: 404 });
    }

    const st = lab.status.toLowerCase();
    if (st !== 'completed' && st !== 'verified') {
      return NextResponse.json(
        { error: 'Only completed or verified results can be acknowledged.' },
        { status: 400 },
      );
    }

    await prisma.auditLog.create({
      data: {
        action: 'medical_lab_result_acknowledged',
        actorId: guard.session.id,
        actorEmail: guard.session.email ?? undefined,
        actorRole: guard.session.role,
        hospitalId,
        resourceType: 'LabRequest',
        resourceId: lab.id,
        detail: {
          testName: lab.testName,
          patientId: lab.patientId,
          source: 'medical-portal-orders',
        },
      },
    });

    logger.info('Medical lab result acknowledged', {
      labRequestId: lab.id,
      hospitalId,
      actorId: guard.session.id,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error('medical orders acknowledge failed', { err });
    return NextResponse.json({ error: 'Could not record acknowledgment.' }, { status: 500 });
  }
}
