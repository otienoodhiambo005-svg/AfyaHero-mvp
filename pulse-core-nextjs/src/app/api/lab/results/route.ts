/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const LAB_ROLES = ['lab', 'admin', 'super_admin'] as const;

export type ApiLabPendingVerificationRow = {
  /** Lab request primary key (UUID) — use with PATCH /api/lab/orders verify */
  id: string;
  labId: string;
  patient: string;
  test: string;
  keyResults: string;
  flag: 'Normal' | 'Abnormal' | 'Critical';
  tech: string;
  time: string;
};

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

function formatKeyResults(results: Prisma.JsonValue | null): string {
  const n = normalizeResults(results);
  if (!n || Object.keys(n).length === 0) return '—';
  return Object.entries(n)
    .slice(0, 6)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
}

function timeHm(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function techFromNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return '—';
  const m = /Collected\s+by\s+([A-Za-z0-9.\s]+?)(?:\s·|\s*$)/i.exec(notes.trim());
  if (m?.[1]) return m[1].trim().slice(0, 24);
  return '—';
}

function resultFlag(critical: boolean, abnormal: boolean): ApiLabPendingVerificationRow['flag'] {
  if (critical) return 'Critical';
  if (abnormal) return 'Abnormal';
  return 'Normal';
}

function utcDayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-results-read',
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
      {
        error: 'Hospital context is required for lab results.',
        pending: [] as ApiLabPendingVerificationRow[],
        verifiedTodayCount: 0,
      },
      { status: 403 },
    );
  }

  try {
    const { start, end } = utcDayBounds();

    const [pendingRows, verifiedTodayCount] = await Promise.all([
      prisma.labRequest.findMany({
        where: { hospitalId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 100,
        include: {
          patient: { select: { name: true } },
        },
      }),
      prisma.labRequest.count({
        where: {
          hospitalId,
          status: 'verified',
          verifiedAt: { gte: start, lt: end },
        },
      }),
    ]);

    const pending: ApiLabPendingVerificationRow[] = pendingRows.map((r: any) => ({
      id: r.id,
      labId: r.labId,
      patient: r.patient.name,
      test: r.testName,
      keyResults: formatKeyResults(r.results),
      flag: resultFlag(r.critical, r.abnormal),
      tech: techFromNotes(r.notes),
      time: timeHm(r.completedAt ?? r.orderedAt),
    }));

    return NextResponse.json({
      pending,
      verifiedTodayCount,
    });
  } catch (error) {
    logger.error('lab results GET failed', {
      hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'Unable to load lab results queue.',
        pending: [] as ApiLabPendingVerificationRow[],
        verifiedTodayCount: 0,
      },
      { status: 500 },
    );
  }
}
