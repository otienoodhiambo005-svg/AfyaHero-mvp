import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAccessToken } from '@/lib/v1-app-auth';
import { applyAuthGuards, authError, parseJsonWithSchema } from '../_shared';

export const dynamic = 'force-dynamic';

const introspectBodySchema = z
  .object({
    accessToken: z.string().trim().min(1).max(8192),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await applyAuthGuards(req, 'api:apps:auth:introspect');
  if (guard) return guard;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return authError(400, 'BAD_REQUEST', 'Invalid JSON payload.');
  }

  const parsed = parseJsonWithSchema(introspectBodySchema, rawBody);
  if ('response' in parsed) return parsed.response;

  const validated = validateAccessToken(parsed.data.accessToken);
  if (!validated) {
    return NextResponse.json(
      {
        ok: true,
        active: false,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      active: true,
      appId: validated.principal.appId,
      appType: validated.principal.appType,
      hospitalId: validated.principal.hospitalId,
      scopes: validated.principal.scopes,
      subjectType: validated.principal.subjectType ?? null,
      subjectId: validated.principal.subjectId ?? null,
      exp: validated.exp,
    },
    { status: 200 },
  );
}
