import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, enforceRequestFirewall, enforceTrustedOrigin, readJsonBody } from '@/lib/api-security';
import { updatePassword } from '@/lib/supabase-auth';
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
    const password = parsed.password as string | undefined;

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // Get access token from Authorization header (set by Supabase redirect)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 401 }
      );
    }

    const result = await updatePassword(password, token);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
    await auditAuthEvent({
      type: 'password_reset_completed',
      ipAddress: clientIp,
      userAgent: req.headers.get('user-agent') ?? 'unknown',
    });

    logger.info('User password reset completed');

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You can now log in.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
