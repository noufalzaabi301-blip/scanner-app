// ---------------------------------------------------------------------------
// scripts/testArabicResult.ts
// Arabic scan-result display: every visible field is shown in Arabic and
// the original English values stay unchanged for screening / saving.
// Run with:  npx tsx scripts/testArabicResult.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";

import { glossaryTranslate } from "../lib/i18n/foodGlossary";
import { localizeScreeningText } from "../lib/i18n/screeningText";
import { setCurrentLanguage, translateIn } from "../lib/i18n/translate";
import { localizedResult, resultTextsToTranslate } from "../lib/resultDisplay";
import { screenProduct } from "../lib/screening";

let passed = 0;
let failed = 0;

function test(name: string, run: () => void) {
  try {
    run();
    passed++;
  } catch (error: any) {
    failed++;
    console.error(`FAIL ${name}: ${error?.message}`);
  }
}

const ARABIC = /[؀-ۿ]/;

const source = {
  productName: "Chocolate Biscuits",
  brandName: "Snap Foods",
  variant: "Original",
  ingredients: "Wheat flour, sugar, milk powder, water",
  contains: "Milk, Wheat",
  mayContain: "Nuts",
};
const original = JSON.parse(JSON.stringify(source));

// Name translator as returned by the translate-food-text function (kind
// "name"): brand written in Arabic letters, descriptive words translated.
const names: Record<string, string> = {
  "Chocolate Biscuits": "بسكويت بالشوكولاتة",
  "Snap Foods": "سناب فودز",
  Original: "الأصلي",
};
const trName = (text: string) => names[text] ?? text;
const trLabel = (text: string) => glossaryTranslate(text).text;

test("all name fields are sent to the name translator", () => {
  const texts = resultTextsToTranslate(source);
  assert.deepEqual(texts.names, ["Chocolate Biscuits", "Snap Foods", "Original"]);
  assert.ok(texts.labels.includes("milk powder"));
  assert.ok(texts.labels.includes("Nuts"));
});

test("Arabic: product name, brand and variant are Arabic", () => {
  const shown = localizedResult(source, trName, trLabel);
  assert.equal(shown.productName, "بسكويت بالشوكولاتة");
  assert.equal(shown.brandName, "سناب فودز");
  assert.equal(shown.variant, "الأصلي");
});

test("Arabic: ingredients, Contains and May contain are Arabic", () => {
  const shown = localizedResult(source, trName, trLabel);
  for (const item of [...shown.ingredients, ...shown.contains, ...shown.mayContain]) {
    assert.ok(ARABIC.test(item), `not Arabic: ${item}`);
  }
  assert.ok(shown.ingredients.includes("ماء"));
  assert.ok(shown.contains.includes("حليب"));
});

test("original English values are unchanged (used for screening / saving)", () => {
  localizedResult(source, trName, trLabel);
  assert.deepEqual(source, original);
});

test("English: everything is shown exactly as stored", () => {
  const same = (text: string) => text;
  const shown = localizedResult(source, same, same);
  assert.equal(shown.productName, "Chocolate Biscuits");
  assert.equal(shown.brandName, "Snap Foods");
  assert.deepEqual(shown.contains, ["Milk", "Wheat"]);
});

test("screening runs on the English text and finds Milk", () => {
  const result = screenProduct({
    ...source,
    allergies: ["Milk"],
    prefersHalal: false,
  } as any);
  assert.equal(result.allergy.level === "clear", false);
});

test("Arabic: warnings and status sentences are translated", () => {
  setCurrentLanguage("ar");
  const t = (key: any, params?: any) => translateIn("ar", key, params);
  const result = screenProduct({ ...source, allergies: ["Milk"], prefersHalal: true } as any);
  const texts = [
    result.allergy.status,
    result.allergy.explanation,
    ...result.allergy.findings.map((finding) => finding.headline),
    result.halal?.status ?? "",
  ].filter(Boolean);
  for (const text of texts) {
    const shown = localizeScreeningText(text, t as any, "ar");
    assert.ok(ARABIC.test(shown), `warning not translated: ${text} -> ${shown}`);
  }
  setCurrentLanguage("en");
});

test("Arabic: result buttons and labels exist in Arabic", () => {
  for (const key of [
    "home.addToAvoid",
    "home.scanAnother",
    "home.contains",
    "home.mayContain",
    "home.ingredients",
    "home.allergyScreening",
    "home.halalScreening",
    "home.variantLine",
  ]) {
    const text = translateIn("ar", key as any, { variant: "x" });
    assert.ok(ARABIC.test(text), `${key} is not Arabic: ${text}`);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
