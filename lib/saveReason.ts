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

import { allergyLabel } from "./constants";
import { localizeSourceLabel } from "./i18n/screeningText";
import type { TFunction } from "./i18n/translate";
import type { Finding } from "./screening";

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
  return parseSaveReason(value).flatMap((reason) =>
    [reason.kind === "allergy" ? "" : reason.subject, reason.statement].filter(Boolean)
  );
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
