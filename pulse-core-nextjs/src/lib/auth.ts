import { cookies } from 'next/headers';
import { parseSignedSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import type { UserSession, PortalRole } from '@/types';
import { PORTALS } from '@/types';

export const SESSION_COOKIE = 'afya_session';

/**
 * Read the current user session from the afya_session cookie (server-side).
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return parseSignedSession(raw);
  } catch {
    return null;
  }
}

/**
 * Require a valid session with a specific role. Redirects if not authenticated
 * or if role doesn't match the expected portal.
 */
export async function requireRole(expectedRole: PortalRole): Promise<UserSession> {
  const session = await getSession();

  if (!session) {
    redirect(PORTALS[expectedRole].loginPath);
  }

  if (session.role !== expectedRole) {
    // User is authenticated but accessing wrong portal — redirect to theirs
    redirect(PORTALS[session.role].portalPath);
  }

  return session;
}

/**
 * If user is already logged in, redirect them to their portal.
 * Used on login pages to prevent re-login.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getSession();
  if (session?.role) {
    redirect(PORTALS[session.role].portalPath);
  }
}

/**
 * Build initials from a full name.
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

/**
 * Verify a super admin session from the afya_session cookie.
 * Redirects to login if not authenticated.
 */
export async function verifySuperAdminSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) {
    redirect('/auth/superadmin/login');
  }
  if (session.role !== 'super_admin') {
    redirect(PORTALS[session.role].portalPath);
  }
  return session;
}
