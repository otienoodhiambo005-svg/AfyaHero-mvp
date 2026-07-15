import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export type PharmacyQueuePriority = 'Urgent' | 'Normal';
export type PharmacyQueueStatus = 'Waiting' | 'Counseling' | 'Dispensing' | 'Completed';

export interface PharmacyQueueItemDto {
  prescriptionId: string;
  token: string;
  patient: string;
  rx: string;
  items: number;
  wait: number;
  priority: PharmacyQueuePriority;
  status: PharmacyQueueStatus;
}

function mapDbStatusToQueueStatus(dbStatus: string): PharmacyQueueStatus {
  const s = dbStatus.toLowerCase();
  if (s === 'pending') return 'Waiting';
  if (s === 'on-hold') return 'Counseling';
  if (s === 'dispensing' || s === 'partial') return 'Dispensing';
  return 'Completed';
}

function mapPriority(dbPriority: string): PharmacyQueuePriority {
  const p = dbPriority.toLowerCase();
  return p === 'urgent' || p === 'critical' ? 'Urgent' : 'Normal';
}

function tokenFromRx(rxNumber: string): string {
  const tail = rxNumber.replace(/^RX-?/i, '').replace(/\D/g, '').slice(-4);
  return tail.length ? `P-${tail}` : `P-${rxNumber.slice(-4)}`;
}

function waitMinutes(prescribedAt: Date): number {
  return Math.max(0, Math.round((Date.now() - prescribedAt.getTime()) / 60_000));
}

function toDto(row: {
  id: string;
  rxNumber: string;
  prescribedAt: Date;
  status: string;
  priority: string;
  items: unknown;
  patient: { name: string } | null;
}): PharmacyQueueItemDto {
  const itemsCount = Array.isArray(row.items) ? row.items.length : 0;
  return {
    prescriptionId: row.id,
    token: tokenFromRx(row.rxNumber),
    patient: row.patient?.name ?? 'Unknown patient',
    rx: row.rxNumber,
    items: itemsCount,
    wait: waitMinutes(row.prescribedAt),
    priority: mapPriority(row.priority),
    status: mapDbStatusToQueueStatus(row.status),
  };
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:pharmacy:queue',
    roles: ['pharmacy', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  try {
    const rows = await prisma.prescription.findMany({
      where: { hospitalId: guard.session!.hospitalId },
      orderBy: { prescribedAt: 'desc' },
      take: 80,
      include: {
        patient: { select: { name: true } },
      },
    });

    const items = rows.map(r =>
      toDto({
        id: r.id,
        rxNumber: r.rxNumber,
        prescribedAt: r.prescribedAt,
        status: r.status,
        priority: r.priority,
        items: r.items,
        patient: r.patient,
      }),
    );

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    logger.error('Pharmacy queue GET failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId: guard.session?.hospitalId,
    });
    return NextResponse.json({ error: 'Could not load dispensing queue.' }, { status: 500 });
  }
}

const PostBodySchema = z
  .object({
    action: z.enum(['start', 'call_next']),
    prescriptionId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'start' && !data.prescriptionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'prescriptionId is required when action is start.',
        path: ['prescriptionId'],
      });
    }
  });

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:pharmacy:queue',
    roles: ['pharmacy', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid queue action payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const hospitalId = guard.session!.hospitalId;

  try {
    if (parsed.data.action === 'start') {
      const prescriptionId = parsed.data.prescriptionId!;
      const updated = await prisma.prescription.updateMany({
        where: {
          id: prescriptionId,
          hospitalId,
          status: { in: ['pending', 'on-hold'] },
        },
        data: { status: 'dispensing' },
      });

      if (updated.count === 0) {
        return NextResponse.json(
          { error: 'Prescription is not in a queue state that can be started, or it does not belong to your facility.' },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { success: true, message: 'Patient moved to active dispensing.' },
        { status: 200 },
      );
    }

    const next = await prisma.prescription.findFirst({
      where: { hospitalId, status: 'pending' },
      orderBy: { prescribedAt: 'asc' },
      select: { id: true },
    });

    if (!next) {
      return NextResponse.json({ error: 'No prescriptions are currently waiting in queue.' }, { status: 404 });
    }

    const updated = await prisma.prescription.updateMany({
      where: { id: next.id, hospitalId, status: 'pending' },
      data: { status: 'dispensing' },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'That queue slot was just claimed by another workstation. Try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, message: 'Next waiting prescription is now active at the counter.' }, { status: 200 });
  } catch (error) {
    logger.error('Pharmacy queue POST failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
      action: parsed.data.action,
    });
    return NextResponse.json({ error: 'Could not update queue.' }, { status: 500 });
  }
}
