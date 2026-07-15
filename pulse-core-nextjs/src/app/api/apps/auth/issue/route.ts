import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateDeveloperApp, verifyDeveloperAppSignature } from '@/lib/external-api-auth';
import { issueAppTokens } from '@/lib/v1-app-auth';
import { applyAuthGuards, authError, parseJsonWithSchema } from '../_shared';

export const dynamic = 'force-dynamic';

const issueBodySchema = z
  .object({
    patientId: z.string().trim().min(1).max(128).optional(),
    chpId: z.string().trim().min(1).max(128).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.patientId && data.chpId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['patientId'],
        message: 'Provide only one of patientId or chpId.',
      });
    }
  });

export async function POST(req: NextRequest) {
  const guard = await applyAuthGuards(req, 'api:apps:auth:issue');
  if (guard) return guard;

  const app = authenticateDeveloperApp(req);
  if (!app) {
    return authError(401, 'UNAUTHORIZED', 'Developer app authentication is required.');
  }

  const signature = verifyDeveloperAppSignature(req, app);
  if (!signature.ok) {
    return authError(401, 'UNAUTHORIZED', 'Invalid developer app signature.');
  }

  if (app.appType !== 'patient_app' && app.appType !== 'chp_app') {
    return authError(403, 'FORBIDDEN', 'App type is not allowed for auth lifecycle endpoints.');
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  const parsed = parseJsonWithSchema(issueBodySchema, rawBody);
  if ('response' in parsed) return parsed.response;

  if (app.appType === 'patient_app' && parsed.data.chpId) {
    return authError(400, 'BAD_REQUEST', 'patient_app cannot issue tokens for chpId context.');
  }
  if (app.appType === 'chp_app' && parsed.data.patientId) {
    return authError(400, 'BAD_REQUEST', 'chp_app cannot issue tokens for patientId context.');
  }

  const tokenSet = issueAppTokens(app, {
    subjectType: parsed.data.patientId ? 'patient' : parsed.data.chpId ? 'chp' : undefined,
    subjectId: parsed.data.patientId ?? parsed.data.chpId,
  });
  if (!tokenSet) {
    return authError(401, 'UNAUTHORIZED', 'Unable to issue app tokens.');
  }

  return NextResponse.json(
    {
      ok: true,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      expiresIn: tokenSet.expiresIn,
    },
    { status: 200 },
  );
}
