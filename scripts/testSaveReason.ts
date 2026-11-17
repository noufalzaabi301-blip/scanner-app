// ---------------------------------------------------------------------------
// scripts/testSaveReason.ts
// "Reason saved" for the Avoid List (text share, PDF, details).
// Run with:  npx tsx scripts/testSaveReason.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";

import { glossaryTranslate } from "../lib/i18n/foodGlossary";
import { setCurrentLanguage, translateIn } from "../lib/i18n/translate";
import {
  buildSaveReason,
  formatReasonLines,
  parseSaveReason,
  reasonSavedLine,
} from "../lib/saveReason";
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

const tEn = (key: any, params?: any) => translateIn("en", key, params);
const tAr = (key: any, params?: any) => translateIn("ar", key, params);
const trAr = (text: string) => glossaryTranslate(text).text;

// A product whose label does NOT list "Water" under Contains.
const product = {
  productName: "Mineral Drink",
  brandName: "Demo",
  ingredients: "Water, sugar, citric acid",
  contains: "",
  mayContain: "",
};

function reasonFor(allergies: string[], prefersHalal = false, input = product) {
  const result = screenProduct({ ...input, allergies, prefersHalal });
  return buildSaveReason([
    ...result.allergy.findings,
    ...(result.halal?.findings ?? []),
  ]);
}

test("custom allergy match is stored with its source", () => {
  const stored = reasonFor(["Water"]);
  assert.match(stored, /^Matched your allergy profile: Water — Ingredients: "Water"/);
});

test("English line: Reason saved: Matched your allergy profile: Water", () => {
  setCurrentLanguage("en");
  const line = reasonSavedLine(reasonFor(["Water"]), tEn as any);
  assert.ok(
    line.startsWith("Reason saved: Matched your allergy profile: Water"),
    line
  );
  assert.ok(line.includes('(found in Ingredients: "Water")'), line);
});

test("Arabic line: سبب الحفظ: تطابق مع ملف الحساسية: ماء", () => {
  setCurrentLanguage("ar");
  const line = reasonSavedLine(reasonFor(["Water"]), tAr as any, trAr);
  setCurrentLanguage("en");
  assert.ok(line.startsWith("سبب الحفظ: تطابق مع ملف الحساسية: ماء"), line);
  assert.ok(line.includes("وُجد في"), line);
});

test("each source is identified", () => {
  const cases: [Partial<typeof product>, string][] = [
    [{ ingredients: "sugar", contains: "Milk" }, "Contains"],
    [{ ingredients: "sugar", mayContain: "Milk" }, "May contain"],
    [{ ingredients: "sugar, milk powder" }, "Ingredients"],
  ];
  for (const [input, source] of cases) {
    const stored = reasonFor(["Milk"], false, { ...product, ...input });
    const parsed = parseSaveReason(stored);
    assert.ok(parsed.some((reason) => reason.source === source), `${source}: ${stored}`);
    assert.ok(parsed.every((reason) => reason.kind === "allergy"));
  }
});

test("product-name match is identified as Product name", () => {
  const stored = reasonFor(["Peanut"], false, {
    ...product,
    productName: "Peanut Crunch Bar",
    ingredients: "sugar, salt",
  });
  assert.ok(parseSaveReason(stored).some((r) => r.source === "Product name"), stored);
});

test("halal findings are their own reason type", () => {
  const stored = reasonFor([], true, { ...product, ingredients: "sugar, gelatin" });
  const parsed = parseSaveReason(stored);
  assert.ok(parsed.some((r) => r.kind.startsWith("halal")), stored);
});

test("the reason is never put into Contains", () => {
  // buildSaveReason only returns the reason; Contains stays the label value.
  const result = screenProduct({ ...product, allergies: ["Water"], prefersHalal: false });
  assert.equal(product.contains, "");
  assert.ok(result.allergy.findings.every((f) => f.sourceLabel !== "Contains"));
});

test("no findings: saved by the user", () => {
  setCurrentLanguage("en");
  assert.equal(buildSaveReason([]), "Saved by the user.");
  assert.deepEqual(formatReasonLines("Saved by the user.", tEn as any), [
    "Saved by you (no allergy or halal match)",
  ]);
});

test("older saved rows are still explained", () => {
  setCurrentLanguage("en");
  const old = 'Allergen detected: Milk — Contains: "Milk"; May contain: Nuts — May contain: "Nuts"';
  const lines = formatReasonLines(old, tEn as any);
  assert.equal(lines[0], 'Matched your allergy profile: Milk (found in Contains: "Milk")');
  assert.equal(lines[1], 'Matched your allergy profile: Nuts (found in May contain: "Nuts")');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
