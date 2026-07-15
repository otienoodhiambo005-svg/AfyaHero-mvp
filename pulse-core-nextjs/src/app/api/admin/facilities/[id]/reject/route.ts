import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { z } from 'zod';
import logger from '@/lib/logger';

type FacilityApplicationSummary = {
  id: string;
  status: string;
  facilityName: string;
  adminEmail: string;
};

type FacilityRegistrationDelegate = {
  findUnique: (args: unknown) => Promise<FacilityApplicationSummary | null>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaWithFacilityRegistration = {
  facilityRegistration: FacilityRegistrationDelegate;
};

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── POST /api/admin/facilities/[id]/reject ───────────────────────────────────
// Rejects a pending facility application and marks its status as 'rejected'.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:admin:facilities:reject',
      requireAuth: true,
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { prisma } = await import('@/lib/database');
    const facilityPrisma = prisma as unknown as PrismaWithFacilityRegistration;
    const { id } = await context.params;

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;
    const parsed = RejectSchema.safeParse(body ?? {});
    const reason = parsed.success ? (parsed.data.reason ?? null) : null;

    const { session } = guard;

    // 1. Fetch the application first to validate it exists and is pending
    const application = await facilityPrisma.facilityRegistration.findUnique({
      where: { id },
      select: { id: true, status: true, facilityName: true, adminEmail: true },
    });

    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    const isPending = application.status === 'pending_approval' || application.status === 'pending';
    if (!isPending) {
      return NextResponse.json(
        { error: `Application is already ${application.status}.` },
        { status: 409 },
      );
    }

    // 2. Mark as rejected and log audit activity
    await prisma.$transaction(async (tx) => {
      await (tx as unknown as PrismaWithFacilityRegistration).facilityRegistration.update({
        where: { id },
        data: {
          status:     'rejected',
          rejectedAt: new Date(),
          rejectReason: reason,
          reviewedBy: session?.email ?? session?.id ?? 'super_admin',
        },
      });

      await tx.auditLog.create({
        data: {
          action:       'FACILITY_REJECTED',
          actorId:      session?.id,
          actorEmail:   session?.email,
          actorRole:    'super_admin',
          resourceType: 'FacilityRegistration',
          resourceId:   id,
          detail: {
            facilityName: application.facilityName,
            adminEmail:   application.adminEmail,
            reason:       reason,
          },
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    });

    logger.info('[admin/facilities/reject] facility application rejected', {
      applicationId: id,
      facilityName: application.facilityName,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    logger.error('[admin/facilities/reject] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
