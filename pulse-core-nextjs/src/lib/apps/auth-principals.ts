import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDeveloperApp,
  hasDeveloperScope,
  verifyDeveloperAppSignature,
  type DeveloperApiScope,
} from '@/lib/external-api-auth';
import type {
  AppPrincipal,
  ChpAppPrincipal,
  DeveloperAppPrincipal,
  PatientAppPrincipal,
} from '@/lib/apps/types';

type AppPrincipalKind = AppPrincipal['kind'];
type AppPrincipalWithoutStaff = Exclude<AppPrincipal, { kind: 'staff' }>;
type ResolvablePrincipalKind = Exclude<AppPrincipalKind, 'staff'>;

export interface ResolveAppPrincipalOptions {
  allowedKinds?: ResolvablePrincipalKind[];
  requiredScope?: DeveloperApiScope;
  requireSignature?: boolean;
  enforceReplayProtection?: boolean;
}

export function appUnauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: 'unauthorized', message }, { status: 401 });
}

export function appForbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
}

function mapDeveloperAppToPrincipal(app: {
  appId: string;
  hospitalId: string;
  appType: 'patient_app' | 'chp_app' | 'partner_app';
  scopes: DeveloperApiScope[];
}): AppPrincipalWithoutStaff {
  if (app.appType === 'patient_app') {
    const principal: PatientAppPrincipal = {
      kind: 'patient_app',
      appId: app.appId,
      hospitalId: app.hospitalId,
      scopes: [...app.scopes],
    };
    return principal;
  }

  if (app.appType === 'chp_app') {
    const principal: ChpAppPrincipal = {
      kind: 'chp_app',
      appId: app.appId,
      hospitalId: app.hospitalId,
      scopes: [...app.scopes],
    };
    return principal;
  }

  const principal: DeveloperAppPrincipal = {
    kind: 'developer_app',
    appId: app.appId,
    hospitalId: app.hospitalId,
    scopes: [...app.scopes],
  };
  return principal;
}

export function resolveAppPrincipal(
  req: NextRequest,
  options: ResolveAppPrincipalOptions = {},
): AppPrincipalWithoutStaff | null {
  const app = authenticateDeveloperApp(req);
  if (!app) return null;

  const requireSignature = options.requireSignature ?? true;
  if (requireSignature) {
    const verification = verifyDeveloperAppSignature(req, app, {
      enforceReplayProtection: options.enforceReplayProtection ?? true,
    });
    if (!verification.ok) return null;
  }

  if (options.requiredScope && !hasDeveloperScope(app, options.requiredScope)) {
    return null;
  }

  const principal = mapDeveloperAppToPrincipal(app);
  if (options.allowedKinds && !options.allowedKinds.includes(principal.kind)) {
    return null;
  }

  return principal;
}

export function requireAppPrincipal(
  req: NextRequest,
  options: ResolveAppPrincipalOptions = {},
): { principal: AppPrincipalWithoutStaff } | { response: NextResponse } {
  const app = authenticateDeveloperApp(req);
  if (!app) {
    return { response: appUnauthorizedResponse('Missing or invalid app credentials.') };
  }

  const requireSignature = options.requireSignature ?? true;
  if (requireSignature) {
    const verification = verifyDeveloperAppSignature(req, app, {
      enforceReplayProtection: options.enforceReplayProtection ?? true,
    });
    if (!verification.ok) {
      return { response: appUnauthorizedResponse('Missing or invalid app signature.') };
    }
  }

  if (options.requiredScope && !hasDeveloperScope(app, options.requiredScope)) {
    return { response: appForbiddenResponse('Insufficient scope.') };
  }

  const principal = mapDeveloperAppToPrincipal(app);
  if (options.allowedKinds && !options.allowedKinds.includes(principal.kind)) {
    return { response: appForbiddenResponse('Insufficient app type.') };
  }

  return { principal };
}
