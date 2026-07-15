/**
 * Supabase Auth Service Layer
 * 
 * Bridges Supabase Auth with AfyaHero's session/role system.
 * 
 * Flow:
 * 1. User logs in via Supabase Auth (email/password)
 * 2. User metadata contains: role, subrole, hospitalId, name
 * 3. We create an HMAC-signed session cookie (compatible with existing middleware)
 * 4. On logout, we revoke Supabase session AND clear cookie
 */

import { createClient } from '@supabase/supabase-js';
import { signSession } from '@/lib/session';
import type { UserSession, PortalRole } from '@/types';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Client-side Supabase Auth client */
export const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** Server-side Supabase Auth client (service role for admin operations) */
function getAuthAdmin() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side auth operations');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Valid portal roles mapped to Supabase metadata keys */
const VALID_ROLES: PortalRole[] = ['admin', 'medical', 'reception', 'lab', 'pharmacy', 'super_admin'];

/**
 * Sign in with email and password via Supabase Auth.
 * Returns a signed session cookie value on success.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ session: string; user: UserSession } | { error: string }> {
  try {
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      return { error: error?.message ?? 'Invalid email or password' };
    }

    // Extract role from user metadata
    const metadata = data.user.user_metadata;
    const role = metadata?.role as PortalRole | undefined;

    if (!role || !VALID_ROLES.includes(role)) {
      return { error: 'Account not assigned to any portal. Contact your administrator.' };
    }

    // Build AfyaHero session from Supabase user
    const userSession: UserSession = {
      id: data.user.id,
      name: metadata?.name ?? data.user.email?.split('@')[0] ?? 'User',
      email: data.user.email ?? '',
      role,
      subrole: metadata?.subrole ?? undefined,
      title: (metadata?.title as string) ?? '',
      hospitalId: metadata?.hospitalId ?? 'unknown',
      hospitalName: (metadata?.hospitalName as string) ?? '',
      issuedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const signedSession = signSession(userSession);

    logger.info('User signed in via Supabase Auth', {
      userId: data.user.id,
      role,
      hospitalId: userSession.hospitalId,
    });

    return { session: signedSession, user: userSession };
  } catch (err) {
    logger.error('Supabase sign-in failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: 'Authentication service unavailable' };
  }
}

/**
 * Sign up a new user (admin-only operation).
 * Creates Supabase Auth user with role metadata.
 */
export async function signUpUser(params: {
  email: string;
  password: string;
  name: string;
  role: PortalRole;
  subrole?: string;
  hospitalId: string;
  permissions?: string[];
}): Promise<{ success: boolean; userId?: string } | { error: string }> {
  try {
    const authAdmin = getAuthAdmin();

    const { data, error } = await authAdmin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true, // Auto-confirm (change to false for email verification flow)
      user_metadata: {
        name: params.name,
        role: params.role,
        subrole: params.subrole,
        hospitalId: params.hospitalId,
        permissions: params.permissions ?? [],
      },
    });

    if (error || !data.user) {
      return { error: error?.message ?? 'Failed to create user' };
    }

    logger.info('New user created via Supabase Auth', {
      userId: data.user.id,
      email: params.email,
      role: params.role,
      hospitalId: params.hospitalId,
    });

    return { success: true, userId: data.user.id };
  } catch (err) {
    logger.error('Supabase sign-up failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: 'User registration service unavailable' };
  }
}

/**
 * Request password reset email via Supabase Auth.
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean } | { error: string }> {
  try {
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/reset-password`,
    });

    if (error) {
      // Always return success to prevent email enumeration
      logger.warn('Password reset requested for non-existent email', { email });
      return { success: true };
    }

    logger.info('Password reset email sent', { email });
    return { success: true };
  } catch (err) {
    logger.error('Password reset request failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: 'Password reset service unavailable' };
  }
}

/**
 * Update user password (after reset token verification).
 */
export async function updatePassword(newPassword: string, _accessToken: string): Promise<{ success: boolean } | { error: string }> {
  try {
    const { error } = await authClient.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    logger.info('User password updated via Supabase Auth');
    return { success: true };
  } catch (err) {
    logger.error('Password update failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: 'Password update service unavailable' };
  }
}

/**
 * Sign out — revoke Supabase session.
 * Caller is responsible for clearing the afya_session cookie.
 */
export async function signOut(): Promise<void> {
  try {
    await authClient.auth.signOut();
    logger.info('User signed out from Supabase Auth');
  } catch (err) {
    logger.error('Supabase sign-out failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get current Supabase Auth session (client-side).
 */
export async function getSupabaseSession() {
  const { data } = await authClient.auth.getSession();
  return data.session;
}

/**
 * Verify a Supabase access token and return user metadata.
 * Used by API routes that receive Bearer tokens instead of cookies.
 */
export async function verifySupabaseToken(token: string) {
  try {
    const authAdmin = getAuthAdmin();
    const { data, error } = await authAdmin.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    const metadata = data.user.user_metadata;
    const role = metadata?.role as PortalRole | undefined;

    if (!role || !VALID_ROLES.includes(role)) {
      return null;
    }

    return {
      id: data.user.id,
      name: metadata?.name ?? data.user.email?.split('@')[0] ?? 'User',
      email: data.user.email ?? '',
      role,
      subrole: metadata?.subrole ?? undefined,
      title: (metadata?.title as string) ?? '',
      hospitalId: metadata?.hospitalId ?? 'unknown',
      hospitalName: (metadata?.hospitalName as string) ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Exchange a Supabase Auth session for an AfyaHero signed session cookie.
 * Used by the login API route after Supabase auth succeeds.
 */
export function exchangeForAfyaSession(supabaseUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): { session: string; user: UserSession } | { error: string } {
  const metadata = supabaseUser.user_metadata ?? {};
  const role = metadata?.role as PortalRole | undefined;

  if (!role || !VALID_ROLES.includes(role)) {
    return { error: 'Account not assigned to any portal' };
  }

  const userSession: UserSession = {
    id: supabaseUser.id,
    name: (metadata?.name as string) ?? supabaseUser.email?.split('@')[0] ?? 'User',
    email: supabaseUser.email ?? '',
    role,
    subrole: metadata?.subrole as string | undefined,
    title: (metadata?.title as string) ?? '',
    hospitalId: (metadata?.hospitalId as string) ?? 'unknown',
    hospitalName: (metadata?.hospitalName as string) ?? '',
    issuedAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  return { session: signSession(userSession), user: userSession };
}
