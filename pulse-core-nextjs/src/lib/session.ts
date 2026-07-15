/**
 * HMAC-SHA256 signed session cookie helpers (Node.js runtime only).
 * Do NOT import this in middleware.ts — Edge runtime lacks Node.js crypto.
 * Middleware has its own inline Web Crypto implementation.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { UserSession } from '@/types';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret === 'dev-secret-change-in-production-minimum-32-chars!!') {
    throw new Error('SESSION_SECRET must be set to a strong random value (min 32 chars).');
  }
  return secret;
}

/**
 * Serialise and HMAC-sign a session for cookie storage.
 * Format: base64url(json) + "." + base64url(hmac-sha256)
 * 
 * Automatically adds issuedAt and lastActivityAt timestamps if not present.
 */
export function signSession(session: UserSession): string {
  const secret = getSecret();
  const now = Date.now();
  
  // Ensure timestamps are set
  const sessionWithTimestamps: UserSession = {
    ...session,
    issuedAt: session.issuedAt ?? now,
    lastActivityAt: session.lastActivityAt ?? now,
  };
  
  const payload = Buffer.from(JSON.stringify(sessionWithTimestamps)).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Generate a cryptographically secure random token.
 * Used for demo session IDs and temporary tokens.
 */
export function generateToken(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = new Uint8Array(length);
  
  // Use Web Crypto API for secure random generation
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for Node.js
    const { randomBytes: nodeRandomBytes } = require('crypto');
    const buf = nodeRandomBytes(length);
    for (let i = 0; i < length; i++) {
      randomBytes[i] = buf[i];
    }
  }
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Verify signature and deserialise the session.
 * Returns null if the cookie is missing, malformed, or tampered.
 */
export function parseSignedSession(raw: string): UserSession | null {
  try {
    const secret = getSecret();
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const payload = raw.slice(0, dotIdx);
    const sig = raw.slice(dotIdx + 1);

    const expected = createHmac('sha256', secret).update(payload).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const aBuf = Buffer.from(sig);
    const bBuf = Buffer.from(expected);
    if (aBuf.length !== bBuf.length || !timingSafeEqual(aBuf, bBuf)) return null;

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UserSession;
  } catch {
    return null;
  }
}
