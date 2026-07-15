'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_AI_CONSENT_MODE, normalizeAIConsentMode, type AIConsentMode } from '@/lib/ai-policy';

interface AIConsentContextValue {
  consentMode: AIConsentMode;
  setConsentMode: (mode: AIConsentMode) => void;
  isConsentPending: boolean;
  allowsExternalAI: boolean;
}

const STORAGE_KEY = 'ai-consent-mode';

const AIConsentContext = createContext<AIConsentContextValue | undefined>(undefined);

export function AIConsentProvider({ children }: { children: ReactNode }) {
  const [consentMode, setConsentModeState] = useState<AIConsentMode>(DEFAULT_AI_CONSENT_MODE);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    // Defer setState to avoid synchronous setState in effect
    setTimeout(() => setConsentModeState(normalizeAIConsentMode(storedValue)), 0);
  }, []);

  const setConsentMode = (mode: AIConsentMode) => {
    setConsentModeState(mode);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  };

  const value = useMemo(
    () => ({
      consentMode,
      setConsentMode,
      isConsentPending: consentMode === 'pending',
      allowsExternalAI: consentMode === 'external_anonymized',
    }),
    [consentMode]
  );

  return <AIConsentContext.Provider value={value}>{children}</AIConsentContext.Provider>;
}

export function useAIConsent(): AIConsentContextValue {
  const context = useContext(AIConsentContext);

  if (!context) {
    throw new Error('useAIConsent must be used within an AIConsentProvider');
  }

  return context;
}