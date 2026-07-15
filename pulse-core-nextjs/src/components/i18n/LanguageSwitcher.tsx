'use client';

import { useState, useEffect } from 'react';
import { Languages, Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SupportedLanguage,
  getStoredLanguage,
  setStoredLanguage,
  getAvailableLanguages,
  detectUserLanguage,
  getTextDirection,
} from '@/lib/i18n/translations';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'inline';
  onLanguageChange?: (language: SupportedLanguage) => void;
}

export default function LanguageSwitcher({
  className,
  variant = 'dropdown',
  onLanguageChange,
}: LanguageSwitcherProps) {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(() => {
    const stored = getStoredLanguage();
    return stored === 'en' ? detectUserLanguage() : stored;
  });
  const [isOpen, setIsOpen] = useState(false);
  const languages = getAvailableLanguages();

  useEffect(() => {
    // Persist the detected language only when no explicit preference existed.
    const stored = getStoredLanguage();
    if (stored === 'en') {
      setStoredLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  useEffect(() => {
    // Apply text direction to document
    const direction = getTextDirection(currentLanguage);
    document.documentElement.dir = direction;
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const handleLanguageSelect = (code: SupportedLanguage) => {
    setCurrentLanguage(code);
    setStoredLanguage(code);
    setIsOpen(false);
    onLanguageChange?.(code);
  };

  const currentLangInfo = languages.find((l) => l.code === currentLanguage);

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Globe className="w-4 h-4 text-slate-500" />
        <select
          value={currentLanguage}
          onChange={(e) => handleLanguageSelect(e.target.value as SupportedLanguage)}
          className="text-sm bg-transparent border border-slate-300 rounded-md px-2 py-1"
          aria-label="Select language"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <Languages className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLangInfo?.nativeName ?? 'English'}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Language
              </p>
            </div>
            <div className="py-2">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                    currentLanguage === lang.code && 'bg-slate-50 dark:bg-slate-700'
                  )}
                >
                  <div className="flex-1 text-left">
                    <p className="font-medium">{lang.nativeName}</p>
                    <p className="text-xs text-slate-500">{lang.name} — {lang.region}</p>
                  </div>
                  {currentLanguage === lang.code && (
                    <Check className="w-4 h-4 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
