import en from './en.json';

const translations: Record<string, Record<string, unknown>> = { en };

let currentLanguage = 'en';

/**
 * Get a nested translation value using dot notation.
 * Example: t('solve.loading.reading') → "Reading problem..."
 */
export function t(key: string): string {
  const lang = translations[currentLanguage] || translations.en;
  const keys = key.split('.');
  let value: unknown = lang;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      // Fallback to English
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[fallbackKey];
        } else {
          return key; // Return key as fallback
        }
      }
      break;
    }
  }

  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return key;
}

/**
 * Get a translation array (e.g., suggestion lists).
 */
export function tArray(key: string): string[] {
  const lang = translations[currentLanguage] || translations.en;
  const keys = key.split('.');
  let value: unknown = lang;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

/**
 * Set the current language.
 */
export function setLanguage(lang: string) {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

/**
 * Get the current language.
 */
export function getLanguage(): string {
  return currentLanguage;
}

/**
 * React hook for translations (simple re-export for component use).
 */
export function useTranslation() {
  return { t, tArray, setLanguage, getLanguage, currentLanguage };
}
