import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiRateLimit, enforceRequestFirewall } from '@/lib/api-security';

type ErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED';

export function authError(
  status: 400 | 401 | 403 | 429,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

export async function applyAuthGuards(
  req: NextRequest,
  scope: string,
): Promise<NextResponse | null> {
  const firewall = enforceRequestFirewall(req);
  if (firewall) return authError(403, 'FORBIDDEN', 'Request blocked by API firewall.');

  const rateLimited = await enforceApiRateLimit(req, scope);
  if (rateLimited) {
    const response = authError(429, 'RATE_LIMITED', 'Too many requests for app auth endpoint.');
    const passthroughHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'];
    for (const key of passthroughHeaders) {
      const value = rateLimited.headers.get(key);
      if (value) response.headers.set(key, value);
    }
    return response;
  }

  return null;
}

export function parseJsonWithSchema<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { data: T } | { response: NextResponse } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: authError(400, 'BAD_REQUEST', 'Invalid request payload.', {
        fields: parsed.error.flatten().fieldErrors,
      }),
    };
  }
  return { data: parsed.data };
}
