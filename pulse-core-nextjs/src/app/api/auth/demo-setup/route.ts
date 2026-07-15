/**
 * Demo Session Setup
 * Validates superadmin-generated token and creates demo session
 */

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { parseSignedSession, signSession } from '@/lib/session';
import logger from '@/lib/logger';
import type { UserSession } from '@/types';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { isDemoEnabled } from '@/lib/env';
import { isStandaloneSuperAdminMode } from '@/lib/app-mode';
import { redeemDemoInvitation } from '@/lib/demo-invitations';

interface DemoSetupRequest {
  token: string;
}

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceApiGuard(req, {
      scope: 'api:auth:demo-setup',
      requireAuth: false,
    });
    if (guard.response) return guard.response;

    if (isStandaloneSuperAdminMode()) {
      return NextResponse.json(
        { error: 'Demo setup is disabled in standalone superadmin mode.' },
        { status: 403 },
      );
    }

    if (!isDemoEnabled()) {
      return NextResponse.json(
        { error: 'Demo setup is disabled in this environment.' },
        { status: 403 },
      );
    }

    const body = await readJsonBody<unknown>(req);
    if (body instanceof NextResponse) return body;

    const parsed = body as Partial<DemoSetupRequest>;
    const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';

    if (!token) {
      return NextResponse.json(
        { error: 'Demo token is required' },
        { status: 400 }
      );
    }

    // Validate the token is a valid session
    let demoSession: UserSession | null;
    try {
      demoSession = parseSignedSession(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid demo token' },
        { status: 400 }
      );
    }

    if (!demoSession) {
      return NextResponse.json(
        { error: 'Invalid demo token' },
        { status: 400 }
      );
    }

    // Verify it's a demo session
    if (!demoSession.demo) {
      return NextResponse.json(
        { error: 'Invalid demo session' },
        { status: 400 }
      );
    }

    // DB-backed redemption: enforces revocation, expiry, and tracks usage.
    const redemption = await redeemDemoInvitation(token);
    if (!redemption.ok) {
      const message =
        redemption.reason === 'revoked'
          ? 'This demo session has been revoked.'
          : redemption.reason === 'expired'
            ? 'Demo session has expired.'
            : 'Invalid or unknown demo token.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Refresh the session with updated timestamp
    const refreshedSession: UserSession = {
      ...demoSession,
      lastActivityAt: Date.now(),
    };

    // Set the session cookie
    const response = NextResponse.json({
      ok: true,
      redirectUrl: `/portal/${demoSession.role}`,
      session: refreshedSession,
    });

    response.cookies.set(SESSION_COOKIE, signSession(refreshedSession), {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
      secure: process.env.NODE_ENV === 'production',
    });

    logger.info('Demo session activated', {
      role: demoSession.role,
      hospitalName: demoSession.hospitalName,
    });

    return response;
  } catch (error) {
    logger.error('Demo setup error', { error });
    return NextResponse.json(
      { error: 'Failed to setup demo session' },
      { status: 500 }
    );
  }
}
