import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

type FacilityApplication = {
  id: string;
  facilityName: string;
  facilityType: string;
  county: string;
  facilityEmail: string;
  phone: string;
  physicalAddress: string | null;
  mflCode: string | null;
  insurances: string[];
  adminEmail: string;
  adminName: string;
  adminTitle: string | null;
  status: string;
};

type FacilityRegistrationDelegate = {
  findUnique: (args: unknown) => Promise<FacilityApplication | null>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaWithFacilityRegistration = {
  facilityRegistration: FacilityRegistrationDelegate;
};

// ─── POST /api/admin/facilities/[id]/approve ──────────────────────────────────
// Approves a pending facility application:
//   1. Creates the Supabase auth user for the facility admin
//   2. Sends a "set your password" invite email via Supabase
//   3. Updates the application record status to 'approved'
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:admin:facilities:approve',
      requireAuth: true,
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const { prisma } = await import('@/lib/database');
    const facilityPrisma = prisma as unknown as PrismaWithFacilityRegistration;
    const { id } = await context.params;

    // 1. Fetch the application
    const application = await facilityPrisma.facilityRegistration.findUnique({
      where: { id },
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

    const { session } = guard;

    // 2. Begin Transaction to create Hospital and Admin Profile
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Create the Hospital
        const hospital = await tx.hospital.create({
          data: {
            name:               application.facilityName,
            specialisation:     application.facilityType,
            location:           application.county,
            email:              application.facilityEmail,
            phoneNumber:        application.phone,
            address:            application.physicalAddress,
            licenseNumber:      application.mflCode,
            acceptedInsurances: application.insurances,
            isActive:           true,
          },
        });

        // Create the Admin Profile
        const profile = await tx.profile.create({
          data: {
            email:        application.adminEmail,
            fullName:     application.adminName,
            title:        application.adminTitle,
            role:         'admin',
            hospitalId:   hospital.id,
            status:       'active',
            approvedAt:   new Date(),
            approvedBy:   session?.id, // Superadmin ID
          },
        });

        // Update the application status
        await (tx as unknown as PrismaWithFacilityRegistration).facilityRegistration.update({
          where: { id },
          data: {
            status:      'approved',
            approvedAt:  new Date(),
            reviewedBy:  session?.email ?? session?.id ?? 'super_admin',
          },
        });

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            action:       'FACILITY_APPROVED',
            actorId:      session?.id,
            actorEmail:   session?.email,
            actorRole:    'super_admin',
            resourceType: 'Hospital',
            resourceId:   hospital.id,
            detail: {
              applicationId: id,
              facilityName:  application.facilityName,
              adminEmail:    application.adminEmail,
            },
            ipAddress:    req.headers.get('x-forwarded-for') || 'unknown',
          },
        });

        return { hospital, profile };
      });
    } catch (txError: unknown) {
      logger.error('[admin/facilities/approve] transaction failed', {
        error: txError instanceof Error ? txError.message : String(txError),
        applicationId: id,
      });
      return NextResponse.json({ error: 'Failed to create facility records.' }, { status: 500 });
    }

    // 3. Create the Supabase auth user and send invite email
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
        application.adminEmail,
        {
          data: {
            full_name:     application.adminName,
            role:          'admin',
            hospital_id:   result.hospital.id,
          },
        },
      );

      if (authError) {
        logger.warn('[admin/facilities/approve] invite failed but records created', {
          error: authError.message,
          adminEmail: application.adminEmail,
        });
      } else if (authData?.user) {
        // Link the auth user ID back to the registration for reference
        await facilityPrisma.facilityRegistration.update({
          where: { id },
          data: { adminUserId: authData.user.id },
        });
      }
    }

    logger.info('[admin/facilities/approve] facility approved successfully', {
      applicationId: id,
      hospitalId: result.hospital.id,
    });

    return NextResponse.json({ 
      success: true, 
      hospitalId: result.hospital.id,
      adminId: result.profile.id 
    });

  } catch (err) {
    logger.error('[admin/facilities/approve] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
