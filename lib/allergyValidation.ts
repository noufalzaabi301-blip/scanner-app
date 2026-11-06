// ---------------------------------------------------------------------------
// lib/allergyValidation.ts
// Validates a custom allergy typed in Preferences BEFORE it is added.
//
// Why: custom allergies are matched against product labels by the
// screening engine. Random words, numbers, sentences or test text would
// create false warnings (or hide real ones), so only short food names are
// accepted. Real foods outside the standard list (Coconut, Mustard, Lupin,
// Kiwi, Strawberry, Corn, Sugar, Celery, Garlic, …) stay allowed, in
// English or Arabic.
//
// Pure function (no React Native imports) so it can be unit-tested.
// ---------------------------------------------------------------------------

import { allergyEnglishName, findAllergyOption } from "./constants";
import type { TranslationKey } from "./i18n/translate";

export const MIN_ALLERGY_LENGTH = 2;
export const MAX_ALLERGY_LENGTH = 40;
// Longer than this is a sentence, not an allergen name.
const MAX_ALLERGY_WORDS = 4;

// Letters (any language, incl. Arabic and accents), spaces, hyphens and
// apostrophes only. Must start and end with a letter.
const ALLOWED_PATTERN = /^\p{L}[\p{L}\p{M} '’-]*\p{L}$/u;

// Obvious placeholder / test values (compared lower-case, without
// apostrophes, hyphens or extra spaces).
const BLOCKED_VALUES = new Set([
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
  "تجربة",
  "اختبار",
  "مرحبا",
  "لا شيء",
  "لا يوجد",
  "لايوجد",
  "حساسية",
]);

export type AllergyValidationResult =
  | { ok: true; value: string; standardOption: string | null }
  | { ok: false; title: TranslationKey; message: TranslationKey };

function blockedKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The same allergy in any spelling or language ("Milk", "milk", "حليب",
// "egg" vs "Eggs") gives the same key.
export function allergyKey(value: string): string {
  const english = (allergyEnglishName(value) ?? value).trim().toLowerCase();
  return findAllergyOption(english)?.value.toLowerCase() ?? english;
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
  // 1. Trim, and collapse repeated inner spaces.
  const value = String(raw ?? "").trim().replace(/\s+/g, " ");

  // 2. Empty.
  if (!value) {
    return fail("prefs.enterAllergyTitle", "prefs.enterAllergyBody");
  }

  // 3–4. Length.
  if (value.length < MIN_ALLERGY_LENGTH) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooShort");
  }

  if (value.length > MAX_ALLERGY_LENGTH) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooLong");
  }

  // 5–6. Characters: rejects numbers, URLs, e-mails, emojis, code symbols
  // and punctuation such as "." "," "!" "?".
  if (/\d/.test(value)) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyNoNumbers");
  }

  if (!ALLOWED_PATTERN.test(value)) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyLettersOnly");
  }

  // 6. Long sentences.
  if (value.split(" ").length > MAX_ALLERGY_WORDS) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyTooManyWords");
  }

  // Keyboard mashing such as "aaaa" or "zzz".
  if (/(\p{L})\1\1/u.test(value.toLowerCase())) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyNotFood");
  }

  // 7. Test / placeholder values.
  if (BLOCKED_VALUES.has(blockedKey(value))) {
    return fail("prefs.invalidAllergyTitle", "prefs.allergyNotFood");
  }

  // 8–9. Duplicates (case-insensitive and across English / Arabic), and
  // standard allergies that are already ticked.
  const key = allergyKey(value);

  if (selectedStandard.some((item) => allergyKey(item) === key)) {
    return fail("prefs.alreadyAddedTitle", "prefs.alreadySelectedBody");
  }

  if (customAllergies.some((item) => allergyKey(item) === key)) {
    return fail("prefs.alreadyAddedTitle", "prefs.alreadyAddedBody");
  }

  // A standard allergy typed by hand (e.g. "egg" or "بيض") ticks the
  // standard option instead of being added as a custom one.
  const standardOption =
    findAllergyOption(allergyEnglishName(value) ?? value)?.value ?? null;

  return { ok: true, value, standardOption };
}
