import { NextRequest, NextResponse } from 'next/server';
import { verifyTOTPCode, hashBackupCode } from '@/lib/two-factor-auth';
import { auditLog } from '@/lib/audit-logging';
import logger from '@/lib/logger';
import { enforceApiRateLimit, enforceLoginRateLimit, enforceRequestFirewall, enforceTrustedOrigin, readJsonBody } from '@/lib/api-security';

export async function POST(request: NextRequest) {
  try {
    const firewall = enforceRequestFirewall(request);
    if (firewall) return firewall;
    const originCheck = enforceTrustedOrigin(request);
    if (originCheck) return originCheck;

    const loginRateLimit = await enforceLoginRateLimit(request);
    if (loginRateLimit) return loginRateLimit;

    const rateLimit = await enforceApiRateLimit(request, 'auth:2fa:verify');
    if (rateLimit) return rateLimit;

    const body = await readJsonBody<unknown>(request);
    if (body instanceof NextResponse) return body;

    const parsed = body as Record<string, unknown>;
    const userId = typeof parsed.userId === 'string' ? parsed.userId.trim() : '';
    const code = typeof parsed.code === 'string' ? parsed.code.trim() : '';
    const method = parsed.method === 'backup' ? 'backup' : 'totp';

    if (!userId || !code) {
      return NextResponse.json(
        { ok: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (!/^[A-Za-z0-9_-]{3,128}$/.test(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid verification request' },
        { status: 400 },
      );
    }

    if (method === 'totp' && !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid verification code format' },
        { status: 400 },
      );
    }

    if (method === 'backup' && !/^[A-Za-z0-9-]{6,64}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid backup code format' },
        { status: 400 },
      );
    }

    // Get user 2FA data from database
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { ok: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user 2FA configuration
    const { data: user2FA, error } = await supabase
      .from('admin_two_factor')
      .select('secret, backup_codes, enabled, last_verified_at')
      .eq('user_id', userId)
      .single();

    if (error || !user2FA || !user2FA.enabled) {
      return NextResponse.json(
        { ok: false, error: 'Two factor authentication not enabled for this account' },
        { status: 400 }
      );
    }

    let verified = false;

    if (method === 'totp') {
      verified = verifyTOTPCode(user2FA.secret, code);
    } else if (method === 'backup') {
      // Check if backup code exists and hasn't been used
      const codeHash = hashBackupCode(code);
      const backupCodes = user2FA.backup_codes || [];

      if (backupCodes.includes(codeHash)) {
        verified = true;
        // Remove used backup code
        const updatedCodes = backupCodes.filter((c: string) => c !== codeHash);
        await supabase
          .from('admin_two_factor')
          .update({ backup_codes: updatedCodes })
          .eq('user_id', userId);
      }
    }

    await auditLog({
      type: method === 'backup' ? '2fa_backup_attempt' : '2fa_attempt',
      userId,
      role: 'admin' as const,
      hospitalId: 'unknown',
      description: `2FA verification ${verified ? 'succeeded' : 'failed'} via ${method}`,
      success: verified,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      recordedAt: new Date(),
    });

    if (verified) {
      await supabase
        .from('admin_two_factor')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('user_id', userId);

      return NextResponse.json({
        ok: true,
        verified: true,
        message: 'Two factor authentication successful',
      });
    } else {
      return NextResponse.json(
        { ok: false, verified: false, error: 'Invalid verification code' },
        { status: 401 }
      );
    }

  } catch (error) {
    logger.error('2FA Verification error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: 'Internal server error during verification' },
      { status: 500 }
    );
  }
}
