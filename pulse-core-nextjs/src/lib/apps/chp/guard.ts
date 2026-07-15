import { NextRequest, NextResponse } from 'next/server';
import type { DeveloperApiScope } from '@/lib/external-api-auth';
import { requireV1AppPrincipal, type V1AppPrincipal } from '@/lib/v1-app-auth';
import { enforceApiRateLimit } from '@/lib/api-security';
import { auditLog, type AuditAction } from '@/lib/audit';
import { requireAppPrincipal } from '@/lib/apps/auth-principals';

type ChpErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED';

interface ChpGuardResult {
  principal: V1AppPrincipal | null;
  response: NextResponse | null;
}

export function chpError(status: 400 | 401 | 403 | 429, code: ChpErrorCode, message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function requireChpPrincipal(
  req: NextRequest,
  requiredScope: DeveloperApiScope,
): Promise<ChpGuardResult> {
  const limited = await enforceApiRateLimit(req, 'apps:chp');
  if (limited) {
    return {
      principal: null,
      response: chpError(429, 'RATE_LIMITED', 'Too many requests for CHP app principal.'),
    };
  }

  const hasBearerAuth = req.headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false;

  if (hasBearerAuth) {
    const auth = requireV1AppPrincipal(req, {
      appTypes: ['chp_app'],
      requiredScope,
    });
    if ('response' in auth) {
      const status = auth.response.status;
      if (status === 401) {
        return { principal: null, response: chpError(401, 'UNAUTHORIZED', 'CHP app authentication required.') };
      }
      return { principal: null, response: chpError(403, 'FORBIDDEN', 'CHP app scope or type is insufficient.') };
    }

    if (auth.principal.subjectType && auth.principal.subjectType !== 'chp') {
      return {
        principal: null,
        response: chpError(403, 'FORBIDDEN', 'Token subject must be CHP for this route group.'),
      };
    }

    if (!auth.principal.hospitalId) {
      return {
        principal: null,
        response: chpError(403, 'FORBIDDEN', 'Hospital tenant context is required.'),
      };
    }

    return { principal: auth.principal, response: null };
  }

  const fallbackAuth = requireAppPrincipal(req, {
    allowedKinds: ['chp_app'],
    requiredScope,
  });
  if ('response' in fallbackAuth) {
    if (fallbackAuth.response.status === 401) {
      return {
        principal: null,
        response: chpError(401, 'UNAUTHORIZED', 'CHP app signed-header authentication required.'),
      };
    }
    return {
      principal: null,
      response: chpError(403, 'FORBIDDEN', 'CHP app signed-header scope or type is insufficient.'),
    };
  }

  const principal: V1AppPrincipal = {
    appId: fallbackAuth.principal.appId,
    appType: 'chp_app',
    hospitalId: fallbackAuth.principal.hospitalId,
    scopes: [...fallbackAuth.principal.scopes] as DeveloperApiScope[],
    subjectType: 'chp',
  };
  return { principal, response: null };
}

export async function auditChpAction(
  req: NextRequest,
  principal: V1AppPrincipal,
  action: AuditAction,
  resourceType: string,
  detail?: Record<string, unknown>,
) {
  await auditLog({
    action,
    actor_id: principal.subjectId ?? principal.appId,
    actor_email: `${principal.appId}@chp.app`,
    actor_role: 'chp_app',
    hospital_id: principal.hospitalId,
    resource_type: resourceType,
    detail,
    ip_address: getClientIp(req),
  });
}
