// scripts/testI18n.ts — checks translations and screening-text localization.
// Run with:  npx tsx scripts/testI18n.ts
/// <reference types="node" />
import assert from "node:assert/strict";
import en from "../lib/i18n/en";
import ar from "../lib/i18n/ar";
import { translateIn, translate, setCurrentLanguage, getCurrentLanguage } from "../lib/i18n/translate";
import { localizeScreeningText, localizeSourceLabel } from "../lib/i18n/screeningText";
import { screenProduct } from "../lib/screening";

assert.equal(getCurrentLanguage(), "en", "English is default");
assert.equal(translate("nav.scan"), "Scan");
setCurrentLanguage("ar");
assert.equal(translate("nav.scan"), "مسح");
assert.equal(translateIn("ar", "common.version", { version: "1.0.0" }), "الإصدار 1.0.0");
// fallback: pretend a key is missing in Arabic
delete (ar as any)["nav.avoid"];
assert.equal(translateIn("ar", "nav.avoid"), "Avoid", "falls back to English");
// placeholders consistent
for (const k of Object.keys(en) as (keyof typeof en)[]) {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  if ((ar as any)[k]) assert.equal(ph((ar as any)[k]), ph(en[k]), `placeholders differ for ${k}`);
}
const t = (k: any, p?: any) => translateIn("ar", k, p);
const r = screenProduct({ allergies: ["Milk", "Soy", "Wheat"], prefersHalal: true, ingredients: "Wheat Flour, Sugar, Soy Lecithin, E471", contains: "Milk", mayContain: "Peanuts" });
const out = [r.allergy.status, r.allergy.explanation, ...r.allergy.findings.map(f => f.headline), r.halal!.status, r.halal!.explanation, ...r.halal!.findings.map(f=>f.headline)];
for (const s of out) {
  const l = localizeScreeningText(s, t, "ar");
  console.log(JSON.stringify(s), "=>", l);
  assert.notEqual(l, s, "translated: " + s);
}
const reason = r.allergy.findings.map(f => `${f.headline} — ${f.sourceLabel}: "${f.statement}"`).join("; ");
console.log(localizeScreeningText(reason, t, "ar"));
assert.equal(localizeScreeningText("No selected allergen detected", t, "en"), "No selected allergen detected");
assert.equal(localizeSourceLabel("May contain", t), "قد يحتوي على");
console.log("en keys", Object.keys(en).length, "ALL I18N CHECKS PASSED");
