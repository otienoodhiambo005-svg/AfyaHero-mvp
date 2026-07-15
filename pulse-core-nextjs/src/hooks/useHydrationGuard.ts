'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Prevents Next.js 14 hydration mismatches and React Strict Mode double render issues
 * Fixes patient data disappearing and state resets on login
 */
export function useHydrationGuard() {
  const [isHydrated, setIsHydrated] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Only run once, even with Strict Mode double rendering
    if (!mountedRef.current) {
      mountedRef.current = true;
      
      // Wait for next tick to ensure hydration is complete
      requestAnimationFrame(() => {
        setIsHydrated(true);
      });
    }

    return () => {
      // Do NOT reset mountedRef - this prevents Strict Mode unmount/remount cycle
    };
  }, []);

  return isHydrated;
}

/**
 * State guard that persists through hydration and double renders
 * Use this for critical patient data that must not disappear
 */
export function usePersistentState<T>(initialValue: T): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initialValue);
  const [hydratedState, setHydratedState] = useState<T | null>(null);
  const isHydrated = useHydrationGuard();

  const setPersistentState = (newValue: T) => {
    setState(newValue);
    if (isHydrated) {
      setHydratedState(newValue);
    }
  };

  // Sync state to hydratedState once hydration is complete
  useEffect(() => {
    if (isHydrated && hydratedState === null) {
      // Defer setState to avoid synchronous setState in effect
      setTimeout(() => setHydratedState(state), 0);
    }
  }, [isHydrated, hydratedState, state]);

  // Return hydrated state during hydration, current state after
  return [hydratedState !== null ? hydratedState : state, setPersistentState];
}