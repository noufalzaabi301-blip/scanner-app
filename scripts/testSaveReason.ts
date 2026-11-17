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
  buildReasonReport,
  buildSaveReason,
  formatReasonLines,
  parseSaveReason,
  rawReasonDetails,
  reasonSavedLine,
  reasonSavedLines,
  summarizeSaveReason,
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

// ----- Grouped report (share text / PDF) ------------------------------------

const busy = {
  productName: "Milk Chocolate Hazelnut Wafer",
  brandName: "Demo",
  ingredients:
    "Sugar, whole milk powder, wheat flour, cocoa butter, hazelnuts (5%), whey powder, " +
    "lactose, butter, soya flour, soybean oil, emulsifier (E322), salt, cocoa",
  contains: "Milk, Soy, Wheat",
  mayContain: "Nuts, Sesame",
};
const profile = ["Milk", "Soy beans", "Wheat flour", "Tree nuts", "Sesame"];
const busyStored = (() => {
  const result = screenProduct({ ...busy, allergies: profile, prefersHalal: true });
  return buildSaveReason([...result.allergy.findings, ...(result.halal?.findings ?? [])]);
})();

test("raw findings are kept in save_reason (debugging)", () => {
  assert.ok(rawReasonDetails(busyStored).length > 8, "many raw segments");
});

test("each matched allergy appears once", () => {
  const summary = summarizeSaveReason(busyStored);
  const names = summary.allergies.map((item) => item.name);
  assert.deepEqual([...names].sort(), [...profile].sort());
  assert.equal(new Set(names).size, names.length);
});

test("locations are grouped: Milk in Ingredients, Contains and Product name", () => {
  setCurrentLanguage("en");
  const report = buildReasonReport(busyStored, tEn as any);
  assert.ok(report.reasonBullets[0].startsWith("Matched allergies: Milk"), report.reasonBullets[0]);
  assert.ok(report.reasonBullets.includes("Milk: found in Ingredients, Contains, and Product name"));
  assert.ok(report.reasonBullets.includes("Soy beans: found in Ingredients and Contains"));
  assert.ok(report.reasonBullets.includes("Sesame: found in May contain"));
  assert.equal(report.reasonBullets.filter((line) => line.startsWith("Milk")).length, 1);
});

test("short report: one line per allergy plus the summary line", () => {
  const report = buildReasonReport(busyStored, tEn as any);
  assert.ok(report.reasonBullets.length <= profile.length + 1);
  assert.equal(new Set(report.reasonBullets).size, report.reasonBullets.length, "no duplicate lines");
});

test("ordinary ingredients (sugar, cocoa, salt) are not listed", () => {
  const text = buildReasonReport(busyStored, tEn as any).reasonBullets.join("\n").toLowerCase();
  for (const word of ["sugar", "cocoa", "salt", "whey", "lactose", "butter", "hazelnut"]) {
    assert.ok(!text.includes(word), `"${word}" should not be listed`);
  }
});

test("halal: E322 requires verification, once", () => {
  const report = buildReasonReport(busyStored, tEn as any);
  assert.deepEqual(report.halalBullets, ["E322 requires verification"]);
});

test("equivalent names are merged (older rows / mixed names)", () => {
  const stored = [
    'Matched your allergy profile: Milk — Ingredients: "milk powder"',
    'Possible Milk source (whey) — Ingredients: "whey"',
    'Matched your allergy profile: lactose — Ingredients: "lactose"',
    'Matched your allergy profile: butter — Contains: "butter"',
    'Matched your allergy profile: Hazelnut — Ingredients: "hazelnut"',
    'May contain: nuts — May contain: "nuts"',
    'Matched your allergy profile: Soya — Ingredients: "soya flour"',
    'Matched your allergy profile: soybeans — Contains: "soybeans"',
  ].join("; ");
  // With the user's profile: the user's names are used for each group.
  const summary = summarizeSaveReason(stored, ["Milk", "Tree nuts", "Soy beans"]);
  assert.deepEqual(
    summary.allergies.map((item) => item.name),
    ["Milk", "Tree nuts", "Soy beans"],
    JSON.stringify(summary.allergies)
  );
  assert.deepEqual(summary.allergies[0].sources, ["Ingredients", "Contains"]);
  assert.deepEqual(summary.allergies[1].sources, ["Ingredients", "May contain"]);
  assert.deepEqual(summary.allergies[2].sources, ["Ingredients", "Contains"]);

  // Ingredient-type names are merged into the user's allergy.
  const onlyTerms = summarizeSaveReason(
    'Matched your allergy profile: whey — Ingredients: "whey"; ' +
      'Matched your allergy profile: hazelnut — May contain: "hazelnut"',
    ["Milk", "Tree nuts"]
  );
  assert.deepEqual(onlyTerms.allergies.map((item) => item.name), ["Milk", "Tree nuts"]);
});

test("no allergy match: No matched allergies recorded.", () => {
  const stored = 'Halal concern: gelatin — Ingredients: "gelatin"';
  const report = buildReasonReport(stored, tEn as any);
  assert.deepEqual(report.reasonBullets, ["No matched allergies recorded."]);
  assert.deepEqual(report.halalBullets, ["gelatin: halal-related concern"]);
  assert.deepEqual(buildReasonReport("Saved by the user.", tEn as any).reasonBullets, [
    "No matched allergies recorded.",
  ]);
});

test("Arabic uses the same grouping and wording", () => {
  setCurrentLanguage("ar");
  const ar = buildReasonReport(busyStored, tAr as any, trAr);
  setCurrentLanguage("en");
  const en = buildReasonReport(busyStored, tEn as any);
  assert.equal(ar.reasonBullets.length, en.reasonBullets.length);
  assert.ok(ar.reasonBullets[0].startsWith("الحساسيات المطابقة: الحليب"), ar.reasonBullets[0]);
  assert.ok(ar.reasonBullets.includes("الحليب: وُجد في المكونات، «يحتوي على» واسم المنتج"), ar.reasonBullets.join(" | "));
  assert.deepEqual(ar.halalBullets, ["E322 يتطلب التحقق"]);
});

// ----- Concise share / PDF line ----------------------------------------------

test("share/PDF: one line with each matched allergy once", () => {
  setCurrentLanguage("en");
  const reason = reasonSavedLines(busyStored, tEn as any, undefined, profile);
  assert.equal(reason.heading, "Reason saved:");
  assert.equal(reason.singleLine, false);
  assert.equal(
    reason.line,
    "Matched allergies: Milk, Wheat flour, Tree nuts, Soy beans, Sesame"
  );
  assert.ok(!/found in/i.test(reason.line));
});

test("share/PDF: no matches → Reason saved: No matched allergies recorded.", () => {
  const reason = reasonSavedLines("Saved by the user.", tEn as any);
  assert.equal(`${reason.heading} ${reason.line}`, "Reason saved: No matched allergies recorded.");
  assert.equal(reason.singleLine, true);
});

test("share/PDF: Arabic uses the same concise format", () => {
  setCurrentLanguage("ar");
  const reason = reasonSavedLines(busyStored, tAr as any, trAr, profile);
  const none = reasonSavedLines(null, tAr as any);
  setCurrentLanguage("en");
  assert.equal(reason.heading, "سبب الحفظ:");
  assert.ok(reason.line.startsWith("الحساسيات المطابقة: الحليب"), reason.line);
  assert.ok(!reason.line.includes("وُجد في"));
  assert.equal(`${none.heading} ${none.line}`, "سبب الحفظ: لم تُسجَّل أي حساسية مطابقة.");
});

test("share text and PDF code use only the concise reason", () => {
  const screen = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "screens/AvoidListScreen.tsx"),
    "utf8"
  ) as string;
  const share = screen.slice(screen.indexOf("function buildShareText("), screen.indexOf("// PDF DATA"));
  const pdf = screen.slice(screen.indexOf("function createAvoidListPdfHtml("), screen.indexOf("<!DOCTYPE html>"));
  for (const part of [share, pdf]) {
    assert.ok(part.includes("reasonSavedLines("), "uses reasonSavedLines");
    assert.ok(!/reasonBullets/.test(part), "no per-allergy detail lines");
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
