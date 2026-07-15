 
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const CreateSchema = z.object({
  patientName: z.string().min(1).max(200),
  patientRef: z.string().min(1).max(64).optional(),
  destination: z.enum(['Medical', 'Lab', 'Pharmacy', 'Imaging']),
  reason: z.string().min(1).max(500),
  urgency: z.enum(['Urgent', 'Routine']),
});

function formatTimeInTz(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-KE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

async function nextUniqueOrderRef(hospitalId: string): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const suffix = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    const orderRef = `RO-${suffix}`;
    const clash = await prisma.receptionRoutingOrder.findFirst({
      where: { hospitalId, orderRef },
      select: { id: true },
    });
    if (!clash) return orderRef;
  }
  const fallback = `RO-${randomBytes(8).toString('hex').toUpperCase()}`;
  return fallback;
}

export async function GET(_req: NextRequest) {
  const guard = await enforceApiGuard(_req, {
    scope: 'api:reception:orders',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: guard.session.hospitalId },
      select: { timezone: true },
    });
    const tz = hospital?.timezone ?? 'Africa/Nairobi';

    const rows = await prisma.receptionRoutingOrder.findMany({
      where: { hospitalId: guard.session.hospitalId },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });

    const orders = rows.map(r => ({
      id: r.id,
      code: r.orderRef,
      patient: r.patientName,
      pid: r.patientRef,
      destination: r.destination as 'Medical' | 'Lab' | 'Pharmacy' | 'Imaging',
      reason: r.reason,
      urgency: r.urgency as 'Urgent' | 'Routine',
      status: r.status as 'Pending' | 'Acknowledged' | 'Completed',
      time: formatTimeInTz(r.createdAt, tz),
    }));

    return NextResponse.json({ orders, timezone: tz });
  } catch (err) {
    logger.error('reception orders GET failed', { err });
    return NextResponse.json({ error: 'Could not load routing orders.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:reception:orders-create',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid routing order payload.' }, { status: 400 });
  }

  const patientRef =
    parsed.data.patientRef?.trim() ||
    `REF-${randomBytes(3).toString('hex').toUpperCase()}`;

  try {
    const orderRef = await nextUniqueOrderRef(guard.session.hospitalId);
    const created = await prisma.receptionRoutingOrder.create({
      data: {
        hospitalId: guard.session.hospitalId,
        orderRef,
        patientName: parsed.data.patientName.trim(),
        patientRef,
        destination: parsed.data.destination,
        reason: parsed.data.reason.trim(),
        urgency: parsed.data.urgency,
        status: 'Pending',
      },
    });

    return NextResponse.json(
      {
        ok: true,
        order: {
          id: created.id,
          code: created.orderRef,
          patient: created.patientName,
          pid: created.patientRef,
          destination: created.destination,
          reason: created.reason,
          urgency: created.urgency,
          status: created.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('reception orders POST failed', { err });
    return NextResponse.json({ error: 'Could not create routing order.' }, { status: 500 });
  }
}
