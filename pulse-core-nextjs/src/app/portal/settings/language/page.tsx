'use client';

import { useState } from 'react';
import { 
  Globe, Volume2, User, Check, Loader2,
  Save, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getStoredLanguage, 
  setStoredLanguage,
  getAvailableLanguages,
  type SupportedLanguage 
} from '@/lib/i18n/translations';
import { useTranslations } from '@/hooks/useTranslations';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AnnouncementCard } from '@/components/ui/AnnouncementCard';

interface UserLanguage {
  ui: SupportedLanguage;
  patient: SupportedLanguage;
  voice: SupportedLanguage;
}

const LANGUAGE_FLAGS: Partial<Record<SupportedLanguage, string>> = {
  en: '🇰🇪',
  sw: '🇰🇪',
  ki: '🇰🇪',
  luo: '🇰🇪',
  kln: '��',
  luy: '🇰🇪',
  kam: '��',
  so: '🇰🇪',
  am: '🇪🇹',
  yo: '🇳🇬',
  zu: '🇿🇦',
  ar: '�',
};

export default function LanguageSettingsPage() {
  const { language, changeLanguage, t } = useTranslations();
  const storedLanguage = getStoredLanguage();
  const languages = getAvailableLanguages();
  const [userLang, setUserLang] = useState<UserLanguage>(() => ({
    ui: storedLanguage || language,
    patient: storedLanguage || language,
    voice: storedLanguage || language,
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Save the UI language preference
    setStoredLanguage(userLang.ui);
    changeLanguage(userLang.ui);
    
    // Simulate API call for patient/voice preferences
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getLanguageName = (code: SupportedLanguage) => {
    const langInfo = languages.find(l => l.code === code);
    return langInfo ? `${LANGUAGE_FLAGS[code] ?? '🌍'} ${langInfo.nativeName}` : code;
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8 rounded-[2rem] border border-[var(--paper-warm-edge)] bg-[var(--paper-warm)] p-6 sm:p-8">
        <SectionHeader
          tone="warm"
          as="h1"
          eyebrow="Workspace · Language"
          title="Language preferences"
          description={t('choose_language')}
          actions={<Globe className="h-6 w-6 text-[var(--ember)]" aria-hidden />}
        />
      </div>

      {/* UI Language */}
      <div className="mb-6 rounded-[1.5rem] border border-content-border bg-content-bg p-6 shadow-card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <User className="w-5 h-5" />
          {t('app_language')}
        </h2>
        <p className="mb-4 text-sm text-slate">
          {t('app_language_description')}
        </p>
        
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setUserLang(prev => ({ ...prev, ui: lang.code }))}
              className={cn(
                'rounded-[1.25rem] border p-4 text-center transition-all hover:shadow-md',
                userLang.ui === lang.code 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' 
                  : 'border-content-border'
              )}
            >
              <div className="mb-1 text-2xl">{LANGUAGE_FLAGS[lang.code] ?? '🌍'}</div>
              <div className="font-medium text-ink">{lang.nativeName}</div>
              <div className="mt-1 text-xs text-slate">{lang.name} · {lang.region}</div>
              {userLang.ui === lang.code && (
                <Check className="w-5 h-5 mx-auto mt-2 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Language */}
      <div className="mb-6 rounded-[1.5rem] border border-content-border bg-content-bg p-6 shadow-card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5" />
          {t('patient_language')}
        </h2>
        <p className="mb-4 text-sm text-slate">
          {t('patient_language_description')}
        </p>
        
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setUserLang(prev => ({ ...prev, patient: lang.code }))}
              className={cn(
                'rounded-[1.25rem] border p-4 text-center transition-all hover:shadow-md',
                userLang.patient === lang.code 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' 
                  : 'border-content-border'
              )}
            >
              <div className="mb-1 text-2xl">{LANGUAGE_FLAGS[lang.code] ?? '🌍'}</div>
              <div className="font-medium text-ink">{lang.nativeName}</div>
              <div className="mt-1 text-xs text-slate">{lang.name} · {lang.region}</div>
              {userLang.patient === lang.code && (
                <Check className="w-5 h-5 mx-auto mt-2 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Language */}
      <div className="mb-6 rounded-[1.5rem] border border-content-border bg-content-bg p-6 shadow-card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5" />
          {t('voice_language')}
        </h2>
        <p className="mb-4 text-sm text-slate">
          {t('voice_language_description')}
        </p>
        
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setUserLang(prev => ({ ...prev, voice: lang.code }))}
              className={cn(
                'rounded-[1.25rem] border p-4 text-center transition-all hover:shadow-md',
                userLang.voice === lang.code 
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' 
                  : 'border-content-border'
              )}
            >
              <div className="mb-1 text-2xl">{LANGUAGE_FLAGS[lang.code] ?? '🌍'}</div>
              <div className="font-medium text-ink">{lang.nativeName}</div>
              <div className="mt-1 text-xs text-slate">{lang.name} · {lang.region}</div>
              {userLang.voice === lang.code && (
                <Check className="w-5 h-5 mx-auto mt-2 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 rounded-[1.5rem] border border-content-border bg-content-surface p-6 shadow-card">
        <h2 className="font-semibold mb-4">{t('summary')}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate">{t('app')}:</span>
            <span className="font-medium">{getLanguageName(userLang.ui)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate">{t('patient')}:</span>
            <span className="font-medium">{getLanguageName(userLang.patient)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate">{t('voice')}:</span>
            <span className="font-medium">{getLanguageName(userLang.voice)}</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-full py-3 font-medium shadow-card transition',
          saved
            ? 'bg-green-600 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700',
          isSaving && 'opacity-50'
        )}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('status_loading')}
          </>
        ) : saved ? (
          <>
            <Check className="w-5 h-5" />
            {t('status_success')}
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            {t('action_save')}
          </>
        )}
      </button>

      {/* Editorial note */}
      <AnnouncementCard
        className="mt-6"
        tone="info"
        eyebrow="Patient language"
        title="Care travels in the language people think in"
      >
        {t('patient_language_note')}
      </AnnouncementCard>
    </div>
  );
}