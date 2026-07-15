/**
 * AfyaHero i18n Translation Infrastructure
 * 
 * Provides server-side and client-side translation capabilities
 * for African healthcare contexts.
 * 
 * Supported languages:
 * - English (en) - Default
 * - Swahili (sw) - East Africa
 * - Amharic (am) - Ethiopia
 * - Yoruba (yo) - Nigeria
 * - Zulu (zu) - South Africa
 * - Arabic (ar) - North Africa (RTL)
 */

export type SupportedLanguage = 'en' | 'sw' | 'ki' | 'luo' | 'kln' | 'luy' | 'kam' | 'so' | 'am' | 'yo' | 'zu' | 'ar';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  region: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', region: 'Kenya / Global' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', direction: 'ltr', region: 'Kenya / East Africa' },
  { code: 'ki', name: 'Kikuyu', nativeName: 'Gĩkũyũ', direction: 'ltr', region: 'Central Kenya' },
  { code: 'luo', name: 'Dholuo', nativeName: 'Dholuo', direction: 'ltr', region: 'Western Kenya' },
  { code: 'kln', name: 'Kalenjin', nativeName: 'Kalenjin', direction: 'ltr', region: 'Rift Valley' },
  { code: 'luy', name: 'Luhya', nativeName: 'Luluhya', direction: 'ltr', region: 'Western Kenya' },
  { code: 'kam', name: 'Kamba', nativeName: 'Kikamba', direction: 'ltr', region: 'Eastern Kenya' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', direction: 'ltr', region: 'North Eastern Kenya' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', direction: 'ltr', region: 'Ethiopia' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', direction: 'ltr', region: 'Nigeria' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', direction: 'ltr', region: 'South Africa' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', region: 'North Africa' },
];

// Medical terminology glossary - core terms that need accurate translation
export const MEDICAL_GLOSSARY: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  patient: {
    en: 'Patient',
    sw: 'Mgonjwa',
    am: 'ታካሚ',
    yo: 'Alaisan',
    zu: 'Isiguli',
    ar: 'مريض',
  },
  doctor: {
    en: 'Doctor',
    sw: 'Daktari',
    am: 'ሐኪም',
    yo: 'Dokita',
    zu: 'Udokotela',
    ar: 'طبيب',
  },
  prescription: {
    en: 'Prescription',
    sw: 'Dawa',
    am: 'መድሃኒት',
    yo: 'Oogun',
    zu: 'Umuthi',
    ar: 'وصفة طبية',
  },
  appointment: {
    en: 'Appointment',
    sw: 'Miadi',
    am: 'ቀጠሮ',
    yo: 'Ipinnu lati pade',
    zu: 'Isikhathi',
    ar: 'موعد',
  },
  laboratory: {
    en: 'Laboratory',
    sw: 'Maabara',
    am: 'ላብራቶሪ',
    yo: 'Yàrá ìwádìí',
    zu: 'Ilabhorethri',
    ar: 'مختبر',
  },
  pharmacy: {
    en: 'Pharmacy',
    sw: 'Famasia',
    am: 'ፋርማሲ',
    yo: 'Fármásì',
    zu: 'Ipharmacy',
    ar: 'صيدلية',
  },
  emergency: {
    en: 'Emergency',
    sw: 'Dharura',
    am: 'ድንገተኛ',
    yo: 'Pájáwí',
    zu: 'Isimo esiphuthumayo',
    ar: 'طوارئ',
  },
  blood_pressure: {
    en: 'Blood Pressure',
    sw: 'Shinikizo la Damu',
    am: 'የደም ግፊት',
    yo: 'Titẹ ẹjẹ',
    zu: 'Ingcindezi yegazi',
    ar: 'ضغط الدم',
  },
  temperature: {
    en: 'Temperature',
    sw: 'Halijoto',
    am: 'ሙቀት',
    yo: 'Iwọn otutu',
    zu: 'Izinga lokushisa',
    ar: 'درجة الحرارة',
  },
  diagnosis: {
    en: 'Diagnosis',
    sw: 'Uchunguzi',
    am: 'ምርመራ',
    yo: 'Ayẹwo',
    zu: 'Ukuxilongwa',
    ar: 'تشخيص',
  },
};

// Translation cache for performance
const translationCache = new Map<string, string>();

/**
 * Get language info by code
 */
export function getLanguageInfo(code: string): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Detect user's preferred language from browser
 */
export function detectUserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return 'en';

  const browserLang = navigator.language.toLowerCase();

  for (const lang of SUPPORTED_LANGUAGES) {
    if (browserLang.startsWith(lang.code)) {
      return lang.code;
    }
  }

  return 'en';
}

/**
 * Get stored language preference
 */
export function getStoredLanguage(): SupportedLanguage {
  try {
    if (typeof localStorage === 'undefined') return 'en';
    const stored = localStorage.getItem('afyahero_language');
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // localStorage not available
  }
  return 'en';
}

/**
 * Store language preference
 */
export function setStoredLanguage(code: SupportedLanguage): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('afyahero_language', code);
  } catch {
    // localStorage not available
  }
}

/**
 * Translate a single term using the medical glossary
 * Falls back to English if translation not available
 */
export function translateTerm(term: string, language: SupportedLanguage = 'en'): string {
  const key = term.toLowerCase().replace(/\s+/g, '_');
  const cacheKey = `${key}:${language}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const glossaryEntry = MEDICAL_GLOSSARY[key];
  const translation = glossaryEntry?.[language] ?? glossaryEntry?.en ?? term;

  translationCache.set(cacheKey, translation);
  return translation;
}

/**
 * Translate multiple terms at once
 */
export function translateTerms(
  terms: string[],
  language: SupportedLanguage = 'en'
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const term of terms) {
    result[term] = translateTerm(term, language);
  }
  return result;
}

/**
 * Get the text direction for a language (for RTL support)
 */
export function getTextDirection(language: SupportedLanguage): 'ltr' | 'rtl' {
  const langInfo = getLanguageInfo(language);
  return langInfo?.direction ?? 'ltr';
}

/**
 * Format a date according to locale
 */
export function formatDate(date: Date, language: SupportedLanguage = 'en'): string {
  try {
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Format a number according to locale
 */
export function formatNumber(value: number, language: SupportedLanguage = 'en'): string {
  try {
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : language).format(value);
  } catch {
    return value.toString();
  }
}

/**
 * Get all available languages for display in a selector
 */
export function getAvailableLanguages(): LanguageInfo[] {
  return SUPPORTED_LANGUAGES;
}
