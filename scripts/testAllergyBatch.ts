// ---------------------------------------------------------------------------
// scripts/testAllergyBatch.ts
// Several allergies at once: "Milk, Eggs, Peanuts" or one per line; each
// validated separately; duplicates removed; invalid entries rejected one
// by one; existing allergies kept; halal not overwritten when editing.
// Run with:  npx tsx scripts/testAllergyBatch.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  addAllergyEntries,
  batchFeedback,
  remainingInput,
  splitAllergyInput,
} from "../lib/allergyBatch";
import { translateIn } from "../lib/i18n/translate";

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
const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
const en = (key: any, vars?: any) => translateIn("en", key, vars);

test("example: 'Milk, Eggs, Peanuts' → Milk, Eggs, Peanuts", () => {
  const r = addAllergyEntries("Milk, Eggs, Peanuts", [], []);
  assert.deepEqual(r.selected, ["Milk", "Eggs", "Peanuts"]);
  assert.deepEqual(r.custom, []);
  assert.deepEqual(r.rejected, []);
});

test("commas, Arabic commas, semicolons and new lines all separate", () => {
  assert.deepEqual(splitAllergyInput("Kiwi\nCoconut،Mustard; Sesame ,  "), ["Kiwi", "Coconut", "Mustard", "Sesame"]);
});

test("custom foods are added as custom allergies", () => {
  const r = addAllergyEntries("Kiwi\nCoconut", [], []);
  assert.deepEqual(r.custom, ["Kiwi", "Coconut"]);
});

test("duplicates are removed (typed twice, or already saved)", () => {
  const r = addAllergyEntries("Milk, milk, Kiwi, kiwi, Eggs", ["Milk"], []);
  assert.deepEqual(r.selected, ["Milk", "Eggs"]);
  assert.deepEqual(r.custom, ["Kiwi"]);
  assert.deepEqual(r.duplicates, ["Milk", "milk", "kiwi"]);
  assert.deepEqual(r.rejected, []);
});

test("invalid entries are rejected individually; valid ones still added", () => {
  const r = addAllergyEntries("Eggs, 12345, Kiwi, @@@", [], []);
  assert.deepEqual(r.selected, ["Eggs"]);
  assert.deepEqual(r.custom, ["Kiwi"]);
  assert.deepEqual(r.rejected.map((x) => x.value), ["12345", "@@@"]);
  assert.equal(r.rejected[0].message, "prefs.allergyNoNumbers");
  assert.equal(remainingInput(r), "12345, @@@"); // left in the field to fix
  const text = batchFeedback(r, en);
  assert.match(text, /“12345”: Allergies cannot contain numbers\./);
  assert.equal(text.split("\n").length, 2);
});

test("existing allergies are preserved", () => {
  const r = addAllergyEntries("Soy", ["Milk", "Tree nuts"], ["Kiwi"]);
  assert.deepEqual(r.selected, ["Milk", "Tree nuts", "Soy"]);
  assert.deepEqual(r.custom, ["Kiwi"]);
});

test("Arabic entries work (and map to standard allergies)", () => {
  const r = addAllergyEntries("حليب، بيض\nكيوي", [], []);
  assert.deepEqual(r.selected, ["Milk", "Eggs"]);
  assert.equal(r.custom.length, 1);
  assert.deepEqual(r.rejected, []);
});

test("empty input gives the usual 'enter an allergy' message", () => {
  const r = addAllergyEntries(" , \n ", [], []);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].message, "prefs.enterAllergyBody");
});

test("editing allergies never overwrites halal; first setup saves it", () => {
  const save = read("lib/userPreferences.ts");
  assert.match(save, /typeof fields\.prefersHalal === "boolean"\s*\?\s*fields\.prefersHalal\s*:\s*existing\?\.prefers_halal === true/);
  const screen = read("screens/PreferencesScreen.tsx");
  assert.match(screen, /\.\.\.\(!isEditMode && prefersHalal !== null \? \{ prefersHalal \} : \{\}\)/);
  assert.match(screen, /if \(!isEditMode && prefersHalal === null\)/);
  assert.match(screen, /t\("prefs\.halalQuestionSetup"\)/);
});

test("both editors use the batch helper, also for text left in the field", () => {
  for (const file of ["screens/PreferencesScreen.tsx", "screens/GuestPreferencesScreen.tsx"]) {
    const s = read(file);
    assert.match(s, /addAllergyEntries\(/, file);
    assert.match(s, /if \(hasAllergies === true && customInput\.trim\(\)\)/, file);
  }
  assert.match(read("components/AllergyEditor.tsx"), /\bmultiline\b/);
});

test("new texts exist in English and Arabic", () => {
  for (const key of ["prefs.someNotAdded", "prefs.duplicatesSkipped", "prefs.halalQuestionSetup", "prefs.halalRequiredBody", "prefs.allergyHint"]) {
    assert.ok(/[؀-ۿ]/.test(translateIn("ar", key as any)), key);
  }
  assert.match(en("prefs.allergyHint"), /commas or new lines/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
