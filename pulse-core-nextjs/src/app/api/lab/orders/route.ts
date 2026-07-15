/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const LAB_ROLES = ['lab', 'admin', 'super_admin'] as const;

const PatchBodySchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['collect', 'process', 'verify']),
  collectorInitials: z.string().min(1).max(8).optional(),
  notes: z.string().max(2000).optional(),
  /** Test code → free-text result (persisted as JSON object) */
  results: z.record(z.string(), z.string()).optional(),
});

export type ApiLabOrderRow = {
  id: string;
  labCode: string;
  patient: string;
  pid: string;
  tests: string[];
  sampleType: string;
  requestedBy: string;
  priority: 'Routine' | 'Urgent' | 'STAT';
  orderedAt: string;
  status: 'Pending' | 'Collected' | 'Processing' | 'Completed';
  collectedAt?: string;
  processedAt?: string;
  completedAt?: string;
  collectorInitials?: string;
  results?: Record<string, string>;
};

function capitalizePriority(p: string): 'Routine' | 'Urgent' | 'STAT' {
  const x = p.toLowerCase();
  if (x === 'stat') return 'STAT';
  if (x === 'urgent') return 'Urgent';
  return 'Routine';
}

function dbStatusToUi(
  status: string,
): 'Pending' | 'Collected' | 'Processing' | 'Completed' {
  const s = status.toLowerCase();
  if (s === 'ordered' || s === 'rejected') return 'Pending';
  if (s === 'sample-collected') return 'Collected';
  if (s === 'processing') return 'Processing';
  return 'Completed';
}

function normalizeResults(raw: Prisma.JsonValue | null | undefined): Record<string, string> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const item of raw) {
      if (item && typeof item === 'object' && 'parameter' in item && 'value' in item) {
        const row = item as { parameter: string; value: string; unit?: string };
        out[row.parameter] = row.unit ? `${row.value} ${row.unit}` : String(row.value);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function timeHm(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function mapDbRowToOrder(
  r: {
    id: string;
    labId: string;
    testName: string;
    sampleType: string | null;
    priority: string;
    status: string;
    orderedAt: Date;
    collectedAt: Date | null;
    completedAt: Date | null;
    results: Prisma.JsonValue | null;
    patient: { name: string; idNumber: string | null; id: string };
    orderedByProfile: { fullName: string; title: string | null };
  },
  collectorInitials?: string,
): ApiLabOrderRow {
  const pid =
    r.patient.idNumber?.trim() ||
    `PID-${r.patient.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const requestedBy = r.orderedByProfile.title
    ? `${r.orderedByProfile.title} ${r.orderedByProfile.fullName}`
    : r.orderedByProfile.fullName;

  const st = r.status.toLowerCase();
  const processedAt =
    st === 'processing' || st === 'completed' || st === 'verified'
      ? timeHm(r.completedAt ?? r.collectedAt ?? r.orderedAt)
      : undefined;

  return {
    id: r.id,
    labCode: r.labId,
    patient: r.patient.name,
    pid,
    tests: [r.testName],
    sampleType: r.sampleType?.trim() || '—',
    requestedBy,
    priority: capitalizePriority(r.priority),
    orderedAt: timeHm(r.orderedAt) ?? '—',
    status: dbStatusToUi(r.status),
    collectedAt: timeHm(r.collectedAt),
    processedAt,
    completedAt: timeHm(r.completedAt),
    collectorInitials,
    results: normalizeResults(r.results),
  };
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-orders-read',
    roles: [...LAB_ROLES],
  });
  if (guard.response) return guard.response;
  const session = guard.session;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hospitalId = session.hospitalId;
  if (!hospitalId) {
    return NextResponse.json(
      { error: 'Hospital context is required for lab orders.', orders: [] as ApiLabOrderRow[] },
      { status: 403 },
    );
  }

  try {
    const rows = await prisma.labRequest.findMany({
      where: { hospitalId },
      orderBy: { orderedAt: 'desc' },
      take: 100,
      include: {
        patient: { select: { name: true, idNumber: true, id: true } },
        orderedByProfile: { select: { fullName: true, title: true } },
      },
    });

    const orders: ApiLabOrderRow[] = rows.map((r: any) => mapDbRowToOrder(r));

    return NextResponse.json({ orders, source: 'database' as const });
  } catch (error) {
    logger.error('lab orders GET failed', {
      hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to load lab orders.', orders: [] as ApiLabOrderRow[] },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-orders-write',
    roles: [...LAB_ROLES],
  });
  if (guard.response) return guard.response;
  const session = guard.session;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hospitalId = session.hospitalId;
  if (!hospitalId) {
    return NextResponse.json({ error: 'Hospital context is required.' }, { status: 403 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { requestId, action, collectorInitials, notes, results } = parsed.data;
  const now = new Date();

  try {
    const existing = await prisma.labRequest.findFirst({
      where: { id: requestId, hospitalId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lab request not found.' }, { status: 404 });
    }

    const st = existing.status.toLowerCase();

    if (action === 'collect') {
      if (st !== 'ordered' && st !== 'rejected') {
        return NextResponse.json({ error: 'Sample can only be collected from pending orders.' }, { status: 409 });
      }
      if (!collectorInitials?.trim()) {
        return NextResponse.json({ error: 'Collector initials are required.' }, { status: 400 });
      }
      const noteParts = [`Collected by ${collectorInitials.trim()}`];
      if (notes?.trim()) noteParts.push(notes.trim());
      await prisma.labRequest.update({
        where: { id: requestId },
        data: {
          status: 'sample-collected',
          collectedAt: now,
          notes: noteParts.join(' · '),
        },
      });
    } else if (action === 'process') {
      if (st !== 'sample-collected') {
        return NextResponse.json({ error: 'Processing is only allowed after collection.' }, { status: 409 });
      }
      const hasResults = results && Object.keys(results).length > 0;
      const prevRow = await prisma.labRequest.findFirst({
        where: { id: requestId, hospitalId },
        select: { notes: true },
      });
      const noteSuffix = notes?.trim();
      const mergedNotes =
        noteSuffix && prevRow?.notes?.trim()
          ? `${prevRow.notes} · ${noteSuffix}`
          : noteSuffix || prevRow?.notes || undefined;

      await prisma.labRequest.update({
        where: { id: requestId },
        data: {
          status: hasResults ? 'completed' : 'processing',
          ...(hasResults ? { completedAt: now } : {}),
          results: results && Object.keys(results).length ? (results as Prisma.InputJsonValue) : undefined,
          ...(mergedNotes !== undefined ? { notes: mergedNotes } : {}),
        },
      });
    } else if (action === 'verify') {
      if (st !== 'completed') {
        return NextResponse.json({ error: 'Verification is only allowed for completed results.' }, { status: 409 });
      }
      await prisma.labRequest.update({
        where: { id: requestId },
        data: {
          status: 'verified',
          verifiedAt: now,
          verifiedBy: session.id,
        },
      });
    }

    const updated = await prisma.labRequest.findFirst({
      where: { id: requestId, hospitalId },
      include: {
        patient: { select: { name: true, idNumber: true, id: true } },
        orderedByProfile: { select: { fullName: true, title: true } },
      },
    });

    if (!updated) {
      return NextResponse.json({ error: 'Lab request not found after update.' }, { status: 500 });
    }

    const order = mapDbRowToOrder(updated, collectorInitials?.trim());

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    logger.error('lab orders PATCH failed', {
      requestId,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to update lab order.' }, { status: 500 });
  }
}
