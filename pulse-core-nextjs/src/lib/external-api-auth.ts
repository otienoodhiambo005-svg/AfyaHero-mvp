import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

export type DeveloperApiScope = 'fhir:read' | 'fhir:write';

export interface DeveloperAppConfig {
  appId: string;
  appKey: string;
  hospitalId: string;
  appType: 'patient_app' | 'chp_app' | 'partner_app';
  scopes: DeveloperApiScope[];
  signingSecret?: string;
}

export interface DeveloperAppAuth {
  appId: string;
  hospitalId: string;
  appType: DeveloperAppConfig['appType'];
  scopes: DeveloperApiScope[];
  signingSecret: string;
}

const APP_ID_HEADER = 'x-afyahero-app-id';
const APP_KEY_HEADER = 'x-afyahero-app-key';
const SIGNATURE_HEADER = 'x-afyahero-signature';
const TIMESTAMP_HEADER = 'x-afyahero-timestamp';

// Backward compatibility with earlier naming.
const LEGACY_APP_ID_HEADER = 'x-afyahero-client-id';
const LEGACY_APP_KEY_HEADER = 'x-afyahero-api-key';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const replayCache = new Map<string, number>();

function cleanupReplayCache() {
  const now = Date.now();
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= now) replayCache.delete(key);
  }
}

function safeParseDeveloperApps(raw: string | undefined): DeveloperAppConfig[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        appId: String(entry.appId ?? entry.clientId ?? ''),
        appKey: String(entry.appKey ?? entry.apiKey ?? ''),
        hospitalId: String(entry.hospitalId ?? ''),
        appType: (entry.appType as DeveloperAppConfig['appType']) ?? 'partner_app',
        scopes: Array.isArray(entry.scopes) ? (entry.scopes as DeveloperApiScope[]) : [],
        signingSecret: typeof entry.signingSecret === 'string' && entry.signingSecret.length > 0
          ? entry.signingSecret
          : undefined,
      }))
      .filter((app) =>
        Boolean(app.appId) &&
        Boolean(app.appKey) &&
        Boolean(app.hospitalId) &&
        Array.isArray(app.scopes),
      );
  } catch {
    return [];
  }
}

const configuredDeveloperApps = safeParseDeveloperApps(
  process.env.AFYAHERO_DEVELOPER_APPS_JSON ?? process.env.EXTERNAL_API_CLIENTS_JSON,
);

function computeSignature(
  signingSecret: string,
  method: string,
  pathAndQuery: string,
  timestamp: string,
) {
  return createHmac('sha256', signingSecret)
    .update(`${method}\n${pathAndQuery}\n${timestamp}`)
    .digest('hex');
}

function getHeader(req: NextRequest, primary: string, legacy?: string) {
  return req.headers.get(primary)?.trim() ?? (legacy ? req.headers.get(legacy)?.trim() : undefined);
}

export function authenticateDeveloperApp(req: NextRequest): DeveloperAppAuth | null {
  const appId = getHeader(req, APP_ID_HEADER, LEGACY_APP_ID_HEADER);
  const appKey = getHeader(req, APP_KEY_HEADER, LEGACY_APP_KEY_HEADER);
  if (!appId || !appKey) return null;

  const app = configuredDeveloperApps.find((entry) => entry.appId === appId);
  if (!app || app.appKey !== appKey) return null;

  const signingSecret = app.signingSecret ?? app.appKey;
  return {
    appId: app.appId,
    hospitalId: app.hospitalId,
    appType: app.appType,
    scopes: app.scopes,
    signingSecret,
  };
}

export function verifyDeveloperAppSignature(
  req: NextRequest,
  app: DeveloperAppAuth,
  options?: {
    enforceReplayProtection?: boolean;
  },
): { ok: true } | { ok: false; reason: string } {
  const signature = req.headers.get(SIGNATURE_HEADER)?.trim();
  const timestamp = req.headers.get(TIMESTAMP_HEADER)?.trim();
  if (!signature || !timestamp) {
    return { ok: false, reason: 'missing_signature_headers' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, reason: 'timestamp_out_of_window' };
  }

  const pathAndQuery = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const expected = computeSignature(app.signingSecret, req.method.toUpperCase(), pathAndQuery, timestamp);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  const enforceReplayProtection = options?.enforceReplayProtection ?? true;
  if (enforceReplayProtection) {
    cleanupReplayCache();
    const replayKey = `${app.appId}:${timestamp}:${signature}`;
    if (replayCache.has(replayKey)) {
      return { ok: false, reason: 'replay_detected' };
    }
    replayCache.set(replayKey, now + MAX_CLOCK_SKEW_MS);
  }

  return { ok: true };
}

export function hasDeveloperScope(
  app: DeveloperAppAuth | null,
  scope: DeveloperApiScope,
): boolean {
  if (!app) return false;
  return app.scopes.includes(scope);
}
