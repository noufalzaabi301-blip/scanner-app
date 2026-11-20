// ---------------------------------------------------------------------------
// lib/allergyBatch.ts
// Adds several custom allergies typed at once ("Milk, Eggs, Peanuts", or
// one per line). Pure, unit-tested in scripts/testAllergyBatch.ts.
//
// Each entry is checked SEPARATELY with the existing validateCustomAllergy
// (lib/allergyValidation.ts, unchanged):
//   - valid standard allergy (e.g. "Milk", "حليب") → ticks that option
//   - valid other food (e.g. "Kiwi")                 → custom allergy
//   - already in the list / typed twice              → skipped (no error)
//   - invalid ("123", "asdf", "hello world …")       → rejected on its own,
//                                                      with its reason
// Existing allergies are never removed. Detection logic is not touched.
// ---------------------------------------------------------------------------

import type { TranslationKey } from "./i18n";
import { validateCustomAllergy } from "./allergyValidation";

// Commas (English and Arabic "،"), semicolons and new lines.
const SEPARATORS = /[,،;\n\r]+/;

export function splitAllergyInput(text: string): string[] {
  return String(text ?? "")
    .split(SEPARATORS)
    .map((item) => item.trim())
    .filter(Boolean);
}

export type RejectedAllergy = {
  value: string;
  title: TranslationKey;
  message: TranslationKey;
};

export type AllergyBatchResult = {
  selected: string[]; // standard allergies (existing + newly ticked)
  custom: string[]; // custom allergies (existing + new)
  added: string[]; // what was added, in order
  duplicates: string[]; // skipped: already present or typed twice
  rejected: RejectedAllergy[]; // invalid entries, each with its reason
};

const DUPLICATE_TITLE: TranslationKey = "prefs.alreadyAddedTitle";

export function addAllergyEntries(
  text: string,
  selected: string[],
  custom: string[]
): AllergyBatchResult {
  const result: AllergyBatchResult = {
    selected: [...selected],
    custom: [...custom],
    added: [],
    duplicates: [],
    rejected: [],
  };

  const entries = splitAllergyInput(text);

  // Nothing typed: the usual "Enter an allergy" message.
  if (entries.length === 0) {
    const empty = validateCustomAllergy("", selected, custom);
    if (!empty.ok) {
      result.rejected.push({ value: "", title: empty.title, message: empty.message });
    }
    return result;
  }

  for (const entry of entries) {
    const check = validateCustomAllergy(entry, result.selected, result.custom);

    if (!check.ok) {
      if (check.title === DUPLICATE_TITLE) {
        result.duplicates.push(entry);
      } else {
        result.rejected.push({ value: entry, title: check.title, message: check.message });
      }
      continue;
    }

    if (check.standardOption) {
      result.selected.push(check.standardOption);
      result.added.push(check.standardOption);
    } else {
      result.custom.push(check.value);
      result.added.push(check.value);
    }
  }

  return result;
}

// What stays in the field after pressing Add: only the rejected entries,
// so the user can correct them.
export function remainingInput(result: AllergyBatchResult): string {
  return result.rejected
    .map((item) => item.value)
    .filter(Boolean)
    .join(", ");
}

// Message lines for the field: each rejected entry with its own reason,
// then the skipped duplicates. "" when everything was added.
export function batchFeedback(
  result: AllergyBatchResult,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
): string {
  const lines = result.rejected.map((item) =>
    item.value
      ? t("prefs.notAddedLine", { value: item.value, reason: t(item.message) })
      : t(item.message)
  );

  if (result.duplicates.length > 0) {
    lines.push(t("prefs.duplicatesSkipped", { items: result.duplicates.join(", ") }));
  }

  return lines.join("\n");
}
