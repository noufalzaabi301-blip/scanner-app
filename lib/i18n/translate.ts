// ---------------------------------------------------------------------------
// lib/i18n/translate.ts
// Pure translation core (no React / React Native imports), so it can also
// be used by plain helpers and by Node test scripts.
// ---------------------------------------------------------------------------

import ar from "./ar";
import en, { type TranslationKey } from "./en";

export type Language = "en" | "ar";
export type { TranslationKey };
export type TranslationParams = Record<string, string | number>;

export type TFunction = (
  key: TranslationKey,
  params?: TranslationParams
) => string;

const dictionaries: Record<Language, Partial<Record<TranslationKey, string>>> =
  { en, ar };

// Kept at module level so non-React helpers (alerts, PDF, share text) can
// translate too. I18nProvider keeps it in sync with React state.
let currentLanguage: Language = "en";

export function getCurrentLanguage(): Language {
  return currentLanguage;
}

export function setCurrentLanguage(language: Language): void {
  currentLanguage = language;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name])
  );
}

// Translate with an explicit language. Missing Arabic → English → key.
export function translateIn(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function translate(
  key: TranslationKey,
  params?: TranslationParams
): string {
  return translateIn(currentLanguage, key, params);
}
