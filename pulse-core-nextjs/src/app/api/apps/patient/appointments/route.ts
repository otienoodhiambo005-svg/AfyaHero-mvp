 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePatientAppPrincipal } from '@/lib/apps/patient/auth';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(req: NextRequest) {
  const auth = await requirePatientAppPrincipal(req, {
    scope: 'api:apps:patient:appointments',
    requiredScope: 'fhir:read',
  });
  if (auth.response) return auth.response;

  const parsedQuery = querySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 });
  }

  const { prisma } = await import('@/lib/database');
  const rows = await prisma.appointment.findMany({
    where: {
      hospitalId: auth.principal.hospitalId,
      patientId: auth.principal.patientId,
    },
    orderBy: [{ scheduledAt: 'desc' }, { appointmentDate: 'desc' }],
    take: parsedQuery.data.limit,
    select: {
      id: true,
      status: true,
      type: true,
      scheduledAt: true,
      appointmentDate: true,
    },
  });

  return NextResponse.json(
    {
      patientId: auth.principal.patientId,
      hospitalId: auth.principal.hospitalId,
      appointments: rows.map((row: any) => ({
        id: row.id,
        status: row.status,
        type: row.type,
        scheduledAt: row.scheduledAt?.toISOString() ?? row.appointmentDate?.toISOString() ?? null,
      })),
    },
    { status: 200 },
  );
}
