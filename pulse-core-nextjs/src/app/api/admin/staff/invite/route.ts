import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import { randomBytes } from 'crypto';
import logger from '@/lib/logger';

const InviteSchema = z.object({
  role: z.enum(['admin', 'medical', 'reception', 'lab', 'pharmacy']),
  department: z.string().max(128).optional(),
  expiryHours: z.number().min(1).max(720).default(48), // Default 2 days, max 30 days
});

export async function POST(request: NextRequest) {
  // 1. Guard for Admin roles only
  const guard = await enforceApiGuard(request, {
    scope: 'admin:staff:invite',
    roles: ['admin', 'super_admin'],
  });
  
  if (guard.response) return guard.response;
  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Hospital context required' }, { status: 400 });
  }

  // 2. Parse request body
  const body = await readJsonBody(request);
  if (body instanceof NextResponse) return body;

  const validation = InviteSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.issues.map(i => i.message) },
      { status: 400 }
    );
  }

  const { role, department, expiryHours } = validation.data;
  const hospitalId = guard.session.hospitalId;

  // 3. Generate secure token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  try {
    // 4. Create invitation in DB
    const invitation = await prisma.staffInvitation.create({
      data: {
        token,
        hospitalId,
        role,
        department,
        expiresAt,
      },
      include: {
        hospital: {
          select: { name: true }
        }
      }
    });

    // 5. Build onboarding URL
    // Use NEXT_PUBLIC_APP_URL or fallback to origin
    const origin = request.nextUrl.origin;
    const inviteUrl = `${origin}/onboard/${token}`;

    return NextResponse.json({
      success: true,
      token,
      inviteUrl,
      role,
      hospitalName: invitation.hospital.name,
      expiresAt: invitation.expiresAt,
    });
  } catch (err) {
    logger.error('Failed to generate staff invitation', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to generate invitation' }, { status: 500 });
  }
}
