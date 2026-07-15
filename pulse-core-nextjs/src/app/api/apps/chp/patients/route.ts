/**
 * Prisma is lazy-loaded via `@/lib/database` with `any` typing when the client
 * is not generated; keep unsafe-call rules scoped to this route only.
 */
 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { auditChpAction, chpError, requireChpPrincipal } from '@/lib/apps/chp/guard';

const QuerySchema = z.object({
  region: z.string().trim().min(2).max(80).optional(),
});

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guard = await requireChpPrincipal(req, 'fhir:read');
  if (guard.response) return guard.response;
  const principal = guard.principal;
  if (!principal) return chpError(401, 'UNAUTHORIZED', 'Missing CHP principal.');

  const query = QuerySchema.safeParse({
    region: req.nextUrl.searchParams.get('region') ?? undefined,
  });
  if (!query.success) {
    return chpError(400, 'BAD_REQUEST', 'Invalid region filter.');
  }

  try {
    const { prisma } = await import('@/lib/database');
    const patients = await prisma.patient.findMany({
      where: { hospitalId: principal.hospitalId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        gender: true,
        dob: true,
        phone: true,
        status: true,
      },
    });

    let filtered = patients;
    if (query.data.region) {
      const hospital = await prisma.hospital.findUnique({
        where: { id: principal.hospitalId },
        select: { location: true },
      });
      const matchesRegion = (hospital?.location ?? '').toLowerCase().includes(query.data.region.toLowerCase());
      filtered = matchesRegion ? patients : [];
    }

    await auditChpAction(req, principal, 'chp_app.patients.list', 'Patient', {
      region: query.data.region ?? null,
      resultCount: filtered.length,
    });

    return NextResponse.json(
      {
        ok: true,
        hospitalId: principal.hospitalId,
        filters: { region: query.data.region ?? null },
        patients: filtered,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('chp patients GET failed', {
      appId: principal.appId,
      hospitalId: principal.hospitalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to load patients.' } }, { status: 500 });
  }
}
