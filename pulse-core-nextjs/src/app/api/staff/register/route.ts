import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { StaffRegistrationSchema } from '@/lib/schemas';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:staff:register',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsed = StaffRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid staff registration payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const { prisma } = await import('@/lib/database');
    let hospitalId: string;
    let hospitalName: string;
    let role = data.role;
    let isAutoApproved = false;

    // Handle Invitation Token logic
    if (data.invitationToken) {
      const invitation = await prisma.staffInvitation.findUnique({
        where: { token: data.invitationToken },
        include: { hospital: { select: { id: true, name: true } } }
      });

      if (!invitation || invitation.usedAt || new Date() > invitation.expiresAt) {
        return NextResponse.json({ error: 'Invalid, expired, or already used invitation token.' }, { status: 400 });
      }

      hospitalId = invitation.hospitalId;
      hospitalName = invitation.hospital.name;
      role = invitation.role as any;
      isAutoApproved = true;
    } else {
      // Fallback to legacy Hospital Code logic
      if (!data.hospitalCode || !role) {
        return NextResponse.json({ error: 'Hospital code and role are required for manual registration.' }, { status: 400 });
      }

      const hospital = await prisma.hospital.findFirst({
        where: {
          OR: [{ id: data.hospitalCode }, { licenseNumber: data.hospitalCode }],
        },
        select: { id: true, name: true },
      });

      if (!hospital) {
        return NextResponse.json({ error: 'Hospital not found. Please confirm your hospital code.' }, { status: 404 });
      }

      hospitalId = hospital.id;
      hospitalName = hospital.name;
    }

    const existingProfile = await prisma.profile.findFirst({
      where: {
        OR: [{ email: data.email }, { staffId: data.staffId }],
      },
      select: { email: true, staffId: true, status: true },
    });
    if (existingProfile) {
      const field = existingProfile.email === data.email ? 'email' : 'Staff ID';
      return NextResponse.json(
        { error: `A staff profile already exists with this ${field}. status: "${existingProfile.status}".` },
        { status: 409 },
      );
    }

    let authUserId: string | null = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const authResult = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          role: data.role,
          full_name: data.fullName,
          title: data.title ?? '',
          hospitalId: hospitalId,
          hospitalName: hospitalName,
          approval_status: isAutoApproved ? 'active' : 'pending',
          approved: isAutoApproved,
        },
      });

      if (authResult.error || !authResult.data.user) {
        logger.error('[staff/register] failed creating auth user', {
          error: authResult.error?.message,
          email: data.email,
        });
        return NextResponse.json(
          { error: 'Failed to create authentication account. Please try again.' },
          { status: 500 },
        );
      }
      authUserId = authResult.data.user.id;
    }

    const profile = await prisma.profile.create({
      data: {
        id: authUserId ?? undefined,
        email: data.email,
        fullName: data.fullName,
        title: data.title ?? null,
        role: role!,
        department: data.department ?? null,
        staffId: data.staffId,
        hospitalCode: data.hospitalCode ?? 'INVITED',
        hospitalId: hospitalId,
        status: isAutoApproved ? 'active' : 'pending',
        approvedAt: isAutoApproved ? new Date() : null,
      },
      select: { id: true },
    });

    // Mark invitation as used
    if (data.invitationToken) {
      await prisma.staffInvitation.update({
        where: { token: data.invitationToken },
        data: { usedAt: new Date() }
      });
    }

    await prisma.auditLog.create({
      data: {
        action: isAutoApproved ? 'STAFF_INVITATION_REDEEMED' : 'STAFF_REGISTRATION_SUBMITTED',
        actorId: profile.id,
        actorEmail: data.email,
        actorRole: role,
        hospitalId: hospitalId,
        resourceType: 'Profile',
        resourceId: profile.id,
        detail: {
          submissionSource: data.invitationToken ? 'staff_invitation' : 'staff_self_registration',
          approvalStatus: isAutoApproved ? 'active' : 'pending',
          hospitalCode: data.hospitalCode,
          invitationToken: data.invitationToken ? '***' : undefined,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    return NextResponse.json(
      {
        success: true,
        queued: !isAutoApproved,
        status: isAutoApproved ? 'active' : 'pending',
        submissionSource: data.invitationToken ? 'staff_invitation' : 'staff_self_registration',
        hospitalId: hospitalId,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[staff/register] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
