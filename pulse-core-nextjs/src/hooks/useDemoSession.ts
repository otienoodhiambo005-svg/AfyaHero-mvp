/**
 * useDemoSession — client-side hook for demo-aware UI.
 *
 * Reads the current session from `/api/auth/session` (which already returns
 * the parsed cookie session). Returns demo flags and time-remaining helpers
 * so individual screens can disable destructive CTAs and surface "switch to
 * live account" calls-to-action.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserSession } from '@/types';

const DEMO_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface DemoSessionState {
  /** True while the session payload is being fetched. */
  loading: boolean;
  /** The current session, if any. */
  session: UserSession | null;
  /** True when `session.demo === true`. */
  isDemo: boolean;
  /** ISO timestamp when the demo expires, or null if not a demo. */
  expiresAt: string | null;
  /** Milliseconds until expiry. Negative if already expired. Null when not demo. */
  msRemaining: number | null;
}

let sessionCache: { value: UserSession | null; fetchedAt: number } | null = null;
const CACHE_MS = 30_000;

async function fetchSession(): Promise<UserSession | null> {
  if (sessionCache && Date.now() - sessionCache.fetchedAt < CACHE_MS) {
    return sessionCache.value;
  }
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) {
      sessionCache = { value: null, fetchedAt: Date.now() };
      return null;
    }
    const json = (await res.json()) as { session: UserSession | null };
    sessionCache = { value: json.session ?? null, fetchedAt: Date.now() };
    return sessionCache.value;
  } catch {
    sessionCache = { value: null, fetchedAt: Date.now() };
    return null;
  }
}

/**
 * Reset the cached session (call after login/logout flows).
 */
export function resetDemoSessionCache(): void {
  sessionCache = null;
}

export function useDemoSession(): DemoSessionState {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchSession().then((s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live-update the time remaining each second so callers can render a counter.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!session?.demo) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [session?.demo]);

  const nowRef = useRef<number>(0);

  const result = useMemo<DemoSessionState>(() => {
    if (!session?.demo) {
      return {
        loading,
        session,
        isDemo: false,
        expiresAt: null,
        msRemaining: null,
      };
    }
    const expiresAtMs = session.issuedAt + DEMO_LIFETIME_MS;
    const now = nowRef.current || Date.now();
    return {
      loading,
      session,
      isDemo: true,
      expiresAt: new Date(expiresAtMs).toISOString(),
      msRemaining: expiresAtMs - now,
    };
    // tick is intentionally included to trigger recalculations for countdown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, tick]);

  return result;
}
