import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { enforceApiGuard } from '@/lib/api-security';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Publicly accessible, but rate-limited
  const guard = await enforceApiGuard(request, {
    scope: 'api:staff:verify-invite',
    requireAuth: false,
  });
  
  if (guard.response) return guard.response;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
    const invitation = await prisma.staffInvitation.findUnique({
      where: { token },
      include: {
        hospital: {
          select: { name: true, location: true }
        }
      }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    if (invitation.usedAt) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 });
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      hospitalName: invitation.hospital.name,
      location: invitation.hospital.location,
      role: invitation.role,
      department: invitation.department,
    });
  } catch (err) {
    logger.error('Failed to verify staff invitation', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to verify invitation' }, { status: 500 });
  }
}
