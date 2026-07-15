'use client';

import { useState, useEffect } from 'react';
import {
  SupportedLanguage,
  getStoredLanguage,
  setStoredLanguage,
  detectUserLanguage,
  getTextDirection,
  translateTerm,
} from '@/lib/i18n/translations';
import { getUITranslations as getAllUITranslations, type UITranslations } from '@/lib/i18n/ui-translations';

/**
 * Hook for managing translations in React components
 */
export function useTranslations() {
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    const stored = getStoredLanguage();
    return stored === 'en' ? detectUserLanguage() : stored;
  });
  const [translations, setTranslations] = useState<UITranslations>(() => getAllUITranslations(language));
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(() => getTextDirection(language));

  useEffect(() => {
    const stored = getStoredLanguage();
    if (stored === 'en') {
      setStoredLanguage(language);
    }
  }, [language]);

  useEffect(() => {
    setTranslations(getAllUITranslations(language));
  }, [language]);

  useEffect(() => {
    const newDirection = getTextDirection(language);
    setDirection(newDirection);
    document.documentElement.dir = newDirection;
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (newLanguage: SupportedLanguage) => {
    setLanguage(newLanguage);
    setStoredLanguage(newLanguage);
  };

  const t = (key: keyof UITranslations): string => {
    return translations[key] || key;
  };

  const translate = (term: string): string => {
    return translateTerm(term, language);
  };

  return {
    language,
    direction,
    changeLanguage,
    t,
    translate,
    translations,
  };
}

/**
 * Hook for medical terminology translation
 */
export function useMedicalTranslations() {
  const { language, translate } = useTranslations();

  return {
    language,
    translate,
    // Common medical terms
    patient: translate('patient'),
    doctor: translate('doctor'),
    prescription: translate('prescription'),
    appointment: translate('appointment'),
    laboratory: translate('laboratory'),
    pharmacy: translate('pharmacy'),
    emergency: translate('emergency'),
    blood_pressure: translate('blood pressure'),
    temperature: translate('temperature'),
    diagnosis: translate('diagnosis'),
  };
}
