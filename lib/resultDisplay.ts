// ---------------------------------------------------------------------------
// lib/resultDisplay.ts
// What the scan-result screen SHOWS for a product, in the app language.
// Pure (unit-tested in scripts/testArabicResult.ts; used by HomeScreen).
//
// Arabic: product name, brand and variant use the name translator
// (brands are written in Arabic letters); ingredients, Contains and
// May contain use the food-label translator.
// English: the original values, unchanged.
//
// The ORIGINAL English values are never changed: searching, screening,
// saving to the Avoid List, submissions and matching keep using them.
// ---------------------------------------------------------------------------

import { cleanTagText } from "./text";
import { ITEM_SEPARATORS, splitTopLevel } from "./screening";

export type Tr = (text: string) => string;

export type ResultSource = {
  productName: string;
  brandName: string;
  variant: string;
  ingredients: string;
  contains: string;
  mayContain: string;
};

export type ResultDisplay = {
  productName: string;
  brandName: string;
  variant: string;
  ingredients: string[];
  contains: string[];
  mayContain: string[];
};

// Splits a Contains / May contain value into clean items.
export function splitLabelItems(value: string): string[] {
  return cleanTagText(value ?? "")
    .split(/\s*[,;،]+\s*/)
    .map((item) => item.replace(/[.]+$/, "").trim())
    .filter(Boolean);
}

// Every text that needs translating, by translator.
export function resultTextsToTranslate(source: ResultSource): {
  names: string[];
  labels: string[];
} {
  return {
    names: [source.productName, source.brandName, source.variant]
      .map((value) => (value ?? "").trim())
      .filter(Boolean),
    labels: [
      ...splitTopLevel(source.ingredients ?? "", ITEM_SEPARATORS),
      ...splitLabelItems(source.contains),
      ...splitLabelItems(source.mayContain),
    ],
  };
}

export function localizedResult(
  source: ResultSource,
  trName: Tr,
  trLabel: Tr
): ResultDisplay {
  const name = (value: string) => (value?.trim() ? trName(value.trim()) : "");

  return {
    productName: name(source.productName),
    brandName: name(source.brandName),
    variant: name(source.variant),
    ingredients: splitTopLevel(source.ingredients ?? "", ITEM_SEPARATORS).map(trLabel),
    contains: splitLabelItems(source.contains).map(trLabel),
    mayContain: splitLabelItems(source.mayContain).map(trLabel),
  };
}
