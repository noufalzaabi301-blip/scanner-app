// ---------------------------------------------------------------------------
// lib/i18n/screeningText.ts
// Displays screening results in the selected language WITHOUT changing the
// screening engine.
//
// Why a display layer: lib/screening.ts produces English sentences that are
// covered by scripts/testScreening.ts and are also stored as-is in the
// Avoid List (allergy_status / halal_status / save_reason). Changing the
// engine would break the tests and mix languages in the database, so we
// translate the known sentence patterns only when showing them.
//
// Allergy names from the standard list are translated; custom allergy
// names, matched label terms and quoted label text are left unchanged.
// Unknown text is returned exactly as it is.
// ---------------------------------------------------------------------------

import { allergyLabel } from "../constants";
import type { TFunction, TranslationKey } from "./translate";

const SOURCE_KEYS: Record<string, TranslationKey> = {
  ingredients: "source.ingredients",
  contains: "source.contains",
  "may contain": "source.mayContain",
  "product name": "source.productName",
  brand: "source.brand",
};

// "Ingredients" → "المكونات" (used for Finding.sourceLabel).
export function localizeSourceLabel(label: string, t: TFunction): string {
  const key = SOURCE_KEYS[label.trim().toLowerCase()];
  return key ? t(key) : label;
}

function names(list: string, t: TFunction): string {
  return list
    .split(/\s*,\s*/)
    .filter(Boolean)
    .map((item) => allergyLabel(item, t))
    .join("، ");
}

// Fixed sentences produced by lib/screening.ts and HomeScreen/AvoidList.
const FIXED: [string, TranslationKey][] = [
  ["No allergies in your profile", "scr.noAllergiesStatus"],
  ["Add allergies to your profile to screen products against them.", "scr.noAllergiesBody"],
  ["Insufficient information", "scr.insufficient"],
  ["There is no confirmed ingredient or allergen information to check.", "scr.insufficientBody"],
  ["There is not enough label information for halal-related screening.", "scr.insufficientHalalBody"],
  ["The label includes a precautionary \"may contain\" or traces warning related to an allergy in your profile.", "scr.mayBody"],
  ["Requires allergy verification", "scr.verifyStatus"],
  ["Some label text may relate to an allergy in your profile, but the label does not give enough detail to confirm it.", "scr.verifyBody"],
  ["No selected allergen detected", "scr.clearStatus"],
  ["No selected allergy was found in the available label text. This is not a safety guarantee — always check the physical package.", "scr.clearBody"],
  ["Halal-related concern detected", "scr.halalConcernStatus"],
  ["The label includes an ingredient that requires careful verification. This is not a halal certification decision.", "scr.halalConcernBody"],
  ["Requires verification", "scr.halalVerifyStatus"],
  ["Some ingredients can come from different sources. Check the package certification or contact the manufacturer.", "scr.halalVerifyBody"],
  ["No identified concern from available label information", "scr.halalClearStatus"],
  ["No known halal-related concern was identified in the available label text. This is not halal certification.", "scr.halalClearBody"],
  ["Screening could not be completed", "scr.failedStatus"],
  ["Your allergy profile could not be loaded. Please log in and try again, and check the physical package yourself.", "scr.failedBody"],
  ["Halal screening could not be completed", "scr.halalFailed"],
  ["Halal screening not selected", "scr.halalNotSelected"],
  ["Saved by the user.", "scr.savedByUser"],
  // Product sources (lib/productProviders.ts / HomeScreen).
  ["LabelLens verified product database", "src.labellens"],
  ["Open Food Facts — not verified", "src.off"],
  ["AI package-photo extraction", "src.ai"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Rule = [RegExp, (t: TFunction, ...groups: string[]) => string];

const PATTERNS: Rule[] = [
  [
    /Found in the ingredients or Contains statement: ([^.]+)\./g,
    (t, list) => t("scr.foundInBody", { names: names(list, t) }),
  ],
  [
    /The label also warns it may contain: ([^.]+)\./g,
    (t, list) => t("scr.alsoMayBody", { names: names(list, t) }),
  ],
  [
    /Also check: ([^.]+)\./g,
    (t, list) => t("scr.alsoCheck", { names: names(list, t) }),
  ],
  [
    /^Allergen detected: (.+)$/,
    (t, list) => t("scr.allergenDetected", { names: names(list, t) }),
  ],
  [
    /^May contain: (.+)$/,
    (t, list) => t("scr.mayContainStatus", { names: names(list, t) }),
  ],
  [
    /^Possible (.+) source \((.+)\)$/,
    (t, name, term) =>
      t("scr.possibleSource", { name: allergyLabel(name, t), term }),
  ],
  [
    /^(.+) mentioned in (ingredients|contains|may contain|product name|brand)$/,
    (t, name, source) =>
      t("scr.mentionedIn", {
        name: allergyLabel(name, t),
        source: localizeSourceLabel(source, t),
      }),
  ],
  [
    /^Halal-related concern \((.+)\)$/,
    (t, term) => t("scr.halalConcernFinding", { term }),
  ],
  [
    /^Requires halal verification \((.+)\)$/,
    (t, term) => t("scr.halalVerifyFinding", { term }),
  ],
];

// Avoid List save_reason format (HomeScreen.addToAvoidList):
//   `${headline} — ${sourceLabel}: "${statement}"`, joined with "; ".
const REASON_SEGMENT =
  /^(.+?) — (Ingredients|Contains|May contain|Product name|Brand): "(.*)"$/;

export function localizeScreeningText(
  text: string | null | undefined,
  t: TFunction,
  language: string
): string {
  const value = String(text ?? "");

  if (language === "en" || !value) {
    return value;
  }

  const segments = value.split("; ");

  if (segments.every((segment) => REASON_SEGMENT.test(segment))) {
    return segments
      .map((segment) => {
        const [, headline, source, statement] = segment.match(REASON_SEGMENT)!;
        return `${localizeScreeningText(headline, t, language)} — ${localizeSourceLabel(
          source,
          t
        )}: "${statement}"`;
      })
      .join("؛ ");
  }

  for (const [english, key] of FIXED) {
    if (value === english) {
      return t(key);
    }
  }

  let result = value;

  for (const [english, key] of FIXED) {
    result = result.replace(new RegExp(escapeRegExp(english), "g"), t(key));
  }

  for (const [pattern, render] of PATTERNS) {
    result = result.replace(pattern, (_match, ...groups) =>
      render(t, ...(groups.slice(0, -2) as string[]))
    );
  }

  return result;
}
