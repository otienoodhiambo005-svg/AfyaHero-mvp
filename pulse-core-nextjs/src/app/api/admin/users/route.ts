import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

type MutableAction =
  | 'approve_staff'
  | 'reject_staff'
  | 'update_role'
  | 'suspend_user'
  | 'activate_user';

interface ActionPayload {
  action?: MutableAction;
  userId?: string;
  role?: string;
  reason?: string;
}

const MANAGEABLE_ROLES = ['super_admin', 'admin'] as const;
const PROFILE_ROLES = ['super_admin', 'admin', 'medical', 'reception', 'lab', 'pharmacy'] as const;

function requiresHospitalIsolation(role: string) {
  return role === 'admin';
}

function parseRoleFilter(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return PROFILE_ROLES.includes(raw as (typeof PROFILE_ROLES)[number]) ? raw : undefined;
}

async function enforceAdminContext(request: NextRequest) {
  const guard = await enforceApiGuard(request, {
    scope: 'api:admin:users',
    requireAuth: true,
    roles: [...MANAGEABLE_ROLES],
  });
  if (guard.response) {
    return { response: guard.response, session: null };
  }
  if (!guard.session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  }
  return { response: null, session: guard.session };
}

function scopedWhere(
  base: Prisma.ProfileWhereInput,
  session: { role: string; hospitalId?: string },
): Prisma.ProfileWhereInput {
  if (requiresHospitalIsolation(session.role)) {
    return {
      ...base,
      hospitalId: session.hospitalId,
      role: { not: 'super_admin' },
    };
  }
  return base;
}

function isSameHospitalOrSuperAdmin(
  session: { role: string; hospitalId?: string },
  targetHospitalId: string | null,
) {
  if (session.role === 'super_admin') return true;
  return Boolean(session.hospitalId && targetHospitalId && session.hospitalId === targetHospitalId);
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await enforceAdminContext(request);
    if (ctx.response) return ctx.response;
    const session = ctx.session!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const search = searchParams.get('search')?.trim();
    const role = parseRoleFilter(searchParams.get('role'));
    const status = searchParams.get('status')?.trim();

    const where: Prisma.ProfileWhereInput = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { staffId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const finalWhere = scopedWhere(where, session);
    const pendingWhere = scopedWhere({ status: 'pending' }, session);

    const [profiles, total, pendingApprovals] = await Promise.all([
      prisma.profile.findMany({
        where: finalWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.profile.count({ where: finalWhere }),
      prisma.profile.findMany({
        where: pendingWhere,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          department: true,
          staffId: true,
          hospitalId: true,
          createdAt: true,
          status: true,
        },
      }),
    ]);

    return NextResponse.json({
      users: profiles,
      pendingApprovals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[admin/users] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await enforceAdminContext(request);
    if (ctx.response) return ctx.response;
    const session = ctx.session!;

    const body = await readJsonBody<ActionPayload>(request);
    if (body instanceof NextResponse) return body;
    const { action, userId, role, reason } = body;

    if (!action || !userId) {
      return NextResponse.json({ error: 'Missing required fields: action, userId' }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, hospitalId: true, status: true, email: true, role: true, fullName: true },
    });

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!isSameHospitalOrSuperAdmin(session, profile.hospitalId)) {
      return NextResponse.json({ error: 'Forbidden for this hospital' }, { status: 403 });
    }

    switch (action) {
      case 'approve_staff': {
        if (profile.status !== 'pending') {
          return NextResponse.json({ error: `User is already ${profile.status}` }, { status: 409 });
        }
        await prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: userId },
            data: {
              status: 'active',
              approvedAt: new Date(),
              approvedBy: session.id,
            },
          });
          await tx.auditLog.create({
            data: {
              action: 'STAFF_APPROVED',
              actorId: session.id,
              actorEmail: session.email,
              actorRole: session.role,
              hospitalId: profile.hospitalId,
              resourceType: 'Profile',
              resourceId: userId,
              detail: { previousStatus: profile.status, newStatus: 'active' },
              ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            },
          });
        });
        return NextResponse.json({ success: true, message: 'Staff approved', status: 'active' });
      }

      case 'reject_staff': {
        if (profile.status !== 'pending') {
          return NextResponse.json({ error: `User is already ${profile.status}` }, { status: 409 });
        }
        await prisma.$transaction(async (tx) => {
          await tx.profile.update({
            where: { id: userId },
            data: { status: 'rejected' },
          });
          await tx.auditLog.create({
            data: {
              action: 'STAFF_REJECTED',
              actorId: session.id,
              actorEmail: session.email,
              actorRole: session.role,
              hospitalId: profile.hospitalId,
              resourceType: 'Profile',
              resourceId: userId,
              detail: { reason: reason ?? null, previousStatus: profile.status, newStatus: 'rejected' },
              ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            },
          });
        });
        return NextResponse.json({ success: true, message: 'Staff rejected', status: 'rejected' });
      }

      case 'update_role': {
        if (!role || !PROFILE_ROLES.includes(role as (typeof PROFILE_ROLES)[number])) {
          return NextResponse.json({ error: `Invalid role. Allowed: ${PROFILE_ROLES.join(', ')}` }, { status: 400 });
        }
        // Only platform superadmins may assign or modify the super_admin role.
        // Hospital admins cannot promote staff to super_admin, and cannot
        // modify an existing super_admin's role.
        if (session.role !== 'super_admin') {
          if (role === 'super_admin' || profile.role === 'super_admin') {
            return NextResponse.json(
              { error: 'Only platform superadmins may modify the super_admin role.' },
              { status: 403 },
            );
          }
        }
        await prisma.profile.update({ where: { id: userId }, data: { role } });
        return NextResponse.json({ success: true, message: `User role updated to ${role}` });
      }

      case 'suspend_user': {
        await prisma.profile.update({ where: { id: userId }, data: { status: 'suspended' } });
        return NextResponse.json({ success: true, message: 'User suspended successfully' });
      }

      case 'activate_user': {
        await prisma.profile.update({ where: { id: userId }, data: { status: 'active' } });
        return NextResponse.json({ success: true, message: 'User activated successfully' });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Supported: approve_staff, reject_staff, update_role, suspend_user, activate_user' },
          { status: 400 },
        );
    }
  } catch (error) {
    logger.error('[admin/users] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to process user action' }, { status: 500 });
  }
}
