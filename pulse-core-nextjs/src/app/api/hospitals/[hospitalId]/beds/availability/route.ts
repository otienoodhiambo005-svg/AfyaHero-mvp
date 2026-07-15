import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

interface BedAvailabilityRow {
  status: string | null;
  wardName: string | null;
}

// ─── GET /api/hospitals/[hospitalId]/beds/availability ───────────────────────
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ hospitalId: string }> }
) {
  try {
    const { hospitalId } = await context.params;

    // Public endpoint, but rate limited. No PII returned here.
    const guard = await enforceApiGuard(req, {
      scope: 'api:public-hospital-data',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const { prisma } = await import('@/lib/database');

    // Aggregate bed counts by status and wardName
    // We only care about availability for patients
    const bedsRaw = await prisma.hospitalBed.findMany({
      where: { hospitalId },
      select: {
        status: true,
        wardName: true,
      },
    });
    const beds = (bedsRaw ?? []) as BedAvailabilityRow[];

    if (beds.length === 0) {
      return NextResponse.json({ error: 'Hospital not found or has no bed capacity.' }, { status: 404 });
    }

    // Calculate aggregates
    const total = beds.length;
    const available = beds.filter(b => b.status === 'available').length;
    
    // Group by ward category
    const wardBreakdown = beds.reduce((acc, bed) => {
      const wardKey = bed.wardName ?? 'Unspecified';
      if (!acc[wardKey]) {
        acc[wardKey] = { total: 0, available: 0 };
      }
      acc[wardKey].total++;
      if (bed.status === 'available') {
        acc[wardKey].available++;
      }
      return acc;
    }, {} as Record<string, { total: number; available: number }>);

    return NextResponse.json({
      hospitalId,
      summary: {
        total,
        available,
        occupancyRate: Math.round(((total - available) / total) * 100),
      },
      wards: wardBreakdown,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    logger.error('[beds-availability] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
