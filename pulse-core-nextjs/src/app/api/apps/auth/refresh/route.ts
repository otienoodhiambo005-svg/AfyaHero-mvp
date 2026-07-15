import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rotateRefreshToken } from '@/lib/v1-app-auth';
import { applyAuthGuards, authError, parseJsonWithSchema } from '../_shared';

export const dynamic = 'force-dynamic';

const refreshBodySchema = z
  .object({
    refreshToken: z.string().trim().min(1).max(8192),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await applyAuthGuards(req, 'api:apps:auth:refresh');
  if (guard) return guard;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return authError(400, 'BAD_REQUEST', 'Invalid JSON payload.');
  }

  const parsed = parseJsonWithSchema(refreshBodySchema, rawBody);
  if ('response' in parsed) return parsed.response;

  const rotated = rotateRefreshToken(parsed.data.refreshToken);
  if (!rotated) {
    return authError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token.');
  }

  return NextResponse.json(
    {
      ok: true,
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: rotated.expiresIn,
    },
    { status: 200 },
  );
}
