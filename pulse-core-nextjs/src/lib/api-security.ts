import { NextRequest, NextResponse } from 'next/server';
import { parseSignedSession } from '@/lib/session';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { SESSION_COOKIE } from '@/lib/auth';
import type { PortalRole, UserSession } from '@/types';
import logger from '@/lib/logger';

// Returns null when OK, or a NextResponse (429) when rate-limited

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const allowTestRateLimitOverride = process.env.TEST_RATE_LIMIT_OVERRIDE_ENABLED === '1';
const DEFAULT_MAX_API_BODY_BYTES = 1024 * 1024;

// Tiered rate limiters mapping endpoint patterns to strictness
const rateLimiters: Record<string, Ratelimit> = {};

// Role-based rate limit limits (requests per minute)
const ROLE_RATE_LIMITS: Record<string, number> = {
  admin: 200,
  super_admin: 300,
  medical: 150,
  lab: 120,
  pharmacy: 120,
  reception: 100,
};

if (redisUrl && redisToken && redisUrl.startsWith('https://')) {
  try {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    
    // Global standard rate limit
    rateLimiters.default = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '60 s'),
      analytics: true,
      prefix: 'ratelimit:default',
    });
    
    // Strict limits for costly AI endpoints
    rateLimiters['ai:heavy'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      analytics: true,
      prefix: 'ratelimit:ai:heavy',
    });

    // Lab interpretation AI endpoint
    rateLimiters['ai:lab'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '60 s'),
      analytics: true,
      prefix: 'ratelimit:ai:lab',
    });

    // Clinical AI endpoints (diagnosis, deterioration risk, alerts)
    rateLimiters['ai:clinical'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(40, '60 s'),
      analytics: true,
      prefix: 'ratelimit:ai:clinical',
    });

    // Documentation AI endpoint
    rateLimiters['ai:documentation'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      analytics: true,
      prefix: 'ratelimit:ai:documentation',
    });

    // Population health AI endpoint
    rateLimiters['ai:population'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      analytics: true,
      prefix: 'ratelimit:ai:population',
    });

    // Auth / login limit
    rateLimiters['auth:login'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, '15 m'), // Increased for tests
      analytics: true,
      prefix: 'ratelimit:auth:login',
    });

    // High throughput for static or light data
    rateLimiters['fhir:read'] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(300, '60 s'),
      analytics: true,
      prefix: 'ratelimit:fhir:read',
    });

    // Role-specific rate limiters
    Object.entries(ROLE_RATE_LIMITS).forEach(([role, limit]) => {
      rateLimiters[`role:${role}`] = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, '60 s'),
        analytics: true,
        prefix: `ratelimit:role:${role}`,
      });
    });
  } catch {
    logger.error('Failed to initialize Redis rate limiters');
  }
}

function getRateLimiterForEndpoint(identifier: string, role?: string): Ratelimit | null {
  if (Object.keys(rateLimiters).length === 0) return null;
  
  // Use role-based rate limit if role is provided
  if (role && rateLimiters[`role:${role}`]) {
    return rateLimiters[`role:${role}`];
  }
  
  // AI-specific rate limiting
  if (identifier.includes('api:lab:interpret') || identifier.includes('ai:lab')) {
    return rateLimiters['ai:lab'];
  }
  if (identifier.includes('api:clinical') || identifier.includes('ai:clinical')) {
    return rateLimiters['ai:clinical'];
  }
  if (identifier.includes('api:clinical:documentation') || identifier.includes('ai:documentation')) {
    return rateLimiters['ai:documentation'];
  }
  if (identifier.includes('api:population') || identifier.includes('ai:population')) {
    return rateLimiters['ai:population'];
  }
  if (identifier.includes('ai:orchestrate') || identifier.includes('ai:heavy')) {
    return rateLimiters['ai:heavy'];
  }
  
  if (identifier === 'auth:login') {
    return rateLimiters['auth:login'];
  }
  if (identifier.startsWith('fhir') && identifier.includes('read')) {
    return rateLimiters['fhir:read'];
  }
  return rateLimiters.default || null;
}

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function splitCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function ipMatchesPattern(ip: string, pattern: string): boolean {
  if (!pattern) return false;
  if (pattern.includes('*')) {
    const prefix = pattern.replace(/\*/g, '');
    return ip.startsWith(prefix);
  }
  return ip === pattern;
}

export function enforceRequestFirewall(req: NextRequest): NextResponse | null {
  const ip = extractClientIp(req);
  const userAgent = (req.headers.get('user-agent') ?? '').toLowerCase();
  const allowIps = splitCsv(process.env.FIREWALL_ALLOWED_IPS);
  const blockIps = splitCsv(process.env.FIREWALL_BLOCKED_IPS);
  const blockedUa = splitCsv(process.env.FIREWALL_BLOCKED_USER_AGENTS ?? 'sqlmap,nikto,nmap,nessus,acunetix,dirbuster');

  if (allowIps.length > 0 && !allowIps.some((pattern) => ipMatchesPattern(ip, pattern))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (blockIps.some((pattern) => ipMatchesPattern(ip, pattern))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (blockedUa.some((needle) => needle.length > 0 && userAgent.includes(needle.toLowerCase()))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

export function enforceTrustedOrigin(req: NextRequest): NextResponse | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    return null;
  }

  const origin = req.headers.get('origin');
  const secFetchSite = (req.headers.get('sec-fetch-site') ?? '').toLowerCase();
  const allowedOrigins = new Set<string>([
    req.nextUrl.origin,
    ...splitCsv(process.env.ALLOWED_ORIGINS),
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
    ...(process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []),
  ]);

  if (secFetchSite === 'cross-site' && !origin) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  if (secFetchSite === 'cross-site' && origin && !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  return null;
}

export async function enforceApiRateLimit(req: NextRequest, scope = 'api'): Promise<NextResponse | null> {
  if (allowTestRateLimitOverride && req.headers.get('x-afyahero-test-force-rate-limit') === '1') {
    const reset = Date.now() + 60_000;
    return NextResponse.json(
      { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '1',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
        },
      },
    );
  }

  // Extract user role from session if available
  let userRole: string | undefined;
  try {
    const cookie = req.cookies.get(SESSION_COOKIE);
    if (cookie) {
      const session = parseSignedSession(cookie.value);
      if (session) {
        userRole = session.role;
      }
    }
  } catch {
    // Session parsing failed, continue without role-based limiting
  }

  const limiter = getRateLimiterForEndpoint(scope, userRole);
  if (!limiter) return null;

  try {
    const ip = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') ?? '';
    const key = `${scope}:${ip}:${userAgent}${userRole ? `:${userRole}` : ''}`;
    
    const { success, limit, reset, remaining } = await limiter.limit(key);
    if (!success) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded. Please try again.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        },
      );
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Stricter rate limiting for login attempts to prevent brute-force attacks.
 * Default: 5 attempts per 15 minutes per IP
 */
export async function enforceLoginRateLimit(req: NextRequest): Promise<NextResponse | null> {
  if (allowTestRateLimitOverride && req.headers.get('x-afyahero-test-skip-rate-limit') === '1') {
    return null;
  }

  const limiter = getRateLimiterForEndpoint('auth:login');
  if (!limiter) return null;

  try {
    const ip = extractClientIp(req);
    // Use the existing ratelimit instance but with 'auth:login' scope for tighter limits
    // The middleware will apply stricter rate limiting by using a different scope
    const { success, limit: _limit, reset, remaining } = await limiter.limit(`auth:login:${ip}`);
    if (!success) {
      const maxAttempts = parseInt(process.env.SESSION_LOGIN_MAX_ATTEMPTS ?? '5', 10);
      const windowMinutes = parseInt(process.env.SESSION_LOGIN_WINDOW_MINUTES ?? '15', 10);
      return NextResponse.json(
        {
          error: 'Too Many Login Attempts',
          message: `Too many failed login attempts. Please try again in ${windowMinutes} minutes.`,
          retryAfter: reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(maxAttempts),
            'X-RateLimit-Remaining': String(remaining),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        },
      );
    }
    return null;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): UserSession | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return parseSignedSession(raw);
  } catch {
    return null;
  }
}

export function requireRoles(req: NextRequest, allowed: PortalRole[]): UserSession | NextResponse {
  const session = getSessionFromRequest(req);
  if (!session || !allowed.includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

export interface ApiGuardOptions {
  scope?: string;
  roles?: PortalRole[];
  requireAuth?: boolean;
  requireFirewall?: boolean;
  requireTrustedOrigin?: boolean;
  /**
   * When true, demo sessions (`session.demo === true`) are rejected with 403.
   * Use on routes that mutate real tenant data or expose live PHI.
   */
  denyDemo?: boolean;
}

export interface ApiGuardResult {
  session: UserSession | null;
  response: NextResponse | null;
}

/**
 * Fail-closed guard used by sensitive API routes.
 *
 * Applies, in order:
 * 1) firewall checks
 * 2) trusted origin checks (for mutating methods)
 * 3) rate limiting
 * 4) session auth / role auth
 */
export async function enforceApiGuard(
  req: NextRequest,
  options: ApiGuardOptions = {},
): Promise<ApiGuardResult> {
  const requireFirewall = options.requireFirewall ?? true;
  const requireTrustedOrigin = options.requireTrustedOrigin ?? true;
  const requireAuth = options.requireAuth ?? true;
  const scope = options.scope ?? 'api';
  // Default-deny demo sessions on mutating HTTP methods unless the route
  // explicitly opts in by setting denyDemo: false. Read methods are allowed
  // by default so demo sessions can browse seeded data.
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (req.method || '').toUpperCase(),
  );
  const denyDemo = options.denyDemo ?? isMutating;

  if (requireFirewall) {
    const firewall = enforceRequestFirewall(req);
    if (firewall) {
      return { session: null, response: firewall };
    }
  }

  if (requireTrustedOrigin) {
    const origin = enforceTrustedOrigin(req);
    if (origin) {
      return { session: null, response: origin };
    }
  }

  const limited = await enforceApiRateLimit(req, scope);
  if (limited) {
    return { session: null, response: limited };
  }

  if (options.roles && options.roles.length > 0) {
    const roleCheck = requireRoles(req, options.roles);
    if (roleCheck instanceof NextResponse) {
      return { session: null, response: roleCheck };
    }
    if (denyDemo && roleCheck.demo) {
      return {
        session: null,
        response: NextResponse.json(
          { error: 'Demo sessions are not permitted on this endpoint.' },
          { status: 403 },
        ),
      };
    }
    return { session: roleCheck, response: null };
  }

  if (!requireAuth) {
    const maybeSession = getSessionFromRequest(req);
    if (denyDemo && maybeSession?.demo) {
      return {
        session: null,
        response: NextResponse.json(
          { error: 'Demo sessions are not permitted on this endpoint.' },
          { status: 403 },
        ),
      };
    }
    return { session: maybeSession, response: null };
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (denyDemo && session.demo) {
    return {
      session: null,
      response: NextResponse.json(
        { error: 'Demo sessions are not permitted on this endpoint.' },
        { status: 403 },
      ),
    };
  }

  return { session, response: null };
}

export async function readJsonBody<T>(req: NextRequest): Promise<T | NextResponse> {
  const configuredMaxBodyBytes = Number(process.env.MAX_API_BODY_BYTES);
  const maxBodyBytes =
    Number.isFinite(configuredMaxBodyBytes) && configuredMaxBodyBytes > 0
      ? configuredMaxBodyBytes
      : DEFAULT_MAX_API_BODY_BYTES;
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  const contentLengthHeader = req.headers.get('content-length');

  if (contentType && !contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json.' }, { status: 415 });
  }

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0 || !Number.isInteger(contentLength)) {
      return NextResponse.json({ error: 'Content-Length must be a valid byte count.' }, { status: 400 });
    }
    if (contentLength > maxBodyBytes) {
      return NextResponse.json({ error: `Payload too large. Max ${maxBodyBytes} bytes.` }, { status: 413 });
    }
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
      return NextResponse.json({ error: `Payload too large. Max ${maxBodyBytes} bytes.` }, { status: 413 });
    }
    return JSON.parse(rawBody) as T;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
}

export function requireString(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number },
): string | NextResponse {
  if (typeof value !== 'string') {
    return NextResponse.json({ error: `${field} must be a string.` }, { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
  }
  if (options?.min && trimmed.length < options.min) {
    return NextResponse.json({ error: `${field} must be at least ${options.min} characters.` }, { status: 400 });
  }
  if (options?.max && trimmed.length > options.max) {
    return NextResponse.json({ error: `${field} must be at most ${options.max} characters.` }, { status: 400 });
  }
  return trimmed;
}

export function validateOptionalString(
  value: unknown,
  field: string,
  options?: { max?: number },
): string | undefined | NextResponse {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    return NextResponse.json({ error: `${field} must be a string.` }, { status: 400 });
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (options?.max && trimmed.length > options.max) {
    return NextResponse.json({ error: `${field} must be at most ${options.max} characters.` }, { status: 400 });
  }
  return trimmed;
}

export function validateEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | NextResponse {
  if (typeof value !== 'string') {
    return NextResponse.json({ error: `${field} must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }
  if (!allowed.includes(value as T)) {
    return NextResponse.json({ error: `${field} must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }
  return value as T;
}

export function validateNumber(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number; integer?: boolean; defaultValue?: number },
): number | NextResponse {
  const candidate = value ?? options?.defaultValue;
  const n = Number(candidate);
  if (!Number.isFinite(n)) {
    return NextResponse.json({ error: `${field} must be a valid number.` }, { status: 400 });
  }
  if (options?.integer && !Number.isInteger(n)) {
    return NextResponse.json({ error: `${field} must be an integer.` }, { status: 400 });
  }
  if (options?.min !== undefined && n < options.min) {
    return NextResponse.json({ error: `${field} must be >= ${options.min}.` }, { status: 400 });
  }
  if (options?.max !== undefined && n > options.max) {
    return NextResponse.json({ error: `${field} must be <= ${options.max}.` }, { status: 400 });
  }
  return n;
}

export function validateUrl(value: unknown, field: string): string | NextResponse {
  const s = requireString(value, field, { min: 3, max: 2048 });
  if (s instanceof NextResponse) return s;
  try {
    const parsed = new URL(s);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: `${field} must be a valid http(s) URL.` }, { status: 400 });
    }
    return s;
  } catch {
    return NextResponse.json({ error: `${field} must be a valid URL.` }, { status: 400 });
  }
}

export function validateStringArray(
  value: unknown,
  field: string,
  options?: { maxItems?: number; itemMaxLength?: number; normalize?: (item: string) => string },
): string[] | NextResponse {
  if (!Array.isArray(value)) {
    return NextResponse.json({ error: `${field} must be an array.` }, { status: 400 });
  }
  if (options?.maxItems && value.length > options.maxItems) {
    return NextResponse.json({ error: `${field} cannot exceed ${options.maxItems} items.` }, { status: 400 });
  }
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return NextResponse.json({ error: `${field} items must be strings.` }, { status: 400 });
    }
    let normalized = item.trim();
    if (options?.normalize) {
      normalized = options.normalize(normalized);
    }
    if (!normalized) continue;
    if (options?.itemMaxLength && normalized.length > options.itemMaxLength) {
      return NextResponse.json({ error: `${field} items must be <= ${options.itemMaxLength} chars.` }, { status: 400 });
    }
    out.push(normalized);
  }
  return out;
}

// ─── Additional Input Validation Helpers ──────────────────────────────────────

/**
 * Validate an email address format
 */
export function validateEmail(value: unknown, field: string): string | NextResponse {
  const email = requireString(value, field, { max: 255 });
  if (email instanceof NextResponse) return email;
  
  // RFC 5322 compliant email regex (simplified for practical use)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: `${field} must be a valid email address.` }, { status: 400 });
  }
  
  return email;
}

/**
 * Validate a phone number (supports various formats)
 */
export function validatePhone(value: unknown, field: string): string | NextResponse {
  const phone = requireString(value, field, { min: 7, max: 20 });
  if (phone instanceof NextResponse) return phone;
  
  // Remove common separators and check if remaining chars are digits
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (!/^\+?\d+$/.test(cleaned)) {
    return NextResponse.json({ error: `${field} must be a valid phone number.` }, { status: 400 });
  }
  
  return phone;
}

/**
 * Validate a UUID format
 */
export function validateUuid(value: unknown, field: string): string | NextResponse {
  const uuid = requireString(value, field);
  if (uuid instanceof NextResponse) return uuid;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return NextResponse.json({ error: `${field} must be a valid UUID.` }, { status: 400 });
  }
  
  return uuid;
}

/**
 * Validate a date string (ISO 8601 format)
 */
export function validateDate(value: unknown, field: string, options?: { min?: Date; max?: Date }): Date | NextResponse {
  const dateStr = requireString(value, field);
  if (dateStr instanceof NextResponse) return dateStr;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: `${field} must be a valid date.` }, { status: 400 });
  }
  
  if (options?.min && date < options.min) {
    return NextResponse.json({ error: `${field} must be after ${options.min.toISOString()}.` }, { status: 400 });
  }
  
  if (options?.max && date > options.max) {
    return NextResponse.json({ error: `${field} must be before ${options.max.toISOString()}.` }, { status: 400 });
  }
  
  return date;
}

/**
 * Validate a boolean value
 */
export function validateBoolean(value: unknown, field: string): boolean | NextResponse {
  if (typeof value !== 'boolean') {
    return NextResponse.json({ error: `${field} must be a boolean.` }, { status: 400 });
  }
  return value;
}

/**
 * Sanitize HTML content to prevent XSS by encoding dangerous characters.
 * Note: For rich HTML input, use a library like DOMPurify on the client
 * or a server-side sanitizer like sanitize-html.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize search query input
 */
export function validateSearchQuery(value: unknown, field: string, options?: { max?: number }): string | NextResponse {
  const query = validateOptionalString(value, field, { max: options?.max ?? 200 });
  if (query instanceof NextResponse) return query;
  if (!query) return '';
  
  // Remove potential SQL injection patterns
  const sanitized = query
    .replace(/['";\\]/g, '')
    .trim();
  
  return sanitized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: unknown,
  limit: unknown,
): { page: number; limit: number } | NextResponse {
  const safePage = validateNumber(page ?? 1, 'page', { min: 1, max: 10000, integer: true, defaultValue: 1 });
  if (safePage instanceof NextResponse) return safePage;
  
  const safeLimit = validateNumber(limit ?? 20, 'limit', { min: 1, max: 100, integer: true, defaultValue: 20 });
  if (safeLimit instanceof NextResponse) return safeLimit;
  
  return { page: safePage, limit: safeLimit };
}

/**
 * Validate file upload metadata
 */
export function validateFileMetadata(
  filename: unknown,
  mimeType: unknown,
  size: unknown,
): { filename: string; mimeType: string; size: number } | NextResponse {
  const safeFilename = requireString(filename, 'filename', { min: 1, max: 255 });
  if (safeFilename instanceof NextResponse) return safeFilename;
  
  // Sanitize filename - remove path separators and dangerous characters
  const sanitizedFilename = safeFilename
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/^\./, '');
  
  const safeMimeType = requireString(mimeType, 'mimeType', { min: 1, max: 100 });
  if (safeMimeType instanceof NextResponse) return safeMimeType;
  
  // Validate MIME type format
  if (!/^[a-z]+\/[a-z0-9.+-]+$/i.test(safeMimeType)) {
    return NextResponse.json({ error: 'mimeType must be a valid MIME type.' }, { status: 400 });
  }
  
  const safeSize = validateNumber(size, 'size', { min: 1, max: 100 * 1024 * 1024, integer: true });
  if (safeSize instanceof NextResponse) return safeSize;
  
  return { filename: sanitizedFilename, mimeType: safeMimeType, size: safeSize };
}

/**
 * Validate clinical data input (vitals, measurements)
 */
export function validateClinicalValue(
  value: unknown,
  field: string,
  options: { min: number; max: number; unit?: string },
): number | NextResponse {
  const num = validateNumber(value, field, { 
    min: options.min, 
    max: options.max,
    integer: false 
  });
  if (num instanceof NextResponse) return num;
  
  // Additional clinical validation - reject obviously wrong values
  if (num <= 0 && field.toLowerCase().includes('weight')) {
    return NextResponse.json({ error: `${field} must be a positive value.` }, { status: 400 });
  }
  
  return num;
}

/**
 * Validate medication data
 */
export function validateMedication(
  name: unknown,
  dose?: unknown,
  frequency?: unknown,
): { name: string; dose?: string; frequency?: string } | NextResponse {
  const safeName = requireString(name, 'name', { min: 1, max: 200 });
  if (safeName instanceof NextResponse) return safeName;
  
  const result: { name: string; dose?: string; frequency?: string } = { name: safeName };
  
  if (dose !== undefined && dose !== null) {
    const safeDose = validateOptionalString(dose, 'dose', { max: 100 });
    if (safeDose instanceof NextResponse) return safeDose;
    if (safeDose) result.dose = safeDose;
  }
  
  if (frequency !== undefined && frequency !== null) {
    const safeFrequency = validateOptionalString(frequency, 'frequency', { max: 100 });
    if (safeFrequency instanceof NextResponse) return safeFrequency;
    if (safeFrequency) result.frequency = safeFrequency;
  }
  
  return result;
}
