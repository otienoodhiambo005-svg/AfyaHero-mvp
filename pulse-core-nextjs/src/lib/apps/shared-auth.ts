import { NextRequest, NextResponse } from 'next/server';
import { enforceApiRateLimit, enforceRequestFirewall } from '@/lib/api-security';
import { requireAppPrincipal } from '@/lib/apps/auth-principals';
import { requireV1AppPrincipal, type V1AppPrincipal } from '@/lib/v1-app-auth';

type AllowedAppType = 'patient_app' | 'chp_app';

export interface SharedAppPrincipal {
  appId: string;
  appType: AllowedAppType;
  hospitalId: string;
  authMethod: 'token' | 'signed_headers';
  scopes: string[];
}

export type SharedAppGuardResult =
  | { principal: SharedAppPrincipal; response?: undefined }
  | { principal?: undefined; response: NextResponse };

function sharedAppError(status: 401 | 403 | 429 | 500, code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'INTERNAL_ERROR', message: string) {
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

function mapTokenPrincipal(principal: V1AppPrincipal): SharedAppPrincipal | null {
  if (principal.appType !== 'patient_app' && principal.appType !== 'chp_app') return null;
  return {
    appId: principal.appId,
    appType: principal.appType,
    hospitalId: principal.hospitalId,
    authMethod: 'token',
    scopes: [...principal.scopes],
  };
}

export async function requireSharedAppPrincipal(
  req: NextRequest,
  scope: string,
  requiredScope: 'fhir:read' | 'fhir:write' = 'fhir:read',
): Promise<SharedAppGuardResult> {
  const firewall = enforceRequestFirewall(req);
  if (firewall) {
    return { response: sharedAppError(403, 'FORBIDDEN', 'Request blocked by API firewall.') };
  }

  const limited = await enforceApiRateLimit(req, scope);
  if (limited) {
    const response = sharedAppError(429, 'RATE_LIMITED', 'Too many requests for shared app endpoint.');
    const passthroughHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'];
    for (const key of passthroughHeaders) {
      const value = limited.headers.get(key);
      if (value) response.headers.set(key, value);
    }
    return { response };
  }

  const hasBearerAuth = req.headers.get('authorization')?.toLowerCase().startsWith('bearer ') ?? false;
  if (hasBearerAuth) {
    const auth = requireV1AppPrincipal(req, {
      appTypes: ['patient_app', 'chp_app'],
      requiredScope,
    });
    if ('response' in auth) {
      return {
        response: auth.response.status === 401
          ? sharedAppError(401, 'UNAUTHORIZED', 'Shared app authentication required.')
          : sharedAppError(403, 'FORBIDDEN', 'Shared app scope or type is insufficient.'),
      };
    }

    const principal = mapTokenPrincipal(auth.principal);
    if (!principal) {
      return { response: sharedAppError(403, 'FORBIDDEN', 'Shared app type is not allowed.') };
    }
    return { principal };
  }

  const fallbackAuth = requireAppPrincipal(req, {
    allowedKinds: ['patient_app', 'chp_app'],
    requiredScope,
  });
  if ('response' in fallbackAuth) {
    return {
      response: fallbackAuth.response.status === 401
        ? sharedAppError(401, 'UNAUTHORIZED', 'Shared app signed-header authentication required.')
        : sharedAppError(403, 'FORBIDDEN', 'Shared app signed-header scope or type is insufficient.'),
    };
  }

  return {
    principal: {
      appId: fallbackAuth.principal.appId,
      appType:
        fallbackAuth.principal.kind === 'patient_app' ? 'patient_app' : 'chp_app',
      hospitalId: fallbackAuth.principal.hospitalId,
      authMethod: 'signed_headers',
      scopes: [...fallbackAuth.principal.scopes],
    },
  };
}

export function sharedAppInternalError(message = 'Unable to process request.') {
  return sharedAppError(500, 'INTERNAL_ERROR', message);
}
