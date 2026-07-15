import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const DispenseSchema = z.object({
  rxNum: z.string().min(3).max(40),
  patient: z.string().min(2).max(120),
  items: z.number().int().min(1).max(50),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:pharmacy:dispense',
    roles: ['pharmacy', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = DispenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid dispense payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  const scopedIdempotencyKey = idempotencyKey
    ? `pharmacy-dispense:${guard.session!.hospitalId}:${guard.session!.id}:${parsed.data.rxNum}:${idempotencyKey}`
    : null;
  if (scopedIdempotencyKey) {
    const cached = readIdempotencyCache(scopedIdempotencyKey);
    if (cached) {
      return NextResponse.json(cached.payload, { status: cached.status });
    }
  }

  const prescription = await prisma.prescription.findFirst({
    where: {
      rxNumber: parsed.data.rxNum,
      hospitalId: guard.session!.hospitalId,
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!prescription) {
    logger.warn('Dispense target prescription not found', {
      rxNum: parsed.data.rxNum,
      hospitalId: guard.session?.hospitalId,
    });
    return NextResponse.json({ error: 'Prescription not found for dispensing.' }, { status: 404 });
  }

  const expectedPatient = prescription.patient?.name ?? '';
  if (expectedPatient && normalizeName(expectedPatient) !== normalizeName(parsed.data.patient)) {
    return NextResponse.json(
      {
        error: 'Patient does not match prescription owner.',
        expectedPatient,
      },
      { status: 409 },
    );
  }

  const prescribedItems = Array.isArray(prescription.items) ? prescription.items.length : 0;
  if (prescribedItems > 0 && parsed.data.items > prescribedItems) {
    return NextResponse.json(
      {
        error: 'Dispense item count exceeds prescribed items.',
        prescribedItems,
      },
      { status: 400 },
    );
  }

  if (prescription.status === 'dispensed') {
    return NextResponse.json(
      { error: 'Prescription is already dispensed.' },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const updated = await prisma.prescription.updateMany({
    where: {
      rxNumber: parsed.data.rxNum,
      hospitalId: guard.session!.hospitalId,
      status: { not: 'dispensed' },
    },
    data: {
      status: 'dispensed',
      dispensedAt: new Date(now),
      dispensedBy: guard.session!.id,
    },
  });

  if (updated.count === 0) {
    logger.warn('Dispense target prescription was not updated', {
      rxNum: parsed.data.rxNum,
      hospitalId: guard.session?.hospitalId,
    });
    return NextResponse.json({ error: 'Prescription was not updated.' }, { status: 409 });
  }

  const responsePayload = {
    success: true,
    rxNum: parsed.data.rxNum,
    patient: parsed.data.patient,
    status: 'Dispensed',
    dispensedAt: now,
    dispensedBy: guard.session?.id,
  };

  if (scopedIdempotencyKey) {
    writeIdempotencyCache(scopedIdempotencyKey, { status: 200, payload: responsePayload });
  }

  return NextResponse.json(responsePayload, { status: 200 });
}
