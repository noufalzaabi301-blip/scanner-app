// ---------------------------------------------------------------------------
// lib/allergyValidation.ts
// Validates a custom allergy typed in Preferences BEFORE it is added.
//
// Why: custom allergies are matched against product labels by the
// screening engine. Random words, numbers, sentences or test text would
// create false warnings (or hide real ones), so only RECOGNISED food or
// allergen names are accepted, in English or Arabic. The approved list is
// the bilingual dictionary in lib/i18n/foodGlossary.ts (Coconut, Mustard,
// Lupin, Kiwi, Strawberry, Corn, Sugar, Celery, Garlic, جوز الهند، خردل …).
//
// Order of checks: NFKC normalisation → trim / collapse spaces → empty →
// length → characters → word count → invalid placeholder words →
// duplicates → already-selected standard allergy → dictionary.
//
// Pure function (no React Native imports) so it can be unit-tested.
// ---------------------------------------------------------------------------

import { allergyEnglishName, findAllergyOption } from "./constants";
import {
  containsArabic,
  isRecognizedFoodTerm,
  normalizeArabic,
} from "./i18n/foodGlossary";
import type { TranslationKey } from "./i18n/translate";

export const MIN_ALLERGY_LENGTH = 2;
export const MAX_ALLERGY_LENGTH = 40;
// Longer than this is a sentence, not an allergen name.
const MAX_ALLERGY_WORDS = 4;

// English (Latin) or Arabic letters, spaces, hyphens and apostrophes only.
// Must start and end with a letter. Digits (incl. Arabic-Indic digits),
// Arabic punctuation such as "،" or "؟", emojis and symbols are rejected.
// Explicit Unicode ranges are used (instead of \p{Script=…}) so the same
// rules work on every JavaScript engine: Hermes on phones and browsers.
const LETTERS =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F" + // Latin
  "\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06FA-\u06FC"; // Arabic
const ARABIC_MARKS = "\u064B-\u0652\u0670";
const LETTER = new RegExp(`[${LETTERS}]`, "g");
const DISALLOWED_CHARACTER = new RegExp(`[^${LETTERS}${ARABIC_MARKS} '\u2019-]`);
const STARTS_AND_ENDS_WITH_LETTER = new RegExp(
  `^[${LETTERS}](?:[\\s\\S]*[${LETTERS}])?$`
);
const ANY_DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/;

// Obvious placeholder / test values (compared lower-case, without
// apostrophes, hyphens or extra spaces).
const BLOCKED_VALUES = new Set(
  [
  "test",
  "tests",
  "testing",
  "tester",
  "hello",
  "hi",
  "hey",
  "abc",
  "abcd",
  "xyz",
  "qwerty",
  "asdf",
  "anything",
  "something",
  "nothing",
  "none",
  "no",
  "yes",
  "na",
  "n a",
  "nil",
  "null",
  "undefined",
  "nan",
  "unknown",
  "allergy",
  "allergies",
  "allergen",
  "food",
  "example",
  "sample",
  "lorem",
  "ipsum",
  "lorem ipsum",
  "empty",
  "aaaa",
  // Arabic (compared after Arabic normalisation, so spelling variants
  // such as "مرحباً" or "لاشيء" also match).
  "اختبار",
  "تجريبي",
  "تجربه",
  "تجربة",
  "مرحبا",
  "لا شيء",
  "لاشيء",
  "لا يوجد",
  "لايوجد",
  "غير معروف",
  "فارغ",
  "نص",
  "أي شيء",
  "اي شيء",
  "كلام",
  "حساسيه",
  "حساسية",
  ].map((item) => blockedKey(item))
);

export type AllergyValidationResult =
  | { ok: true; value: string; standardOption: string | null }
  | { ok: false; title: TranslationKey; message: TranslationKey };

function blockedKey(value: string): string {
  const text = containsArabic(value) ? normalizeArabic(value) : value;

  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The same allergy in any spelling or language ("Milk", "milk", "حليب",
// "egg" vs "Eggs") gives the same key.
export function allergyKey(value: string): string {
  const text = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  const english =
    allergyEnglishName(text) ??
    (containsArabic(text) ? normalizeArabic(text) : text);
  const lower = english.toLowerCase();
  const option = findAllergyOption(lower);

  if (option) {
    return option.value.toLowerCase();
  }

  // "Strawberry" and "Strawberries" count as the same allergy.
  return lower.replace(/ies$/, "y").replace(/s$/, "");
}

function fail(
  title: TranslationKey,
  message: TranslationKey
): AllergyValidationResult {
  return { ok: false, title, message };
}

export function validateCustomAllergy(
  raw: string,
  selectedStandard: string[],
  customAllergies: string[]
): AllergyValidationResult {
  // 1–2. Unicode NFKC (e.g. full-width letters, Arabic presentation
  // forms), remove Arabic tatweel, trim, collapse repeated spaces.
  const value = String(raw ?? "")
    .normalize("NFKC")
    .replace(/\u0640/g, "")
    .trim()
    .replace(/\s+/g, " ");

  // 7. Empty.
  if (!value) {
    return fail("prefs.enterAllergyTitle", "prefs.enterAllergyBody");
  }

  // 9. Maximum length.
  if (value.length > MAX_ALLERGY_LENGTH) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooLong");
  }

  // 5. Numbers (Western and Arabic-Indic digits).
  if (ANY_DIGIT.test(value)) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyNoNumbers");
  }

  // 3–5. Only English / Arabic letters, spaces, "-" and "'": rejects
  // emojis, URLs, e-mails, code, punctuation and symbols.
  if (
    DISALLOWED_CHARACTER.test(value) ||
    !STARTS_AND_ENDS_WITH_LETTER.test(value)
  ) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyLettersOnly");
  }

  // 8. Minimum length (letters only).
  if ((value.match(LETTER) ?? []).length < MIN_ALLERGY_LENGTH) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooShort");
  }

  // 6. Sentences.
  if (value.split(" ").length > MAX_ALLERGY_WORDS) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooManyWords");
  }

  // 12–13. Placeholder / test values and keyboard mashing ("aaaa").
  if (
    BLOCKED_VALUES.has(blockedKey(value)) ||
    /([^\s'\u2019-])\1\1/.test(value.toLowerCase())
  ) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyNotFood");
  }

  // 10–11. Duplicates (case-insensitive, Arabic-normalised and across
  // English / Arabic), and standard allergies that are already ticked.
  const key = allergyKey(value);

  if (selectedStandard.some((item) => allergyKey(item) === key)) {
    return fail("prefs.alreadyAddedTitle", "prefs.alreadySelectedBody");
  }

  if (customAllergies.some((item) => allergyKey(item) === key)) {
    return fail("prefs.alreadyAddedTitle", "prefs.alreadyAddedBody");
  }

  // A standard allergy typed by hand (e.g. "egg" or "حليب") ticks the
  // standard option instead of being added as a custom one.
  const standardOption =
    findAllergyOption(allergyEnglishName(value) ?? value)?.value ?? null;

  if (standardOption) {
    return { ok: true, value, standardOption };
  }

  // 14. Must be a recognised food or allergen (bilingual dictionary).
  if (!isRecognizedFoodTerm(value)) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyUnknown");
  }

  return { ok: true, value, standardOption: null };
}
