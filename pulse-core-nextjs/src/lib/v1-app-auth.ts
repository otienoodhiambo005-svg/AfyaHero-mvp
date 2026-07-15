import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { DeveloperApiScope, DeveloperAppAuth, DeveloperAppConfig } from '@/lib/external-api-auth';

type AppType = DeveloperAppConfig['appType'];
type TokenKind = 'access' | 'refresh';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = 'afyahero-hospital-os';
const AUDIENCE = 'afyahero-v1-app-api';

const globalState = globalThis as typeof globalThis & {
  __afyaheroRefreshNonceCache?: Map<string, number>;
};

const refreshNonceCache = globalState.__afyaheroRefreshNonceCache ?? new Map<string, number>();
if (!globalState.__afyaheroRefreshNonceCache) {
  globalState.__afyaheroRefreshNonceCache = refreshNonceCache;
}

export interface V1AppPrincipal {
  appId: string;
  appType: AppType;
  hospitalId: string;
  scopes: DeveloperApiScope[];
  subjectType?: 'patient' | 'chp';
  subjectId?: string;
}

export interface ValidatedAccessToken {
  principal: V1AppPrincipal;
  exp: number;
}

interface TokenPayload extends V1AppPrincipal {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  kind: TokenKind;
  nonce: string;
}

function getTokenSecret(): string | null {
  const secret = process.env.AFYAHERO_V1_APP_TOKEN_SECRET;
  if (!secret || secret.trim().length < 32) return null;
  return secret.trim();
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signParts(headerPart: string, payloadPart: string, secret: string): string {
  return createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest('base64url');
}

function makeToken(payload: TokenPayload, secret: string): string {
  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const sig = signParts(headerPart, payloadPart, secret);
  return `${headerPart}.${payloadPart}.${sig}`;
}

function validateToken(token: string, secret: string): TokenPayload | null {
  const [headerPart, payloadPart, sigPart] = token.split('.');
  if (!headerPart || !payloadPart || !sigPart) return null;

  const expected = signParts(headerPart, payloadPart, secret);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(sigPart);
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as TokenPayload;
    if (payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueAppTokens(
  app: DeveloperAppAuth,
  options?: {
    subjectType?: 'patient' | 'chp';
    subjectId?: string;
  },
): { accessToken: string; refreshToken: string; expiresIn: number } | null {
  const secret = getTokenSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const common = {
    appId: app.appId,
    appType: app.appType,
    hospitalId: app.hospitalId,
    scopes: app.scopes,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
  };

  const accessToken = makeToken(
    {
      ...common,
      kind: 'access',
      exp: now + ACCESS_TTL_SECONDS,
      nonce: randomUUID(),
    },
    secret,
  );
  const refreshNonce = randomUUID();
  const refreshToken = makeToken(
    {
      ...common,
      kind: 'refresh',
      exp: now + REFRESH_TTL_SECONDS,
      nonce: refreshNonce,
    },
    secret,
  );
  refreshNonceCache.set(refreshNonce, Date.now() + REFRESH_TTL_SECONDS * 1000);

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

function cleanupRefreshNonceCache() {
  const now = Date.now();
  for (const [nonce, expiresAt] of refreshNonceCache.entries()) {
    if (expiresAt <= now) refreshNonceCache.delete(nonce);
  }
}

export function rotateRefreshToken(refreshToken: string): { principal: V1AppPrincipal; accessToken: string; refreshToken: string; expiresIn: number } | null {
  const secret = getTokenSecret();
  if (!secret) return null;

  cleanupRefreshNonceCache();
  const payload = validateToken(refreshToken, secret);
  if (!payload || payload.kind !== 'refresh') return null;
  if (!refreshNonceCache.has(payload.nonce)) return null;
  refreshNonceCache.delete(payload.nonce);

  const appLike: DeveloperAppAuth = {
    appId: payload.appId,
    appType: payload.appType,
    hospitalId: payload.hospitalId,
    scopes: payload.scopes,
    signingSecret: '',
  };
  const next = issueAppTokens(appLike, {
    subjectType: payload.subjectType,
    subjectId: payload.subjectId,
  });
  if (!next) return null;

  return {
    principal: {
      appId: payload.appId,
      appType: payload.appType,
      hospitalId: payload.hospitalId,
      scopes: payload.scopes,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
    },
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    expiresIn: next.expiresIn,
  };
}

export function requireV1AppPrincipal(
  req: NextRequest,
  options?: {
    appTypes?: AppType[];
    requiredScope?: DeveloperApiScope;
  },
): { principal: V1AppPrincipal } | { response: NextResponse } {
  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const token = auth.slice(7).trim();
  const secret = getTokenSecret();
  if (!secret) {
    return { response: NextResponse.json({ error: 'Server auth secret is not configured.' }, { status: 500 }) };
  }

  const payload = validateToken(token, secret);
  if (!payload || payload.kind !== 'access') {
    return { response: NextResponse.json({ error: 'Invalid or expired access token.' }, { status: 401 }) };
  }

  if (options?.appTypes && !options.appTypes.includes(payload.appType)) {
    return { response: NextResponse.json({ error: 'Insufficient app type.' }, { status: 403 }) };
  }

  if (options?.requiredScope && !payload.scopes.includes(options.requiredScope)) {
    return { response: NextResponse.json({ error: 'Insufficient scope.' }, { status: 403 }) };
  }

  return {
    principal: {
      appId: payload.appId,
      appType: payload.appType,
      hospitalId: payload.hospitalId,
      scopes: payload.scopes,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
    },
  };
}

export function validateAccessToken(accessToken: string): ValidatedAccessToken | null {
  const secret = getTokenSecret();
  if (!secret) return null;

  const payload = validateToken(accessToken, secret);
  if (!payload || payload.kind !== 'access') return null;

  return {
    principal: {
      appId: payload.appId,
      appType: payload.appType,
      hospitalId: payload.hospitalId,
      scopes: payload.scopes,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
    },
    exp: payload.exp,
  };
}
