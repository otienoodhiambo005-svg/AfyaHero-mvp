import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const TZ = 'Africa/Nairobi';

const dateTimeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return dateTimeFmt.format(d);
}

export type MedicalResultsApiValue = {
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'CRITICAL' | 'HIGH' | 'LOW' | 'NORMAL';
  previous?: string;
  trend?: 'up' | 'down' | 'stable';
};

export type MedicalResultsApiInsight = {
  confidence: number;
  summary: string;
  priority: 'high' | 'normal';
};

export type MedicalResultsApiRow = {
  id: string;
  patient: string;
  pid: string;
  test: string;
  status: 'Critical' | 'Ready' | 'In Progress';
  collectedAt: string;
  receivedAt: string;
  resultedAt?: string;
  values: MedicalResultsApiValue[];
  insight?: MedicalResultsApiInsight;
};

function normalizeAnalyteFlag(raw: string | undefined): MedicalResultsApiValue['flag'] {
  const f = (raw ?? '').toUpperCase();
  if (f === 'CRITICAL' || f === 'HH' || f === 'LL') return 'CRITICAL';
  if (f === 'HIGH' || f === 'H' || f === 'A') return 'HIGH';
  if (f === 'LOW' || f === 'L') return 'LOW';
  return 'NORMAL';
}

function mapValuesFromJson(
  raw: Prisma.JsonValue | null,
  rowCritical: boolean,
  rowAbnormal: boolean,
): MedicalResultsApiValue[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out: MedicalResultsApiValue[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const o = entry as Record<string, unknown>;
      const name = String(o.parameter ?? o.name ?? 'Result');
      const value = String(o.value ?? '');
      const unit = o.unit != null ? String(o.unit) : '';
      const refRange = o.refRange != null ? String(o.refRange) : o.ref_range != null ? String(o.ref_range) : '';
      const flag = o.flag != null ? normalizeAnalyteFlag(String(o.flag)) : rowCritical ? 'CRITICAL' : rowAbnormal ? 'HIGH' : 'NORMAL';
      const previous = o.previous != null ? String(o.previous) : undefined;
      const tr = o.trend != null ? String(o.trend).toLowerCase() : undefined;
      const trend =
        tr === 'up' || tr === 'down' || tr === 'stable' ? (tr as MedicalResultsApiValue['trend']) : undefined;
      if (value.length > 0) {
        out.push({ name, value, unit, refRange, flag, previous, trend });
      }
    }
    return out;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const out: MedicalResultsApiValue[] = [];
    for (const [name, v] of Object.entries(o)) {
      const value = typeof v === 'string' ? v : v != null ? String(v) : '';
      if (!value) continue;
      out.push({
        name,
        value,
        unit: '',
        refRange: '',
        flag: rowCritical ? 'CRITICAL' : rowAbnormal ? 'HIGH' : 'NORMAL',
      });
    }
    return out;
  }
  return [];
}

function summarizeValues(values: MedicalResultsApiValue[]): string {
  if (values.length === 0) return '';
  const parts = values
    .filter((v) => v.flag !== 'NORMAL')
    .slice(0, 3)
    .map((v) => `${v.name} ${v.value}${v.unit ? ` ${v.unit}` : ''}`);
  if (parts.length > 0) return parts.join('; ');
  return values
    .slice(0, 3)
    .map((v) => `${v.name} ${v.value}${v.unit ? ` ${v.unit}` : ''}`)
    .join('; ');
}

function deriveInsight(
  testName: string,
  critical: boolean,
  abnormal: boolean,
  values: MedicalResultsApiValue[],
): MedicalResultsApiInsight {
  const detail = summarizeValues(values);
  if (critical) {
    return {
      confidence: 0.92,
      summary: detail
        ? `Critical analytes in ${testName}: ${detail}. Immediate clinical correlation is recommended.`
        : `Critical priority pattern for ${testName}. Review all parameters and correlate with presentation.`,
      priority: 'high',
    };
  }
  if (abnormal) {
    return {
      confidence: 0.78,
      summary: detail
        ? `Abnormal pattern in ${testName}: ${detail}. Trend review and correlation advised.`
        : `Abnormal findings flagged for ${testName}. Compare with prior results where available.`,
      priority: 'normal',
    };
  }
  return {
    confidence: 0.71,
    summary: `AfyaInsight™ overview for ${testName}: no critical flags; continue routine clinical interpretation.`,
    priority: 'normal',
  };
}

function mapRowStatus(critical: boolean, status: string): MedicalResultsApiRow['status'] {
  if (critical) return 'Critical';
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'verified') return 'Ready';
  return 'In Progress';
}

function hasResultPayload(raw: Prisma.JsonValue | null): boolean {
  if (raw == null) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'object') return Object.keys(raw as object).length > 0;
  return false;
}

export async function GET(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:medical:results',
    roles: ['medical', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const hospitalId = guard.session.hospitalId;

  try {
    const labRows = await prisma.labRequest.findMany({
      where: {
        hospitalId,
        status: { in: ['completed', 'verified'] },
      },
      include: {
        patient: { select: { name: true, idNumber: true, id: true } },
      },
      orderBy: [{ completedAt: 'desc' }, { verifiedAt: 'desc' }],
      take: 100,
    });

    const results: MedicalResultsApiRow[] = [];

    for (const row of labRows) {
      if (!hasResultPayload(row.results)) continue;
      const values = mapValuesFromJson(row.results, row.critical, row.abnormal);
      const pid =
        row.patient.idNumber?.trim() ||
        `MRN-${row.patient.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

      results.push({
        id: row.id,
        patient: row.patient.name,
        pid,
        test: row.testName,
        status: mapRowStatus(row.critical, row.status),
        collectedAt: formatDateTime(row.collectedAt ?? row.orderedAt),
        receivedAt: formatDateTime(row.orderedAt),
        resultedAt: formatDateTime(row.completedAt ?? row.verifiedAt ?? row.orderedAt),
        values,
        insight: deriveInsight(row.testName, row.critical, row.abnormal, values),
      });
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    logger.error('medical results GET failed', { err, hospitalId });
    return NextResponse.json(
      { error: 'Unable to load lab results for your hospital.' },
      { status: 500 },
    );
  }
}
