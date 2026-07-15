import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const SaveSoapSchema = z.object({
  patientRef: z.string().min(1).max(64),
  patientName: z.string().min(2).max(120),
  subjective: z.string().max(10000).default(''),
  objective: z.string().max(10000).default(''),
  assessment: z.string().max(10000).default(''),
  plan: z.string().max(10000).default(''),
});

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:encounter-notes',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = SaveSoapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid SOAP payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const now = new Date();

  const audit = await prisma.auditLog.create({
    data: {
      action: 'medical_soap_note_saved',
      actorId: guard.session.id,
      actorEmail: guard.session.email ?? undefined,
      actorRole: guard.session.role,
      hospitalId: guard.session.hospitalId,
      resourceType: 'PatientSOAPNote',
      resourceId: payload.patientRef,
      detail: {
        patientName: payload.patientName,
        subjective: payload.subjective,
        objective: payload.objective,
        assessment: payload.assessment,
        plan: payload.plan,
        source: 'medical-portal',
      },
      createdAt: now,
    },
  });

  logger.info('SOAP note persisted', {
    patientRef: payload.patientRef,
    hospitalId: guard.session.hospitalId,
    actorId: guard.session.id,
    auditId: audit.id,
  });

  return NextResponse.json(
    {
      saved: true,
      noteId: audit.id,
      date: now.toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      author: guard.session.name ?? guard.session.email ?? 'Medical Clinician',
      subjective: payload.subjective,
      objective: payload.objective,
      assessment: payload.assessment,
      plan: payload.plan,
    },
    { status: 200 },
  );
}

