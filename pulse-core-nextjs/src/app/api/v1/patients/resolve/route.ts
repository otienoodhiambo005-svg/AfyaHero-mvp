/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody, validateOptionalString } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const RESOLVE_ROLES = ['reception', 'admin', 'medical', 'lab', 'pharmacy', 'super_admin'] as const;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CANDIDATES = 5;

type ResolvePatientBody = {
  name?: unknown;
  dob?: unknown;
  phone?: unknown;
  nationalId?: unknown;
};

type ResolveStatus = 'verified' | 'possible_match' | 'new_patient';

type ResolvedPatient = {
  id: string;
  name: string;
  dob: string;
  phone: string | null;
  nationalId: string | null;
};

type MatchCandidate = ResolvedPatient & {
  confidence: number;
};

type ResolveResponse = {
  status: ResolveStatus;
  confidence: number;
  duplicateRisk: boolean;
  primaryMatch?: MatchCandidate;
  candidates: MatchCandidate[];
};

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, '');
}

function toYmd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDobRange(dob: string): { gte: Date; lt: Date } {
  const start = new Date(`${dob}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function computeConfidence(
  patient: { name: string; dob: Date; phone: string | null; idNumber: string | null },
  input: { name?: string; dob?: string; phone?: string; nationalId?: string },
): number {
  let score = 0;

  if (input.name) {
    const patientName = patient.name.trim().toLowerCase();
    const queryName = input.name.trim().toLowerCase();

    if (patientName === queryName) score += 0.65;
    else if (patientName.startsWith(queryName) || queryName.startsWith(patientName)) score += 0.55;
    else if (patientName.includes(queryName) || queryName.includes(patientName)) score += 0.45;
    else score += 0.2;
  }

  if (input.dob) {
    if (toYmd(patient.dob) === input.dob) score += 0.2;
  }

  if (input.phone && patient.phone) {
    const left = normalizePhone(input.phone);
    const right = normalizePhone(patient.phone);
    if (left.length > 0 && right.length > 0) {
      if (left === right) score += 0.15;
      else if (right.endsWith(left) || left.endsWith(right)) score += 0.08;
    }
  }

  if (input.nationalId && patient.idNumber) {
    if (patient.idNumber.trim().toLowerCase() === input.nationalId.trim().toLowerCase()) score += 0.25;
  }

  return Math.min(0.99, Math.max(0, Number(score.toFixed(2))));
}

function toResolvedPatient(patient: {
  id: string;
  name: string;
  dob: Date;
  phone: string | null;
  idNumber: string | null;
}): ResolvedPatient {
  return {
    id: patient.id,
    name: patient.name,
    dob: toYmd(patient.dob),
    phone: patient.phone,
    nationalId: patient.idNumber,
  };
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:v1:patients:resolve',
    requireAuth: true,
    roles: [...RESOLVE_ROLES],
  });
  if (guard.response) return guard.response;

  const body = await readJsonBody<ResolvePatientBody>(req);
  if (body instanceof NextResponse) return body;

  const name = validateOptionalString(body.name, 'name', { max: 120 });
  if (name instanceof NextResponse) return name;
  const dob = validateOptionalString(body.dob, 'dob', { max: 10 });
  if (dob instanceof NextResponse) return dob;
  const phone = validateOptionalString(body.phone, 'phone', { max: 30 });
  if (phone instanceof NextResponse) return phone;
  const nationalId = validateOptionalString(body.nationalId, 'nationalId', { max: 40 });
  if (nationalId instanceof NextResponse) return nationalId;

  if (dob && !DOB_REGEX.test(dob)) {
    return NextResponse.json({ error: 'dob must be in YYYY-MM-DD format.' }, { status: 400 });
  }

  if (!name && !dob && !phone && !nationalId) {
    return NextResponse.json(
      { error: 'At least one of name, dob, phone, or nationalId must be provided.' },
      { status: 400 },
    );
  }

  const session = guard.session;

  try {
    if (nationalId) {
      const verified = await prisma.patient.findFirst({
        where: {
          idNumber: nationalId,
          ...(session?.hospitalId ? { hospitalId: session.hospitalId } : {}),
        },
        select: {
          id: true,
          name: true,
          dob: true,
          phone: true,
          idNumber: true,
        },
      });

      if (verified) {
        const primaryMatch: MatchCandidate = {
          ...toResolvedPatient(verified),
          confidence: 1,
        };
        const response: ResolveResponse = {
          status: 'verified',
          confidence: 1,
          duplicateRisk: false,
          primaryMatch,
          candidates: [primaryMatch],
        };
        return NextResponse.json(response);
      }
    }

    if (!name) {
      const response: ResolveResponse = {
        status: 'new_patient',
        confidence: 0,
        duplicateRisk: false,
        candidates: [],
      };
      return NextResponse.json(response);
    }

    const fuzzyWhere: {
      name: { contains: string; mode: 'insensitive' };
      hospitalId?: string;
      dob?: { gte: Date; lt: Date };
      phone?: { contains: string };
    } = {
      name: { contains: name, mode: 'insensitive' },
      ...(session?.hospitalId ? { hospitalId: session.hospitalId } : {}),
    };

    if (dob) {
      fuzzyWhere.dob = parseDobRange(dob);
    }

    if (phone) {
      fuzzyWhere.phone = { contains: phone };
    }

    const rows = await prisma.patient.findMany({
      where: fuzzyWhere,
      select: {
        id: true,
        name: true,
        dob: true,
        phone: true,
        idNumber: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CANDIDATES,
    });

    const candidates = rows
      .map((row): MatchCandidate => ({
        ...toResolvedPatient(row),
        confidence: computeConfidence(row, { name, dob, phone, nationalId }),
      }))
      .sort((a, b) => b.confidence - a.confidence);

    if (candidates.length === 0) {
      const response: ResolveResponse = {
        status: 'new_patient',
        confidence: 0,
        duplicateRisk: false,
        candidates: [],
      };
      return NextResponse.json(response);
    }

    const primaryMatch = candidates[0];
    const closeMatches = candidates.filter((candidate) => candidate.confidence >= 0.75).length;
    const duplicateRisk = closeMatches > 1;

    const response: ResolveResponse = {
      status: 'possible_match',
      confidence: primaryMatch.confidence,
      duplicateRisk,
      primaryMatch,
      candidates,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('patient identity resolve failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId: session?.hospitalId,
      role: session?.role,
      hasName: Boolean(name),
      hasDob: Boolean(dob),
      hasPhone: Boolean(phone),
      hasNationalId: Boolean(nationalId),
    });

    return NextResponse.json(
      { error: 'Unable to resolve patient identity at this time.' },
      { status: 500 },
    );
  }
}
