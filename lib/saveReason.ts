// ---------------------------------------------------------------------------
// lib/saveReason.ts
// "Reason saved" for Avoid List products.
//
// STORED (avoid_list.save_reason, always English so it can be searched and
// parsed later), one segment per finding, joined with "; ":
//   Matched your allergy profile: Water — Ingredients: "water"
//   Halal concern: gelatin — Ingredients: "gelatin"
//   Requires halal verification: E471 — Ingredients: "emulsifier (E471)"
// The part after "—" names WHERE the match came from: Ingredients,
// Contains, May contain, Product name or Brand, and the exact label text.
//
// SHOWN (text share, PDF, details), in the app language:
//   Reason saved: Matched your allergy profile: Water (found in Ingredients: "water")
//   سبب الحفظ: تطابق مع ملف الحساسية: ماء (وُجد في المكونات: «ماء»)
//
// The reason is ALWAYS its own field. It is never merged into "Contains":
// Contains / May contain show only what the product label itself lists.
//
// Older rows saved before this format ("Allergen detected: Milk — …",
// "May contain: Nuts — …", "Possible Milk source (whey) — …") are parsed
// too, so every saved product gets an explicit reason.
//
// Pure module (no React Native imports) so it can be unit-tested.
// ---------------------------------------------------------------------------

import { allergyLabel, findAllergyOption } from "./constants";
import { localizeSourceLabel } from "./i18n/screeningText";
import type { TFunction } from "./i18n/translate";
import { allergyGroup, type Finding } from "./screening";

export type ReasonKind = "allergy" | "halal-concern" | "halal-verify" | "other";

export type SavedReason = {
  kind: ReasonKind;
  subject: string; // allergy name, or the halal term
  source: string; // Ingredients | Contains | May contain | Product name | Brand | ""
  statement: string; // exact label text, or "" when unknown
};

export const REASON_SOURCES = [
  "Ingredients",
  "Contains",
  "May contain",
  "Product name",
  "Brand",
] as const;

const SEGMENT = new RegExp(
  `^(.+?) — (${REASON_SOURCES.join("|")}): "(.*)"$`
);

const SAVED_BY_USER = "Saved by the user.";

// ----- Building (stored English text) ---------------------------------------

function halalTerm(headline: string): string {
  return /\(([^)]+)\)\s*$/.exec(headline)?.[1]?.trim() ?? headline.trim();
}

// One stored segment for one screening finding.
export function reasonSegment(finding: Finding): string {
  const source = String(finding.sourceLabel ?? "");
  const statement = String(finding.statement ?? "").replace(/"/g, "'");
  let headline: string;

  if (finding.allergen && finding.allergen !== "Halal") {
    headline = `Matched your allergy profile: ${finding.allergen.trim()}`;
  } else if (/^Halal-related concern/i.test(finding.headline)) {
    headline = `Halal concern: ${halalTerm(finding.headline)}`;
  } else if (/^Requires halal verification/i.test(finding.headline)) {
    headline = `Requires halal verification: ${halalTerm(finding.headline)}`;
  } else {
    headline = finding.headline.trim();
  }

  return `${headline} — ${source}: "${statement}"`;
}

// The complete save_reason for a product (all allergy and halal findings,
// without duplicates). With no findings the user saved it by choice.
export function buildSaveReason(findings: Finding[]): string {
  const segments = [...new Set(findings.map(reasonSegment))];
  return segments.length > 0 ? segments.join("; ") : SAVED_BY_USER;
}

// ----- Parsing (new and older formats) --------------------------------------

function parseHeadline(headline: string): { kind: ReasonKind; subject: string } {
  const text = headline.trim();
  let match: RegExpExecArray | null;

  if ((match = /^Matched your allergy profile:\s*(.+)$/i.exec(text))) {
    return { kind: "allergy", subject: match[1].trim() };
  }

  if ((match = /^Halal concern:\s*(.+)$/i.exec(text))) {
    return { kind: "halal-concern", subject: match[1].trim() };
  }

  if ((match = /^Requires halal verification:\s*(.+)$/i.exec(text))) {
    return { kind: "halal-verify", subject: match[1].trim() };
  }

  // Older formats written by lib/screening.ts headlines.
  if ((match = /^Allergen detected:\s*(.+)$/i.exec(text))) {
    return { kind: "allergy", subject: match[1].trim() };
  }

  if ((match = /^May contain:\s*(.+)$/i.exec(text))) {
    return { kind: "allergy", subject: match[1].trim() };
  }

  if ((match = /^Possible (.+?) source \(.+\)$/i.exec(text))) {
    return { kind: "allergy", subject: match[1].trim() };
  }

  if ((match = /^(.+?) mentioned in (product name|brand)$/i.exec(text))) {
    return { kind: "allergy", subject: match[1].trim() };
  }

  if ((match = /^Halal-related concern \((.+)\)$/i.exec(text))) {
    return { kind: "halal-concern", subject: match[1].trim() };
  }

  if ((match = /^Requires halal verification \((.+)\)$/i.exec(text))) {
    return { kind: "halal-verify", subject: match[1].trim() };
  }

  return { kind: "other", subject: text };
}

export function parseSaveReason(value: string | null | undefined): SavedReason[] {
  const text = String(value ?? "").trim();

  if (!text) {
    return [];
  }

  return text
    .split("; ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = SEGMENT.exec(segment);

      if (!match) {
        return { ...parseHeadline(segment), source: "", statement: "" };
      }

      return {
        ...parseHeadline(match[1]),
        source: match[2],
        statement: match[3],
      };
    });
}

// ----- Display (app language) ----------------------------------------------

type Tr = (text: string) => string;
const identity: Tr = (text) => text;

// Texts that need a food translation (Arabic display) for these reasons.
export function reasonTextsToTranslate(value: string | null | undefined): string[] {
  // Allergy names (custom ones such as "Water") and halal terms; the grouped
  // report no longer shows the raw label statements.
  return [
    ...new Set(
      parseSaveReason(value)
        .filter((reason) => reason.kind !== "other")
        .map((reason) => reason.subject.trim())
        .filter(Boolean)
    ),
  ];
}

function subjectLabel(reason: SavedReason, t: TFunction, tr: Tr): string {
  if (reason.kind === "other") {
    return reason.subject;
  }

  if (reason.kind === "allergy") {
    const label = allergyLabel(reason.subject, t);
    // Custom allergies (e.g. "Water") use the food translation when the
    // allergy dictionary has no Arabic name.
    return label === reason.subject.trim() ? tr(reason.subject) : label;
  }

  return tr(reason.subject);
}

// One readable line per reason (without the "Reason saved:" label).
// localize: translates fixed screening sentences in very old rows.
export function formatReasonLines(
  value: string | null | undefined,
  t: TFunction,
  tr: Tr = identity,
  localize: Tr = identity,
  options: { withSource?: boolean } = {}
): string[] {
  const withSource = options.withSource !== false;
  const reasons = parseSaveReason(value);

  if (reasons.length === 0 || (reasons.length === 1 && reasons[0].subject === SAVED_BY_USER)) {
    return [t("reason.savedByUser")];
  }

  return [
    ...new Set(
      reasons.map((reason) => {
        const subject = subjectLabel(reason, t, tr);
        const main =
          reason.kind === "allergy"
            ? t("reason.allergyMatch", { name: subject })
            : reason.kind === "halal-concern"
            ? t("reason.halalConcern", { term: subject })
            : reason.kind === "halal-verify"
            ? t("reason.halalVerify", { term: subject })
            : localize(reason.subject);

        if (!reason.source || !withSource) {
          return main;
        }

        const where = reason.statement
          ? t("reason.foundInWithText", {
              source: localizeSourceLabel(reason.source, t),
              text: tr(reason.statement),
            })
          : t("reason.foundIn", { source: localizeSourceLabel(reason.source, t) });

        return `${main} ${where}`;
      })
    ),
  ];
}

// "Reason saved: …" as one line (text share and PDF).
export function reasonSavedLine(
  value: string | null | undefined,
  t: TFunction,
  tr: Tr = identity,
  localize: Tr = identity
): string {
  return t("reason.savedLine", {
    value: formatReasonLines(value, t, tr, localize).join(t("reason.separator")),
  });
}

// ---------------------------------------------------------------------------
// GROUPED REPORT (text share, PDF, details)
//
// save_reason keeps every raw finding (one per matched label item) for
// debugging. The report groups them: each allergy appears ONCE, with the
// places it was found, e.g.
//   Reason saved:
//   • Matched allergies: Milk, Soy, Tree nuts
//   • Milk: found in Ingredients, Contains, and Product name
//   • Tree nuts: found in May contain
//   Halal screening:
//   • E322 requires verification
// Equivalent names are merged with the screening dictionary
// (lib/screening.ts → allergyGroup): Milk / whey / lactose / butter → Milk,
// Hazelnut / nuts → Tree nuts, Soya / soybeans → Soy.
// Ordinary ingredients (sugar, cocoa, salt) never appear: only allergies
// that matched the user's profile are stored as reasons.
// ---------------------------------------------------------------------------


export type AllergyMatch = { name: string; sources: string[] };
export type HalalMatch = { term: string; kind: "halal-concern" | "halal-verify" };

export type ReasonSummary = {
  allergies: AllergyMatch[];
  halal: HalalMatch[];
  savedByUser: boolean;
};

// Standard option for a screening group key ("tree nut" → "Tree nuts").
function standardName(groupKey: string): string | undefined {
  return groupKey.startsWith("custom:") ? undefined : findAllergyOption(groupKey)?.value;
}

function sourceRank(source: string): number {
  const index = (REASON_SOURCES as readonly string[]).indexOf(source);
  return index === -1 ? REASON_SOURCES.length : index;
}

// profileAllergies (optional): the user's saved allergy names. When given,
// each group is shown with the user's own name (e.g. "Soy beans" for soya /
// soybeans). Otherwise the standard name is used (Milk, Tree nuts, Soy …).
export function summarizeSaveReason(
  value: string | null | undefined,
  profileAllergies: string[] = []
): ReasonSummary {
  const reasons = parseSaveReason(value);
  const profileName = new Map<string, string>();

  for (const allergy of profileAllergies) {
    const key = allergyGroup(allergy).key;
    if (!profileName.has(key)) {
      profileName.set(key, allergy.trim());
    }
  }
  const groups = new Map<string, { names: { name: string; isAlias: boolean }[]; sources: Set<string> }>();
  const halal = new Map<string, HalalMatch>();

  for (const reason of reasons) {
    if (reason.kind === "allergy") {
      const group = allergyGroup(reason.subject);
      const entry = groups.get(group.key) ?? { names: [], sources: new Set<string>() };
      entry.names.push({ name: reason.subject.trim(), isAlias: group.isAlias });
      if (reason.source) {
        entry.sources.add(reason.source);
      }
      groups.set(group.key, entry);
    } else if (reason.kind === "halal-concern" || reason.kind === "halal-verify") {
      const key = reason.subject.trim().toLowerCase();
      const existing = halal.get(key);
      // A concern is stronger than "requires verification".
      if (!existing || (existing.kind === "halal-verify" && reason.kind === "halal-concern")) {
        halal.set(key, { term: reason.subject.trim(), kind: reason.kind });
      }
    }
  }

  const allergies = [...groups.entries()].map(([key, entry]) => ({
    // 1. the user's allergy name from their profile (e.g. "Soy beans");
    // 2. a standard allergy name stored with the match ("Milk");
    // 3. the allergy name stored with the match (always the user's own
    //    name at the time it was saved, e.g. "Wheat flour");
    // 4. the standard name of the group, if somehow none was stored.
    name:
      profileName.get(key) ??
      entry.names.find((item) => findAllergyOption(item.name))?.name ??
      entry.names.find((item) => item.name)?.name ??
      standardName(key) ??
      "",
    sources: [...entry.sources].sort((a, b) => sourceRank(a) - sourceRank(b)),
  }));

  return {
    allergies,
    halal: [...halal.values()],
    savedByUser:
      reasons.length === 0 || reasons.every((reason) => reason.kind === "other"),
  };
}

// "A, B, and C" / "A و B" in the current language.
export function joinWithAnd(items: string[], t: TFunction): string {
  if (items.length <= 1) {
    return items.join("");
  }

  if (items.length === 2) {
    return t("reason.listTwo", { a: items[0], b: items[1] });
  }

  return t("reason.listMany", {
    list: items.slice(0, -1).join(t("reason.listComma")),
    last: items[items.length - 1],
  });
}

// "Contains" / "May contain" are label field names; Arabic quotes them
// («يحتوي على») so the sentence stays clear.
function sourceName(source: string, t: TFunction): string {
  const label = localizeSourceLabel(source, t);
  return source === "Contains" || source === "May contain"
    ? t("reason.labelField", { source: label })
    : label;
}

// E-numbers in capitals ("e322" → "E322"); other terms as stored.
function displayHalalTerm(term: string, tr: Tr): string {
  const clean = term.trim();
  return /^e\s?\d{3,4}[a-z]?$/i.test(clean)
    ? clean.replace(/\s/g, "").toUpperCase().replace(/([A-Z])$/, (m) => m.toLowerCase())
    : tr(clean);
}

function displayAllergy(name: string, t: TFunction, tr: Tr): string {
  const label = allergyLabel(name, t);
  return label === name.trim() ? tr(name) : label;
}

export type ReasonReport = {
  reasonBullets: string[]; // under "Reason saved:"
  halalBullets: string[]; // under "Halal screening:" (may be empty)
};

export function buildReasonReport(
  value: string | null | undefined,
  t: TFunction,
  tr: Tr = identity,
  profileAllergies: string[] = []
): ReasonReport {
  const summary = summarizeSaveReason(value, profileAllergies);
  const reasonBullets: string[] = [];

  if (summary.allergies.length === 0) {
    reasonBullets.push(t("reason.noAllergyMatch"));
  } else {
    const names = summary.allergies.map((item) => displayAllergy(item.name, t, tr));

    reasonBullets.push(
      t("reason.matchedAllergies", { list: names.join(t("reason.listComma")) })
    );

    summary.allergies.forEach((item, index) => {
      if (item.sources.length > 0) {
        reasonBullets.push(
          t("reason.allergyFoundIn", {
            name: names[index],
            sources: joinWithAnd(item.sources.map((source) => sourceName(source, t)), t),
          })
        );
      }
    });
  }

  const halalBullets = summary.halal.map((item) =>
    item.kind === "halal-concern"
      ? t("reason.halalConcernShort", { term: displayHalalTerm(item.term, tr) })
      : t("reason.halalVerifyShort", { term: displayHalalTerm(item.term, tr) })
  );

  return {
    reasonBullets: [...new Set(reasonBullets)],
    halalBullets: [...new Set(halalBullets)],
  };
}

// Full raw findings (one line per stored segment) — for debugging only;
// not shown in the normal report.
export function rawReasonDetails(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split("; ")
    .map((segment) => segment.trim())
    .filter(Boolean);
}
