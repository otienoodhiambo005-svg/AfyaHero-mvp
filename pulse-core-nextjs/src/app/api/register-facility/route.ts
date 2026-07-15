import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { z } from 'zod';
import logger from '@/lib/logger';

type FacilityRegistrationDelegate = {
  create: (args: unknown) => Promise<{ id: string }>;
};

type PrismaWithFacilityRegistration = {
  facilityRegistration: FacilityRegistrationDelegate;
};

// ─── Validation schema ────────────────────────────────────────────────────────
const FacilityRegistrationSchema = z.object({
  // Step 1 — Facility Info
  facilityName:    z.string().min(2).max(200),
  facilityType:    z.string().min(1),
  ownership:       z.string().min(1),
  county:          z.string().min(1),
  subCounty:       z.string().optional(),
  physicalAddress: z.string().optional(),
  phone:           z.string().min(7).max(20),
  facilityEmail:   z.string().email(),
  mflCode:         z.string().optional(),
  SHIFContracted:  z.boolean(),
  // Step 2 — Admin Account
  adminName:    z.string().min(2).max(120),
  adminTitle:   z.string().optional(),
  adminEmail:   z.string().email(),
  adminPhone:   z.string().optional(),
  adminPassword: z.string().min(8).max(128),
  adminConfirmPassword: z.string(),
  // Step 3 — Services
  services:   z.array(z.string()).min(1),
  insurances: z.array(z.string()).optional(),
  bedCount:   z.string().optional(),
  operatingHours: z.string().optional(),
}).refine((d) => d.adminPassword === d.adminConfirmPassword, {
  message: 'Passwords do not match',
  path: ['adminConfirmPassword'],
});

// ─── POST /api/register-facility ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:register-facility',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    // Validate
    const parsed = FacilityRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid registration data.', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const session = guard.session;
    const submissionSource =
      session?.role === 'admin'
        ? 'hospital_admin_portal'
        : session?.role === 'super_admin'
          ? 'super_admin_portal'
          : 'public_application';
    const responseStatus = 'pending_approval';
    const persistedStatus = 'pending';

    // Preferred path: persist with Prisma so superadmin review endpoints read the same source.
    try {
      const { prisma } = await import('@/lib/database');
      const facilityPrisma = prisma as unknown as PrismaWithFacilityRegistration;
      const created = await facilityPrisma.facilityRegistration.create({
        data: {
          facilityName: data.facilityName,
          facilityType: data.facilityType,
          ownership: data.ownership,
          county: data.county,
          subCounty: data.subCounty ?? null,
          physicalAddress: data.physicalAddress ?? null,
          phone: data.phone,
          facilityEmail: data.facilityEmail,
          mflCode: data.mflCode ?? null,
          shifAccepted: data.SHIFContracted,
          adminName: data.adminName,
          adminTitle: data.adminTitle ?? null,
          adminEmail: data.adminEmail,
          adminPhone: data.adminPhone ?? null,
          services: data.services,
          insurances: data.insurances ?? [],
          bedCount: data.bedCount ? parseInt(data.bedCount, 10) : null,
          operatingHours: data.operatingHours ?? null,
          status: persistedStatus,
          submittedAt: new Date(),
          reviewedBy: submissionSource,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'FACILITY_REGISTRATION_SUBMITTED',
          actorId: session?.id,
          actorEmail: session?.email ?? data.adminEmail,
          actorRole: session?.role ?? 'guest',
          hospitalId: session?.hospitalId ?? null,
          resourceType: 'FacilityRegistration',
          resourceId: created.id,
          detail: {
            submissionSource,
            facilityName: data.facilityName,
            adminEmail: data.adminEmail,
            status: responseStatus,
          },
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });

      return NextResponse.json(
        {
          success: true,
          queued: true,
          status: responseStatus,
          submissionSource,
          applicationId: created.id,
        },
        { status: 201 },
      );
    } catch (prismaErr) {
      logger.warn('[register-facility] prisma persist failed, trying supabase fallback', {
        error: prismaErr instanceof Error ? prismaErr.message : String(prismaErr),
      });
    }

    // Public flow: queue application only.
    // Account provisioning is handled by privileged internal superadmin flow:
    // POST /api/admin/facilities/internal-register
    const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Queue facility application for superadmin review.
      const { error: facilityError } = await supabase.from('facility_registrations').insert({
        facility_name:   data.facilityName,
        facility_type:   data.facilityType,
        ownership:       data.ownership,
        county:          data.county,
        sub_county:      data.subCounty ?? null,
        physical_address: data.physicalAddress ?? null,
        phone:           data.phone,
        facility_email:  data.facilityEmail,
        mfl_code:        data.mflCode ?? null,
        SHIF_contracted: data.SHIFContracted,
        admin_name:      data.adminName,
        admin_title:     data.adminTitle ?? null,
        admin_email:     data.adminEmail,
        admin_phone:     data.adminPhone ?? null,
        services:        data.services,
        insurances:      data.insurances ?? [],
        bed_count:       data.bedCount ? parseInt(data.bedCount, 10) : null,
        operating_hours: data.operatingHours ?? null,
        status:          persistedStatus,
        submitted_at:    new Date().toISOString(),
        reviewed_by:     submissionSource,
      });

      if (facilityError) {
        // Make queue persistence failure explicit for reliability.
        logger.error('[register-facility] facility insert error', {
          error: facilityError.message,
          facilityName: data.facilityName,
          adminEmail: data.adminEmail,
          submissionSource,
        });
        return NextResponse.json(
          { error: 'Failed to submit facility application. Please try again.' },
          { status: 500 },
        );
      }
    }
    // In demo mode (no Supabase), allow UI flow testing end-to-end.

    return NextResponse.json(
      { success: true, queued: true, status: responseStatus, submissionSource },
      { status: 201 },
    );

  } catch (err) {
    logger.error('[register-facility] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

