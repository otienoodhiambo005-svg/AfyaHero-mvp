import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

type FacilityApplication = {
  status: string;
  reviewedBy: string | null;
};

type FacilityRegistrationDelegate = {
  findMany: (args: unknown) => Promise<FacilityApplication[]>;
};

type PrismaWithFacilityRegistration = {
  facilityRegistration: FacilityRegistrationDelegate;
};

// ─── GET /api/admin/facilities ────────────────────────────────────────────────
// Lists facility registration applications, optionally filtered by status.
// Requires superadmin session.
export async function GET(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:admin:facilities',
      requireAuth: true,
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { prisma } = await import('@/lib/database');
    const facilityPrisma = prisma as unknown as PrismaWithFacilityRegistration;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // pending_approval | approved | rejected | all

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      if (status === 'pending_approval') {
        where.status = { in: ['pending_approval', 'pending'] };
      } else {
        where.status = status;
      }
    }

    const applications = await facilityPrisma.facilityRegistration.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });

    const normalizedApplications = applications.map(application => {
      const normalizedStatus =
        application.status === 'pending' ? 'pending_approval' : application.status;
      const submissionSource =
        application.reviewedBy && application.status !== 'approved' && application.status !== 'rejected'
          ? application.reviewedBy
          : 'public_application';

      return {
        ...application,
        status: normalizedStatus,
        submissionSource,
      };
    });

    return NextResponse.json({ applications: normalizedApplications });

  } catch (err) {
    logger.error('[admin/facilities] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

