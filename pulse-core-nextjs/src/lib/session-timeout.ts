/**
 * Session Timeout & Activity Tracking
 *
 * Implements KDPA-compliant automatic session expiration after inactivity.
 * Integrates with the middleware to check timeout on every request.
 */

import type { UserSession } from '@/types';
import { auditSessionTimeout } from './audit-logging';

/**
 * Get inactivity timeout from environment (minutes)
 * Defaults to 20 minutes (hospital standard is 15–30)
 */
export function getSessionTimeoutMinutes(): number {
  const env = process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
  return env ? parseInt(env, 10) || 20 : 20;
}

/**
 * Check if a session has exceeded the inactivity timeout
 * Returns true if session is expired, false if still valid
 */
export function isSessionExpired(session: UserSession): boolean {
  const timeoutMs = getSessionTimeoutMinutes() * 60 * 1000;
  const now = Date.now();
  const inactiveMs = now - (session.lastActivityAt ?? session.issuedAt ?? now);
  return inactiveMs > timeoutMs;
}

/**
 * Get remaining session time in milliseconds before auto-logout
 * Returns 0 if expired
 */
export function getSessionRemainingMs(session: UserSession): number {
  const timeoutMs = getSessionTimeoutMinutes() * 60 * 1000;
  const now = Date.now();
  const inactiveMs = now - (session.lastActivityAt ?? session.issuedAt ?? now);
  const remaining = timeoutMs - inactiveMs;
  return Math.max(0, remaining);
}

/**
 * Update session's last activity timestamp
 * Call this after every user interaction to reset the inactivity timer
 */
export function updateSessionActivity(session: UserSession): UserSession {
  return {
    ...session,
    lastActivityAt: Date.now(),
  };
}

/**
 * Format session timeout for client display
 * e.g., "15 minutes", "2 hours"
 */
export function formatSessionTimeout(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Log session timeout event (KDPA audit trail)
 */
export async function logSessionTimeoutEvent(
  session: UserSession,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  const _timeoutMinutes = getSessionTimeoutMinutes();
  const inactiveMinutes = Math.round((Date.now() - (session.lastActivityAt ?? session.issuedAt ?? 0)) / 60000);
  
  await auditSessionTimeout(
    session.id,
    session.role,
    session.hospitalId,
    inactiveMinutes,
    ipAddress,
    userAgent,
  );
}
