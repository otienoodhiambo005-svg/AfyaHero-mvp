import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';
import { prisma } from '@/lib/database';
import { createClient } from '@supabase/supabase-js';

// ─── POST /api/admin/facilities/internal-register ─────────────────────────────
// Directly registers a facility by a superadmin. 
// Bypasses the application queue logic but reuses the creation patterns.
export async function POST(req: NextRequest) {
  try {
    const submissionSource = 'internal_register';
    const guard = await enforceApiGuard(req, {
      scope: 'api:admin:facilities:internal-register',
      requireAuth: true,
      roles: ['super_admin'],
    });
    if (guard.response) return guard.response;

    const body = await req.json();
    const { 
      facilityName, facilityType, county, facilityEmail, phone, 
      mflCode, shifAccepted, physicalAddress, services, insurances,
      adminName, adminEmail, adminTitle, bedCount, operatingHours
    } = body;

    // 1. Basic Validation
    if (!facilityName || !facilityEmail || !adminEmail || !adminName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 2. Begin Transaction
    const { session } = guard;
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Create the Hospital
        const hospital = await tx.hospital.create({
          data: {
            name:               facilityName,
            specialisation:     facilityType,
            location:           county,
            email:              facilityEmail,
            phoneNumber:        phone,
            address:            physicalAddress,
            licenseNumber:      mflCode,
            acceptedInsurances: insurances || [],
            isActive:           true,
          },
        });

        // Create the Admin Profile
        const profile = await tx.profile.create({
          data: {
            email:        adminEmail,
            fullName:     adminName,
            title:        adminTitle,
            role:         'admin',
            hospitalId:   hospital.id,
            status:       'active',
            approvedAt:   new Date(),
            approvedBy:   session?.id,
          },
        });

        // Log the internal registration
        await tx.auditLog.create({
          data: {
            action:       'INTERNAL_FACILITY_REGISTRATION',
            actorId:      session?.id,
            actorEmail:   session?.email,
            actorRole:    'super_admin',
            resourceType: 'Hospital',
            resourceId:   hospital.id,
            detail: {
              facilityName,
              adminEmail,
              registeredBy: session?.email,
              submissionSource,
            },
            ipAddress:    req.headers.get('x-forwarded-for') || 'unknown',
          },
        });

        return { hospital, profile };
      });
    } catch (txError: unknown) {
      logger.error('[admin/facilities/internal-register] transaction failed', {
        error: txError instanceof Error ? txError.message : String(txError),
      });
      return NextResponse.json({ error: 'Failed to create facility records.' }, { status: 500 });
    }

    // 3. Supabase Auth Invitation
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error: authError } = await supabase.auth.admin.inviteUserByEmail(
        adminEmail,
        {
          data: {
            full_name:     adminName,
            role:          'admin',
            hospital_id:   result.hospital.id,
          },
        },
      );

      if (authError) {
        logger.warn('[admin/facilities/internal-register] invite failed', {
          error: authError.message,
          adminEmail,
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      hospitalId: result.hospital.id,
      adminId: result.profile.id,
      submissionSource,
    });

  } catch (err) {
    logger.error('[admin/facilities/internal-register] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
