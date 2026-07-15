/**
 * Lab quality incidents — list (with per-hospital seed) and status updates.
 * Prisma is lazy-loaded via `@/lib/database`.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

const LAB_ROLES = ['lab', 'admin', 'super_admin'] as const;

const SEVERITIES = ['High', 'Medium', 'Low'] as const;
const STATUSES = ['Open', 'Investigating', 'Resolved'] as const;

export type ApiLabQualityIncident = {
  id: string;
  displayId: string;
  issue: string;
  severity: (typeof SEVERITIES)[number];
  status: (typeof STATUSES)[number];
  openedAt: string;
};

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

function seedRows(hospitalId: string) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return [
    {
      hospitalId,
      displayId: 'INC-341',
      issue: 'Troponin control outside acceptable range',
      severity: 'High',
      status: 'Investigating',
      openedAt: new Date(now - 45 * 60 * 1000),
    },
    {
      hospitalId,
      displayId: 'INC-339',
      issue: 'Delayed courier pickup for sputum samples',
      severity: 'Medium',
      status: 'Open',
      openedAt: new Date(now - 90 * 60 * 1000),
    },
    {
      hospitalId,
      displayId: 'INC-336',
      issue: 'Mislabeled urine sample recollected',
      severity: 'Low',
      status: 'Resolved',
      openedAt: new Date(now - 3 * hour),
    },
  ];
}

async function ensureSeedIncidents(hospitalId: string): Promise<void> {
  const count = await prisma.labQualityIncident.count({ where: { hospitalId } });
  if (count > 0) return;
  await prisma.labQualityIncident.createMany({
    data: seedRows(hospitalId),
    skipDuplicates: true,
  });
}

function mapRow(row: {
  id: string;
  displayId: string;
  issue: string;
  severity: string;
  status: string;
  openedAt: Date;
}): ApiLabQualityIncident {
  return {
    id: row.id,
    displayId: row.displayId,
    issue: row.issue,
    severity: row.severity as ApiLabQualityIncident['severity'],
    status: row.status as ApiLabQualityIncident['status'],
    openedAt: row.openedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-quality-incidents-read',
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
      { error: 'Hospital context is required for lab quality incidents.', incidents: [] as ApiLabQualityIncident[] },
      { status: 403 },
    );
  }

  try {
    await ensureSeedIncidents(hospitalId);

    const rows = await prisma.labQualityIncident.findMany({
      where: { hospitalId },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    const incidents: ApiLabQualityIncident[] = rows.map(mapRow);

    return NextResponse.json({ incidents });
  } catch (error) {
    logger.error('lab quality incidents GET failed', {
      hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'Unable to load quality incidents.',
        incidents: [] as ApiLabQualityIncident[],
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'lab-quality-incidents-write',
    roles: [...LAB_ROLES],
  });
  if (guard.response) return guard.response;
  const session = guard.session;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hospitalId = session.hospitalId;
  if (!hospitalId) {
    return NextResponse.json({ error: 'Hospital context is required for lab quality incidents.' }, { status: 403 });
  }

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, status } = parsed.data;

  try {
    const existing = await prisma.labQualityIncident.findFirst({
      where: { id, hospitalId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incident not found for this hospital.' }, { status: 404 });
    }

    const updated = await prisma.labQualityIncident.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({
      ok: true,
      incident: mapRow(updated),
    });
  } catch (error) {
    logger.error('lab quality incidents PATCH failed', {
      hospitalId,
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Unable to update incident status.' }, { status: 500 });
  }
}
