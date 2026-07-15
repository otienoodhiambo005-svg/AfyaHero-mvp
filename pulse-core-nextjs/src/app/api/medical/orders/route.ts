 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export type MedicalPendingResultRow = {
  id: string;
  patient: string;
  test: string;
  ordered: string;
  resulted: string;
  summary: string;
  flag: 'CRITICAL' | 'HIGH' | 'LOW' | 'NORMAL';
};

export type MedicalMyOrderRow = {
  id: string;
  patient: string;
  test: string;
  priority: 'STAT' | 'Urgent' | 'Routine';
  orderedAt: string;
  status: 'Pending' | 'Processing' | 'Completed';
};

const TZ = 'Africa/Nairobi';
const timeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return timeFmt.format(d);
}

function summarizeResults(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return '—';
  const parts = raw.slice(0, 4).map((entry) => {
    if (!entry || typeof entry !== 'object') return '';
    const o = entry as Record<string, unknown>;
    const name = String(o.parameter ?? o.name ?? 'Result');
    const value = String(o.value ?? '');
    const unit = o.unit != null && String(o.unit).length > 0 ? ` ${String(o.unit)}` : '';
    if (!value) return '';
    return `${name} ${value}${unit}`.trim();
  }).filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : '—';
}

function flagFromLab(
  critical: boolean,
  abnormal: boolean,
  results: unknown,
): MedicalPendingResultRow['flag'] {
  if (critical) return 'CRITICAL';
  if (abnormal) return 'HIGH';
  if (Array.isArray(results)) {
    for (const entry of results) {
      if (!entry || typeof entry !== 'object') continue;
      const f = String((entry as Record<string, unknown>).flag ?? '').toUpperCase();
      if (f === 'HH' || f === 'LL' || f === 'CRITICAL') return 'CRITICAL';
      if (f === 'H' || f === 'L' || f === 'A') return 'HIGH';
    }
  }
  return 'NORMAL';
}

function mapPriority(p: string): MedicalMyOrderRow['priority'] {
  const x = p.toLowerCase();
  if (x === 'stat') return 'STAT';
  if (x === 'urgent') return 'Urgent';
  return 'Routine';
}

function mapOrderStatus(status: string): MedicalMyOrderRow['status'] {
  const s = status.toLowerCase();
  if (s === 'processing' || s === 'sample-collected') return 'Processing';
  if (s === 'completed' || s === 'verified') return 'Completed';
  return 'Pending';
}

const CreateLabOrderSchema = z.object({
  patientId: z.string().uuid().optional(),
  patientQuery: z.string().trim().min(2).max(120).optional(),
  testName: z.string().trim().min(2).max(160),
  panel: z.string().trim().max(120).optional(),
  sampleType: z.string().trim().max(80).optional(),
  priority: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  notes: z.string().trim().max(2000).optional(),
}).superRefine((data, ctx) => {
  if (!data.patientId && !data.patientQuery) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide patientId or patientQuery.',
      path: ['patientId'],
    });
  }
});

function buildLabId(now: Date): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LAB-${stamp}-${rand}`;
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:orders',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const hospitalId = guard.session.hospitalId;
  const actorId = guard.session.id;

  try {
    const acked = await prisma.auditLog.findMany({
      where: {
        actorId,
        action: 'medical_lab_result_acknowledged',
        resourceType: 'LabRequest',
        hospitalId,
      },
      select: { resourceId: true },
    });
    const ackedIds = new Set(
      acked
        .map((row: { resourceId: string | null }) => row.resourceId)
        .filter((id: string | null): id is string => typeof id === 'string' && id.length > 0),
    );

    const labRows = await prisma.labRequest.findMany({
      where: { hospitalId },
      include: {
        patient: { select: { name: true, idNumber: true, id: true } },
      },
      orderBy: { orderedAt: 'desc' },
      take: 200,
    });

    const pendingResults: MedicalPendingResultRow[] = [];
    const myOrders: MedicalMyOrderRow[] = [];

    for (const row of labRows) {
      const hasResultPayload = Array.isArray(row.results) && (row.results as unknown[]).length > 0;
      const isResulted = row.status === 'completed' || row.status === 'verified';

      if (isResulted && hasResultPayload && !ackedIds.has(row.id)) {
        pendingResults.push({
          id: row.id,
          patient: row.patient.name,
          test: row.testName,
          ordered: formatTime(row.orderedAt),
          resulted: formatTime(row.completedAt ?? row.verifiedAt ?? row.orderedAt),
          summary: summarizeResults(row.results),
          flag: flagFromLab(row.critical, row.abnormal, row.results),
        });
      }

      if (row.orderedBy === actorId) {
        myOrders.push({
          id: row.id,
          patient: row.patient.name,
          test: row.testName,
          priority: mapPriority(row.priority),
          orderedAt: formatTime(row.orderedAt),
          status: mapOrderStatus(row.status),
        });
      }
    }

    pendingResults.sort((a, b) => a.resulted.localeCompare(b.resulted));

    return NextResponse.json({ pendingResults, myOrders }, { status: 200 });
  } catch (err) {
    logger.error('medical orders GET failed', { err });
    return NextResponse.json(
      { error: 'Unable to load lab orders for your hospital.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:medical:orders',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = CreateLabOrderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid lab order payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const hospitalId = guard.session.hospitalId;
  const actorId = guard.session.id;
  const payload = parsed.data;

  try {
    const patient = payload.patientId
      ? await prisma.patient.findFirst({
          where: { id: payload.patientId, hospitalId },
          select: { id: true, name: true, idNumber: true },
        })
      : await prisma.patient.findFirst({
          where: {
            hospitalId,
            OR: [
              { name: { contains: payload.patientQuery ?? '', mode: 'insensitive' } },
              { idNumber: { equals: payload.patientQuery ?? '', mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, idNumber: true },
          orderBy: { createdAt: 'desc' },
        });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found in your hospital.' }, { status: 404 });
    }

    const now = new Date();
    const labId = buildLabId(now);
    const priority = payload.priority === 'stat' ? 'STAT' : payload.priority;

    const created = await prisma.$transaction(async (tx) => {
      const labRequest = await tx.labRequest.create({
        data: {
          hospitalId,
          labId,
          patientId: patient.id,
          orderedBy: actorId,
          testName: payload.testName,
          panel: payload.panel ?? null,
          sampleType: payload.sampleType ?? null,
          priority,
          status: 'ordered',
          notes: payload.notes ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'medical_lab_draw_requested',
          actorId,
          actorEmail: guard.session?.email ?? undefined,
          actorRole: guard.session?.role,
          hospitalId,
          resourceType: 'LabRequest',
          resourceId: labRequest.id,
          detail: {
            patientId: patient.id,
            patientName: patient.name,
            testName: payload.testName,
            source: 'medical-orders-page',
          },
        },
      });

      return labRequest;
    });

    return NextResponse.json(
      {
        order: {
          id: created.id,
          labId: created.labId,
          patient: patient.name,
          test: created.testName,
          priority: created.priority,
          status: created.status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('medical orders POST failed', { err });
    return NextResponse.json(
      { error: 'Unable to create lab request for this patient.' },
      { status: 500 },
    );
  }
}
