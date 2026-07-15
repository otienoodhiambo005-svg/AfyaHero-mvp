/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const LAB_ROLES = ['lab', 'admin', 'super_admin'] as const;

const TRACKING_WINDOW_DAYS = 30;

export type ApiLabPatientTrackRow = {
  patientId: string;
  patient: string;
  pid: string;
  ward: string;
  requested: number;
  completed: number;
  pendingCritical: number;
  lastResultAt: string;
};

function formatPid(idNumber: string | null | undefined, patientId: string): string {
  const trimmed = idNumber?.trim();
  if (trimmed) return trimmed;
  return `PID-${patientId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function timeHm(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isRejected(status: string): boolean {
  return status.toLowerCase() === 'rejected';
}

function isCompletedForProgress(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'completed' || s === 'verified';
}

function isVerified(status: string): boolean {
  return status.toLowerCase() === 'verified';
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-patients-read',
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
        error: 'Hospital context is required for patient lab tracking.',
        patients: [] as ApiLabPatientTrackRow[],
      },
      { status: 403 },
    );
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - TRACKING_WINDOW_DAYS);

  try {
    const rows = await prisma.labRequest.findMany({
      where: {
        hospitalId,
        orderedAt: { gte: since },
      },
      select: {
        patientId: true,
        status: true,
        critical: true,
        completedAt: true,
        verifiedAt: true,
        patient: { select: { id: true, name: true, idNumber: true } },
      },
    });

    type Agg = {
      patientId: string;
      patientName: string;
      idNumber: string | null;
      patientDbId: string;
      requested: number;
      completed: number;
      pendingCritical: number;
      lastResult: Date | null;
    };

    const byPatient = new Map<string, Agg>();

    for (const r of rows) {
      if (isRejected(r.status)) continue;

      const pid = r.patientId;
      let agg = byPatient.get(pid);
      if (!agg) {
        agg = {
          patientId: pid,
          patientName: r.patient.name,
          idNumber: r.patient.idNumber,
          patientDbId: r.patient.id,
          requested: 0,
          completed: 0,
          pendingCritical: 0,
          lastResult: null,
        };
        byPatient.set(pid, agg);
      }

      agg.requested += 1;
      if (isCompletedForProgress(r.status)) {
        agg.completed += 1;
      }
      if (r.critical && !isVerified(r.status)) {
        agg.pendingCritical += 1;
      }

      const candidate = r.verifiedAt ?? r.completedAt;
      if (candidate && (!agg.lastResult || candidate > agg.lastResult)) {
        agg.lastResult = candidate;
      }
    }

    const patientIds = [...byPatient.keys()];
    const wardByPatient = new Map<string, string>();

    if (patientIds.length > 0) {
      const beds = await prisma.hospitalBed.findMany({
        where: {
          hospitalId,
          patientId: { in: patientIds },
          status: { in: ['occupied', 'reserved'] },
        },
        select: { patientId: true, wardName: true },
      });
      for (const b of beds) {
        if (b.patientId && !wardByPatient.has(b.patientId)) {
          wardByPatient.set(b.patientId, b.wardName.trim() || '—');
        }
      }
    }

    const patients: ApiLabPatientTrackRow[] = [...byPatient.values()]
      .filter((a) => a.requested > 0)
      .map((a) => ({
        patientId: a.patientId,
        patient: a.patientName,
        pid: formatPid(a.idNumber, a.patientDbId),
        ward: wardByPatient.get(a.patientId) ?? 'OPD',
        requested: a.requested,
        completed: a.completed,
        pendingCritical: a.pendingCritical,
        lastResultAt: timeHm(a.lastResult),
      }))
      .sort((x, y) => {
        if (y.pendingCritical !== x.pendingCritical) return y.pendingCritical - x.pendingCritical;
        return x.patient.localeCompare(y.patient);
      });

    return NextResponse.json({ patients });
  } catch (error) {
    logger.error('lab patients GET failed', {
      hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'Unable to load patient lab tracking.',
        patients: [] as ApiLabPatientTrackRow[],
      },
      { status: 500 },
    );
  }
}
