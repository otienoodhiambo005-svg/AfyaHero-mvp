import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDeveloperApp,
  verifyDeveloperAppSignature,
} from '@/lib/external-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const app = authenticateDeveloperApp(req);
  if (!app) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_app_credentials',
        message:
          'App authentication failed. Check x-afyahero-app-id and x-afyahero-app-key.',
      },
      { status: 401 },
    );
  }

  // Do not consume replay cache on verification endpoint to allow iterative onboarding tests.
  const signatureCheck = verifyDeveloperAppSignature(req, app, {
    enforceReplayProtection: false,
  });
  if (!signatureCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: signatureCheck.reason,
        message:
          'Signature validation failed. Confirm payload format METHOD\\nPATH_AND_QUERY\\nTIMESTAMP.',
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      appId: app.appId,
      appType: app.appType,
      hospitalId: app.hospitalId,
      scopes: app.scopes,
      serverTime: Date.now(),
      message: 'Developer API authentication verified.',
    },
    { status: 200 },
  );
}

