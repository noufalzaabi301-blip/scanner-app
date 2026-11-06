// ---------------------------------------------------------------------------
// lib/constants.ts
// Shared constants used across screens: brand colors, route names,
// AsyncStorage keys and the standard allergy options.
// ---------------------------------------------------------------------------

import {
  arabicToEnglishTerm,
  containsArabic,
  englishToArabicTerm,
  learnedArabicTerm,
  learnedEnglishTerm,
} from "./i18n/foodGlossary";
import { getCurrentLanguage, type TFunction } from "./i18n/translate";
import type { TranslationKey } from "./i18n/en";

// LabelLens green branding. Screens keep their own StyleSheets, but new or
// shared UI should take colors from here so the palette stays consistent.
export const COLORS = {
  // One LabelLens green everywhere (buttons, links, active states).
  primary: "#176B43",
  primaryBright: "#176B43",
  primarySoft: "#E8F5E9",
  primaryTint: "#E8F5E9",
  heading: "#17452F",
  text: "#1D3829",
  muted: "#63776B",
  subtle: "#91A0BF",
  page: "#F7F9F7",
  card: "#FFFFFF",
  border: "#E1E9E3",
  inputBorder: "#C9D8CF",
  danger: "#B42318",
  dangerSoft: "#FDECEA",
  warningSoft: "#FFF8DB",
  warningBorder: "#F4DA75",
  warningText: "#755515",
} as const;

// Route names registered in App.tsx. Using these avoids typos in navigate().
export const ROUTES = {
  Welcome: "Welcome",
  Login: "Login",
  Register: "Register",
  ForgotPassword: "ForgotPassword",
  ResetPassword: "ResetPassword",
  PrivacyNotice: "PrivacyNotice",
  Preferences: "Preferences",
  Home: "Home",
  Avoid: "Avoid",
  Profile: "Profile",
  ProfileSettings: "ProfileSettings",
  HalalAndVerification: "HalalAndVerification",
  FAQs: "FAQs",
  ContactUs: "ContactUs",
  AboutLabelLens: "AboutLabelLens",
  AdminProductSubmissions: "AdminProductSubmissions",
} as const;

// AsyncStorage keys. The "_v1" suffix lets us invalidate a stored value by
// bumping the version instead of migrating old data.
export const STORAGE_KEYS = {
  privacyNoticeAccepted: "labellens_privacy_notice_accepted_v1",
  hasOpenedBefore: "labellens_has_opened_before",

  language: "labellens_language_v1",
  themeMode: "labellens_theme_mode_v1",
  fontScale: "labellens_font_scale_v1",
  foodTranslations: "labellens_food_translations_v1",
} as const;

// Standard allergy options.
// `value` is what is stored in user_preferences.allergies and what the
// screening engine matches against, so it must stay in English.
// `labelKey` is only used to DISPLAY the option in the selected language.
export const ALLERGY_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: "Milk", labelKey: "allergy.milk" },
  { value: "Eggs", labelKey: "allergy.eggs" },
  { value: "Peanuts", labelKey: "allergy.peanuts" },
  { value: "Tree nuts", labelKey: "allergy.treeNuts" },
  { value: "Wheat", labelKey: "allergy.wheat" },
  { value: "Soy", labelKey: "allergy.soy" },
  { value: "Fish", labelKey: "allergy.fish" },
  { value: "Shellfish", labelKey: "allergy.shellfish" },
  { value: "Sesame", labelKey: "allergy.sesame" },
];

// Finds the standard option for an allergy name, tolerating singular /
// plural ("egg" → Eggs, "peanut" → Peanuts).
export function findAllergyOption(value: string) {
  const key = value.trim().toLowerCase();

  return ALLERGY_OPTIONS.find((item) => {
    const option = item.value.toLowerCase();
    return option === key || option === `${key}s` || `${option}s` === key;
  });
}

// English name of an allergy, whatever language it was typed in
// ("حليب" → "milk"). Null when an Arabic name is not known yet.
export function allergyEnglishName(value: string): string | null {
  if (!containsArabic(value)) {
    return value.trim();
  }

  return arabicToEnglishTerm(value) ?? learnedEnglishTerm(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Displays an allergy in the SELECTED language, no matter which language
// the user typed it in:
// - standard options use the translation files ("Milk" / "الحليب");
// - custom ones use the food glossary or an earlier AI translation
//   ("سكر" ↔ "Sugar"); an unknown name is shown as typed.
// The stored value is never changed (screening converts it separately).
export function allergyLabel(value: string, t: TFunction): string {
  const english = allergyEnglishName(value);
  const option = english ? findAllergyOption(english) : undefined;

  if (option) {
    return t(option.labelKey);
  }

  if (getCurrentLanguage() === "ar") {
    if (containsArabic(value)) {
      return value.trim();
    }

    return (
      englishToArabicTerm(value) ?? learnedArabicTerm(value) ?? value.trim()
    );
  }

  return english ? capitalize(english) : value.trim();
}

// Allergy names for display: translated and without duplicates
// (e.g. "Milk" and "حليب" are shown once).
export function allergyLabelList(values: string[], t: TFunction): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const value of values) {
    const label = allergyLabel(value, t);
    const key = label.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }

  return labels;
}

// Joins a list with the comma of the current language ("، " in Arabic).
export function joinList(items: string[]): string {
  return items.join(getCurrentLanguage() === "ar" ? "، " : ", ");
}

export const APP_VERSION = "1.0.0";

// Stored with each new account so we know which notice the user accepted.
export const PRIVACY_VERSION = "1.2";

// True only when the signed-in user explicitly accepted the CURRENT notice
// (saved in their Supabase auth metadata by Register or PrivacyNotice).
// Bumping PRIVACY_VERSION makes every user accept the new notice at login.
export function hasAcceptedCurrentPrivacy(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  return (
    metadata?.privacy_accepted === true &&
    metadata?.privacy_version === PRIVACY_VERSION
  );
}
export const CONTACT_EMAIL = "labellens.contact@gmail.com";
