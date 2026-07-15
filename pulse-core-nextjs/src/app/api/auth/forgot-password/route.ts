import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, enforceRequestFirewall, enforceTrustedOrigin, readJsonBody } from '@/lib/api-security';
import { requestPasswordReset } from '@/lib/supabase-auth';
import { auditAuthEvent } from '@/lib/audit-logging';
import logger from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(req);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(req);
    if (originCheck) return originCheck;

    const rateLimit = await enforceApiRateLimit(req, 'auth:login');
    if (rateLimit) return rateLimit;

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsed = body as Record<string, unknown>;
    let email = parsed.email as string | undefined;
    const staffId = parsed.staffId as string | undefined;

    if (staffId) {
      const { prisma } = await import('@/lib/database');
      const profile = await prisma.profile.findFirst({
        where: { staffId },
        select: { email: true },
      });
      if (profile) {
        email = profile.email;
      } else {
        // Always return success to prevent Staff ID enumeration
        return NextResponse.json({
          ok: true,
          message: 'If an account exists with this entry, you will receive password reset instructions shortly.'
        });
      }
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email or Staff ID is required.' }, { status: 400 });
    }

    email = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    const result = await requestPasswordReset(email);

    if ('error' in result) {
      logger.error('Password reset request failed', { email });
    }

    await auditAuthEvent({
      type: 'password_reset_requested',
      email,
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      message: 'If an account exists with this email, you will receive password reset instructions shortly.'
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
